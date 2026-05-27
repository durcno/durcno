import fs from "node:fs";
import path from "node:path";
import type Docker from "dockerode";
import {
  type $Client,
  abs,
  add,
  ceil,
  database,
  defineConfig,
  div,
  eq,
  floor,
  left,
  length,
  lower,
  mod,
  mul,
  position,
  right,
  round,
  sub,
  trim,
  upper,
} from "durcno";
import { pg } from "durcno/connectors/pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema";
import {
  createTestUser,
  generateMigrationsDirPath,
  runDurcnoCli,
  startPostgresContainer,
  stopPostgresContainer,
  type TestContainerInfo,
  truncateTables,
} from "./setup";

describe("String and Numeric Functions", () => {
  let containerInfo: TestContainerInfo;
  let container: Docker.Container;
  let db: ReturnType<typeof database<typeof schema>>;
  let client: $Client;
  const migrationsDirName = generateMigrationsDirPath("functions");

  beforeAll(async () => {
    containerInfo = await startPostgresContainer({
      image: "postgres:16-alpine",
    });
    container = containerInfo.container;

    const configPath = path.resolve(__dirname, "durcno.config.ts");
    const migrationsDir = path.resolve(__dirname, migrationsDirName);

    if (fs.existsSync(migrationsDir)) {
      fs.rmSync(migrationsDir, { recursive: true, force: true });
    }

    runDurcnoCli("generate", configPath, containerInfo, migrationsDirName);
    runDurcnoCli("migrate", configPath, containerInfo, migrationsDirName);

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
  }, 120000);

  beforeEach(async () => {
    await truncateTables(client);
  });

  afterAll(async () => {
    if (client) await client.close();
    if (db) await db.close();
    if (container) await stopPostgresContainer(container);
  });

  it("String functions evaluate correctly", async () => {
    // Insert a test user
    const [user] = await db
      .insert(schema.Users)
      .values([
        createTestUser({
          username: "  TEST User  ",
          email: "tEsT@exAmple.com",
        }),
      ])
      .returning({ id: true });

    const result = await db
      .from(schema.Users)
      .select({
        len: length(schema.Users.email),
        low: lower(schema.Users.email),
        up: upper(schema.Users.email),
        trimmed: trim(schema.Users.username),
        l: left(schema.Users.email, 4),
        r: right(schema.Users.email, 4),
        pos: position(schema.Users.email, "@"),
      })
      .where(eq(schema.Users.id, user.id));

    expect(result[0].len).toBe(16);
    expect(result[0].low).toBe("test@example.com");
    expect(result[0].up).toBe("TEST@EXAMPLE.COM");
    expect(result[0].trimmed).toBe("TEST User");
    expect(result[0].l).toBe("tEsT");
    expect(result[0].r).toBe(".com");
    expect(result[0].pos).toBe(5); // 1-indexed in Postgres
  });

  it("Numeric functions evaluate correctly", async () => {
    const age = 25;
    // Insert a test user to test numeric functions on its age
    const [user] = await db
      .insert(schema.Users)
      .values([
        createTestUser({
          username: "Num",
          age,
        }),
      ])
      .returning({ id: true });

    const result = await db
      .from(schema.Users)
      .select({
        a: abs(schema.Users.age),
        m: mod(schema.Users.age, 2),
        r: round(schema.Users.age),
        c: ceil(schema.Users.age),
        f: floor(schema.Users.age),
      })
      .where(eq(schema.Users.id, user.id));

    expect(Number(result[0].a)).toBe(age);
    expect(Number(result[0].m)).toBe(age % 2);
    expect(Number(result[0].r)).toBe(age);
    expect(Number(result[0].c)).toBe(age);
    expect(Number(result[0].f)).toBe(age);
  });

  it("Arithmetic functions (add, sub, mul, div) evaluate correctly", async () => {
    const baseValue = 10;
    const [user] = await db
      .insert(schema.Users)
      .values([
        createTestUser({
          username: "ArithmeticTest",
          age: baseValue,
        }),
      ])
      .returning({ id: true });

    const result = await db
      .from(schema.Users)
      .select({
        added: add(schema.Users.age, 5),
        subtracted: sub(schema.Users.age, 3),
        multiplied: mul(schema.Users.age, 2),
        divided: div(schema.Users.age, 2),
        nested: add(mul(schema.Users.age, 2), sub(5, 1)), // (age * 2) + (5 - 1)
      })
      .where(eq(schema.Users.id, user.id));

    expect(Number(result[0].added)).toBe(baseValue + 5); // 15
    expect(Number(result[0].subtracted)).toBe(baseValue - 3); // 7
    expect(Number(result[0].multiplied)).toBe(baseValue * 2); // 20
    expect(Number(result[0].divided)).toBe(baseValue / 2); // 5
    expect(Number(result[0].nested)).toBe(baseValue * 2 + (5 - 1)); // 24
  });
});
