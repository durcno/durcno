import fs from "node:fs";
import path from "node:path";
import type Docker from "dockerode";
import { type $Client, database, defineConfig } from "durcno";
import { pg } from "durcno/connectors/pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  cleanDatabase,
  startPostgresContainer,
  stopPostgresContainer,
  type TestContainerInfo,
} from "../../docker-utils";
import { runDurcnoCommand } from "../../helpers";
import * as schema from "./schema";

const MIGRATIONS_DIR = "migrations.test";

function runDurcnoCli(command: string, containerInfo: TestContainerInfo): void {
  const configPath = path.resolve(__dirname, "durcno.config.ts");
  runDurcnoCommand([command, "--config", configPath], {
    ...process.env,
    DB_PORT: containerInfo.port.toString(),
    DB_NAME: containerInfo.dbName,
    MIGRATIONS_DIR: `./${MIGRATIONS_DIR}`,
  } as Record<string, string>);
}

describe("check constraints — insert acceptance and rejection", () => {
  let containerInfo: TestContainerInfo;
  let container: Docker.Container;
  let db: ReturnType<typeof database<typeof schema>>;
  let client: $Client;

  beforeAll(async () => {
    containerInfo = await startPostgresContainer({
      image: "postgres:17-alpine",
    });
    container = containerInfo.container;

    const migrationsDir = path.resolve(__dirname, MIGRATIONS_DIR);
    if (fs.existsSync(migrationsDir)) {
      fs.rmSync(migrationsDir, { recursive: true, force: true });
    }

    runDurcnoCli("generate", containerInfo);
    runDurcnoCli("migrate", containerInfo);

    db = database(
      schema,
      defineConfig({
        schema: "./schema.ts",
        connector: pg({
          pool: { max: 1 },
          dbCredentials: {
            host: "localhost",
            port: containerInfo.port,
            user: "testuser",
            password: "testpassword",
            database: containerInfo.dbName,
          },
        }),
      }),
    );
    client = db.$.config.connector.getClient();
    await client.connect();
  }, 120_000);

  beforeEach(async () => {
    await cleanDatabase(client);
  });

  afterAll(async () => {
    if (client) await client.close();
    if (db) await db.close();
    if (container) await stopPostgresContainer(container);
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe("Products table — scalar comparisons", () => {
    const validRow = {
      price: 100n,
      quantity: 50,
      email: "user@example.com",
      userName: "alice",
    };

    it("accepts a valid row", async () => {
      await expect(
        db.insert(schema.Products).values(validRow),
      ).resolves.not.toThrow();
    });

    it("rejects price = 0 (positive_price: price > 0)", async () => {
      await expect(
        db.insert(schema.Products).values({ ...validRow, price: 0n }),
      ).rejects.toThrow();
    });

    it("rejects negative price (positive_price: price > 0)", async () => {
      await expect(
        db.insert(schema.Products).values({ ...validRow, price: -1n }),
      ).rejects.toThrow();
    });

    it("rejects price >= 1_000_000 (max_price: price < 1_000_000)", async () => {
      await expect(
        db.insert(schema.Products).values({ ...validRow, price: 1_000_000n }),
      ).rejects.toThrow();
    });

    it("rejects negative quantity (valid_quantity: quantity >= 0)", async () => {
      await expect(
        db.insert(schema.Products).values({ ...validRow, quantity: -1 }),
      ).rejects.toThrow();
    });

    it("rejects quantity > 10000 (valid_quantity: quantity <= 10000)", async () => {
      await expect(
        db.insert(schema.Products).values({ ...validRow, quantity: 10001 }),
      ).rejects.toThrow();
    });

    it("accepts quantity at boundary values 0 and 10000", async () => {
      await expect(
        db.insert(schema.Products).values({ ...validRow, quantity: 0 }),
      ).resolves.not.toThrow();

      await expect(
        db.insert(schema.Products).values({ ...validRow, quantity: 10000 }),
      ).resolves.not.toThrow();
    });

    it("rejects email not matching LIKE '%@%.%'", async () => {
      await expect(
        db.insert(schema.Products).values({ ...validRow, email: "notanemail" }),
      ).rejects.toThrow();
    });

    it("accepts a null email (LIKE only applies when non-null)", async () => {
      await expect(
        db.insert(schema.Products).values({ ...validRow, email: undefined }),
      ).resolves.not.toThrow();
    });

    it("rejects userName shorter than 3 chars (name_length: length > 2)", async () => {
      await expect(
        db.insert(schema.Products).values({ ...validRow, userName: "ab" }),
      ).rejects.toThrow();
    });

    it("rejects userName longer than 100 chars (name_length: length <= 100)", async () => {
      await expect(
        db
          .insert(schema.Products)
          .values({ ...validRow, userName: "a".repeat(101) }),
      ).rejects.toThrow();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe("Orders table — IN / NOT IN constraints", () => {
    const validRow = {
      categoryId: 1,
      status: "active" as const,
      array: [1, 2],
    };

    it("accepts a valid row", async () => {
      await expect(
        db.insert(schema.Orders).values(validRow),
      ).resolves.not.toThrow();
    });

    it("rejects categoryId not in (1, 2, 3)", async () => {
      await expect(
        db.insert(schema.Orders).values({ ...validRow, categoryId: 4 }),
      ).rejects.toThrow();
    });

    it("accepts all valid category ids (1, 2, 3)", async () => {
      for (const categoryId of [1, 2, 3]) {
        await expect(
          db.insert(schema.Orders).values({ ...validRow, categoryId }),
        ).resolves.not.toThrow();
      }
    });

    it("rejects excluded category ids (99, 100)", async () => {
      for (const categoryId of [99, 100]) {
        await expect(
          db.insert(schema.Orders).values({ ...validRow, categoryId }),
        ).rejects.toThrow();
      }
    });

    it("rejects status not in the allowed set", async () => {
      await expect(
        db.insert(schema.Orders).values({ ...validRow, status: "unknown" }),
      ).rejects.toThrow();
    });

    it("accepts all valid statuses ('active', 'pending', 'closed')", async () => {
      for (const status of ["active", "pending", "closed"] as const) {
        await expect(
          db.insert(schema.Orders).values({ ...validRow, status }),
        ).resolves.not.toThrow();
      }
    });

    it("accepts valid dimensions ([1,2] and [2,1])", async () => {
      await expect(
        db.insert(schema.Orders).values({ ...validRow, array: [1, 2] }),
      ).resolves.not.toThrow();

      await expect(
        db.insert(schema.Orders).values({ ...validRow, array: [2, 1] }),
      ).resolves.not.toThrow();
    });

    it("rejects dimensions not in ([1,2] and [2,1])", async () => {
      for (const dimensions of [
        [1, 3],
        [3, 1],
        [1, 2, 3],
      ]) {
        await expect(
          db.insert(schema.Orders).values({ ...validRow, array: dimensions }),
        ).rejects.toThrow();
      }
    });
  });
});
