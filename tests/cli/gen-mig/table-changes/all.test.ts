import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import Docker from "dockerode";
import { MIGRATION_NAME_REGEX } from "durcno/migration";
import getPort from "get-port";
import pg from "pg";
import { v4 as uuid } from "uuid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rmSync } from "../../../helpers";

describe("durcno generate - table changes", () => {
  const configPath = path.resolve(__dirname, "durcno.config.ts");
  const migrationsDir = path.resolve(__dirname, "migrations.test");

  let pgContainer: Docker.Container;
  let docker: Docker;
  let client: pg.Client;
  let connectionString: string;
  let port: number;

  async function createDockerDB(): Promise<string> {
    docker = new Docker();
    port = await getPort({ port: 5432 });
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
      name: `durcno-table-changes-test-${uuid()}`,
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

  function runGenerate(isFirstMigration: boolean): {
    success: boolean;
    output: string;
  } {
    const result = spawnSync("durcno", ["generate", "--config", configPath], {
      encoding: "utf8",
      cwd: process.cwd(),
      env: {
        ...process.env,
        FIRST_MIGRATION: isFirstMigration ? "true" : "false",
      },
    });
    return {
      success: result.status === 0,
      output: result.stdout + result.stderr,
    };
  }

  function runMigrate(): { success: boolean; output: string } {
    const result = spawnSync("durcno", ["migrate", "--config", configPath], {
      encoding: "utf8",
      cwd: __dirname,
      env: { ...process.env, DATABASE_PORT: String(port) },
    });
    return {
      success: result.status === 0,
      output: result.stdout + result.stderr,
    };
  }

  function getMigrationFolders(): string[] {
    if (!fs.existsSync(migrationsDir)) return [];
    return fs
      .readdirSync(migrationsDir)
      .filter((f) => MIGRATION_NAME_REGEX.test(f))
      .sort();
  }

  beforeAll(async () => {
    rmSync(migrationsDir);
    delete process.env.FIRST_MIGRATION;

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
  }, 120000);

  afterAll(async () => {
    await client?.end().catch(console.error);
    await pgContainer?.stop().catch(console.error);
  });

  it("should generate and apply initial migration creating users table", async () => {
    // Generate initial migration
    const genResult = runGenerate(true);
    expect(genResult.success).toBe(true);

    const folders = getMigrationFolders();
    expect(folders).toHaveLength(1);

    // Run migrate
    const migrateResult = runMigrate();
    expect(migrateResult.success).toBe(true);

    // Verify users table exists with initial columns
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tableNames = tablesResult.rows.map((row) => row.table_name);
    expect(tableNames).toContain("users");
    expect(tableNames).not.toContain("posts");

    // Verify users table columns
    const columnsResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'users'
      ORDER BY ordinal_position;
    `);
    const columnNames = columnsResult.rows.map((row) => row.column_name);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("username");
    expect(columnNames).toContain("email");
    expect(columnNames).toContain("created_at");
    expect(columnNames).not.toContain("bio");
    expect(columnNames).not.toContain("age");
  });

  it("should generate and apply subsequent migration adding columns and new table", async () => {
    // Wait to ensure different timestamp
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Generate subsequent migration
    const genResult = runGenerate(false);
    expect(genResult.success).toBe(true);

    const folders = getMigrationFolders();
    expect(folders).toHaveLength(2);

    // Run migrate
    const migrateResult = runMigrate();
    expect(migrateResult.success).toBe(true);

    // Verify posts table now exists
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tableNames = tablesResult.rows.map((row) => row.table_name);
    expect(tableNames).toContain("users");
    expect(tableNames).toContain("posts");

    // Verify users table now has bio and age columns
    const usersColumnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'users'
      ORDER BY ordinal_position;
    `);
    const usersColumns = usersColumnsResult.rows.reduce(
      (acc, row) => {
        acc[row.column_name] = {
          type: row.data_type,
          nullable: row.is_nullable === "YES",
        };
        return acc;
      },
      {} as Record<string, { type: string; nullable: boolean }>,
    );
    expect(usersColumns.bio).toBeDefined();
    expect(usersColumns.bio.type).toBe("text");
    expect(usersColumns.age).toBeDefined();
    expect(usersColumns.age.type).toBe("integer");

    // Verify posts table structure
    const postsColumnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'posts'
      ORDER BY ordinal_position;
    `);
    const postsColumns = postsColumnsResult.rows.reduce(
      (acc, row) => {
        acc[row.column_name] = {
          type: row.data_type,
          nullable: row.is_nullable === "YES",
        };
        return acc;
      },
      {} as Record<string, { type: string; nullable: boolean }>,
    );
    expect(postsColumns.id).toBeDefined();
    expect(postsColumns.title).toBeDefined();
    expect(postsColumns.content).toBeDefined();
    expect(postsColumns.user_id).toBeDefined();
    expect(postsColumns.published_at).toBeDefined();
    expect(postsColumns.created_at).toBeDefined();

    // Verify posts table foreign key to users
    const fkResult = await client.query(`
      SELECT
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
    expect(fkResult.rows.length).toBeGreaterThan(0);
    const foreignKey = fkResult.rows[0];
    expect(foreignKey.column_name).toBe("user_id");
    expect(foreignKey.foreign_table_name).toBe("users");
    expect(foreignKey.foreign_column_name).toBe("id");
  });

  it("should detect no changes when schema is unchanged", () => {
    const result = runGenerate(false);
    expect(result.output).toContain("No changes detected");

    // Should not create a new migration folder
    const folders = getMigrationFolders();
    expect(folders).toHaveLength(2);
  });

  it("should verify migration folders follow ISO timestamp naming", () => {
    const folders = getMigrationFolders();
    expect(folders.length).toBeGreaterThanOrEqual(2);

    for (const folder of folders) {
      expect(MIGRATION_NAME_REGEX.test(folder)).toBe(true);
    }

    // Verify migrations are in chronological order
    for (let i = 1; i < folders.length; i++) {
      const toISOString = (d: string) =>
        `${d.split("T")[0]}T${d.split("T")[1].replace(/-/g, ":")}`;
      const prevTime = new Date(toISOString(folders[i - 1])).getTime();
      const currTime = new Date(toISOString(folders[i])).getTime();
      expect(currTime).toBeGreaterThan(prevTime);
    }
  });

  it("should be able to insert and query data after migrations", async () => {
    // Insert a user
    await client.query(`
      INSERT INTO users (username, email, bio, age, "created_at")
      VALUES ('testuser', 'test@example.com', 'Test bio', 25, now());
    `);

    // Query the user
    const userResult = await client.query(
      "SELECT username, email, bio, age FROM users WHERE username = $1",
      ["testuser"],
    );
    expect(userResult.rows.length).toBe(1);
    expect(userResult.rows[0].username).toBe("testuser");
    expect(userResult.rows[0].bio).toBe("Test bio");
    expect(userResult.rows[0].age).toBe(25);

    // Insert a post referencing the user
    const userIdResult = await client.query(
      "SELECT id FROM users WHERE username = $1",
      ["testuser"],
    );
    const userId = userIdResult.rows[0].id;

    await client.query(
      `
      INSERT INTO posts (title, content, "user_id", "created_at")
      VALUES ('Test Post', 'Post content', $1, now());
    `,
      [userId],
    );

    // Query the post with join
    const postResult = await client.query(`
      SELECT p.title, p.content, u.username
      FROM posts p
      JOIN users u ON p."user_id" = u.id
      WHERE p.title = 'Test Post';
    `);
    expect(postResult.rows.length).toBe(1);
    expect(postResult.rows[0].title).toBe("Test Post");
    expect(postResult.rows[0].username).toBe("testuser");
  });
});
