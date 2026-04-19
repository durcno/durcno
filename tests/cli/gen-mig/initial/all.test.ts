/** biome-ignore-all lint/suspicious/noUselessEscapeInString: <> */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import Docker from "dockerode";
import getPort from "get-port";
import pg from "pg";
import { v4 as uuid } from "uuid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("durcno generate - initial migration", () => {
  const configPath = path.resolve(__dirname, "durcno.config.ts");
  const migrationsDir = path.resolve(__dirname, "migrations.test");

  beforeAll(async () => {
    // Clean up test migrations directory before tests
    if (fs.existsSync(migrationsDir)) {
      fs.rmSync(migrationsDir, { recursive: true, force: true });
    }
    // Run generate command
    execSync(`durcno generate --config ${configPath}`, {
      stdio: "inherit",
    });
  }, 120000);

  afterAll(async () => {});

  describe("migrate command", () => {
    let pgContainer: Docker.Container;
    let docker: Docker;
    let client: pg.Client;
    let connectionString: string;

    async function createDockerDB(): Promise<string> {
      docker = new Docker();
      const port = await getPort({ port: 5432 });
      const image = "postgis/postgis:16-3.4";

      const pullStream = await docker.pull(image);
      await new Promise((resolve, reject) =>
        docker.modem.followProgress(pullStream, (err: Error | null) =>
          err ? reject(err) : resolve(err),
        ),
      );

      pgContainer = await docker.createContainer({
        Image: image,
        Env: [
          "POSTGRES_PASSWORD=testpass",
          "POSTGRES_USER=testuser",
          "POSTGRES_DB=testdb",
        ],
        name: `durcno-integration-tests-${uuid()}`,
        HostConfig: {
          AutoRemove: true,
          PortBindings: {
            "5432/tcp": [{ HostPort: `${port}` }],
          },
        },
      });

      await pgContainer.start();

      return `postgres://testuser:testpass@localhost:${port}/testdb`;
    }

    beforeAll(async () => {
      connectionString =
        process.env.PG_CONNECTION_STRING ?? (await createDockerDB());

      const sleep = 1000;
      let timeLeft = 20000;
      let connected = false;
      let lastError: unknown | undefined;

      do {
        try {
          client = new pg.Client(connectionString);
          await client.connect();
          connected = true;
          break;
        } catch (e) {
          lastError = e;
          await new Promise((resolve) => setTimeout(resolve, sleep));
          timeLeft -= sleep;
        }
      } while (timeLeft > 0);

      if (!connected) {
        console.error("Cannot connect to Postgres");
        await client?.end().catch(console.error);
        await pgContainer?.stop().catch(console.error);
        throw lastError;
      }

      // Enable PostGIS extension
      await client.query("CREATE EXTENSION IF NOT EXISTS postgis;");

      // Run migrate command with DATABASE_PORT environment variable
      const url = new URL(connectionString);
      execSync(`durcno migrate --config ${configPath}`, {
        cwd: __dirname,
        stdio: "inherit",
        env: {
          ...process.env,
          DATABASE_PORT: url.port,
        },
      });
    }, 120000);

    afterAll(async () => {
      await client?.end().catch(console.error);
      await pgContainer?.stop().catch(console.error);
    });

    it("should create all tables", async () => {
      const result = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `);

      const tableNames = result.rows.map((row) => row.table_name);
      expect(tableNames).toContain("users");
      expect(tableNames).toContain("posts");
      expect(tableNames).toContain("comments");
      expect(tableNames).toContain("products");
    });

    it("should create all enum types", async () => {
      const result = await client.query(`
        SELECT t.typname as enum_name, e.enumlabel as enum_value
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'public'
        ORDER BY t.typname, e.enumsortorder;
      `);

      const enums = result.rows.reduce(
        (acc, row) => {
          if (!acc[row.enum_name]) {
            acc[row.enum_name] = [];
          }
          acc[row.enum_name].push(row.enum_value);
          return acc;
        },
        {} as Record<string, string[]>,
      );

      expect(enums.role).toEqual(["admin", "user", "moderator"]);
      expect(enums.status).toEqual(["active", "inactive", "pending"]);
    });

    it("should create users table with correct structure", async () => {
      const result = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        ORDER BY ordinal_position;
      `);

      const columns = result.rows.reduce(
        (acc, row) => {
          acc[row.column_name] = {
            type: row.data_type,
            nullable: row.is_nullable === "YES",
            default: row.column_default,
            maxLength: row.character_maximum_length,
          };
          return acc;
        },
        {} as Record<
          string,
          {
            type: string;
            nullable: boolean;
            default: string | null;
            maxLength: number | null;
          }
        >,
      );

      expect(columns.id.type).toBe("bigint");
      expect(columns.id.nullable).toBe(false);
      expect(columns.username.type).toBe("character varying");
      expect(columns.username.maxLength).toBe(50);
      expect(columns.username.nullable).toBe(false);
      expect(columns.email.type).toBe("character varying");
      expect(columns.email.maxLength).toBe(100);
      expect(columns.is_active.type).toBe("boolean");
      expect(columns.is_active.nullable).toBe(false);
      expect(columns.created_at.type).toBe("timestamp with time zone");
      expect(columns.status.type).toBe("USER-DEFINED");
      expect(columns.role.type).toBe("USER-DEFINED");
      expect(columns.location.type).toBe("USER-DEFINED"); // PostGIS geography type
    });

    it("should create posts table with correct foreign keys", async () => {
      const result = await client.query(`
        SELECT
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = 'posts';
      `);

      expect(result.rows.length).toBeGreaterThan(0);
      const foreignKey = result.rows[0];
      expect(foreignKey.column_name).toBe("author_id");
      expect(foreignKey.foreign_table_name).toBe("users");
      expect(foreignKey.foreign_column_name).toBe("id");
    });

    it("should create comments table with correct foreign keys", async () => {
      const result = await client.query(`
        SELECT
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = 'comments'
        ORDER BY kcu.column_name;
      `);

      expect(result.rows.length).toBe(2);

      const authorFk = result.rows.find(
        (row) => row.column_name === "author_id",
      );
      expect(authorFk?.foreign_table_name).toBe("users");
      expect(authorFk?.foreign_column_name).toBe("id");

      const postFk = result.rows.find((row) => row.column_name === "post_id");
      expect(postFk?.foreign_table_name).toBe("posts");
      expect(postFk?.foreign_column_name).toBe("id");
    });

    it("should create unique constraints", async () => {
      const result = await client.query(`
        SELECT
          tc.table_name,
          kcu.column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'UNIQUE'
        AND tc.table_schema = 'public'
        ORDER BY tc.table_name, kcu.column_name;
      `);

      const uniqueColumns = result.rows.reduce(
        (acc, row) => {
          if (!acc[row.table_name]) {
            acc[row.table_name] = [];
          }
          acc[row.table_name].push(row.column_name);
          return acc;
        },
        {} as Record<string, string[]>,
      );

      expect(uniqueColumns.users).toContain("username");
      expect(uniqueColumns.posts).toContain("slug");
      expect(uniqueColumns.products).toContain("sku");
    });

    it("should create primary keys", async () => {
      const result = await client.query(`
        SELECT
          tc.table_name,
          kcu.column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
        ORDER BY tc.table_name;
      `);

      const primaryKeys = result.rows.reduce(
        (acc, row) => {
          acc[row.table_name] = row.column_name;
          return acc;
        },
        {} as Record<string, string>,
      );

      expect(primaryKeys.users).toBe("id");
      expect(primaryKeys.posts).toBe("id");
      expect(primaryKeys.comments).toBe("id");
      expect(primaryKeys.products).toBe("id");
    });

    it("should be able to insert and query data", async () => {
      // Insert a user
      await client.query(`
        INSERT INTO users (username, email, score, balance, "is_active", "created_at", status, role)
        VALUES ('testuser', 'test@example.com', 100, 1000, true, now(), 'active', 'user');
      `);

      // Query the user
      const result = await client.query(
        "SELECT username, email, status, role FROM users WHERE username = $1",
        ["testuser"],
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].username).toBe("testuser");
      expect(result.rows[0].email).toBe("test@example.com");
      expect(result.rows[0].status).toBe("active");
      expect(result.rows[0].role).toBe("user");
    });
  });
});
