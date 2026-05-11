import fs from "node:fs";
import path from "node:path";
import type Docker from "dockerode";
import {
  type $Client,
  abs,
  and,
  ceil,
  contains,
  database,
  defineConfig,
  endsWith,
  eq,
  floor,
  gt,
  left,
  length,
  lower,
  lt,
  mod,
  ne,
  position,
  right,
  round,
  startsWith,
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

describe("String and Numeric Functions and Filters", () => {
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

  it("String filters (startsWith, endsWith, contains) work correctly", async () => {
    const uniqueVal = Date.now().toString();
    await db.insert(schema.Users).values(
      createTestUser({
        username: `prefix_${uniqueVal}_suffix`,
        email: `filter${uniqueVal}@example.com`,
      }),
    );

    const byStarts = await db
      .from(schema.Users)
      .select({ id: schema.Users.id })
      .where(startsWith(schema.Users.username, `prefix_${uniqueVal}`));
    expect(byStarts.length).toBe(1);

    const byEnds = await db
      .from(schema.Users)
      .select({ id: schema.Users.id })
      .where(endsWith(schema.Users.username, `${uniqueVal}_suffix`));
    expect(byEnds.length).toBe(1);
    const byContains = await db
      .from(schema.Users)
      .select({ id: schema.Users.id })
      .where(contains(schema.Users.username, uniqueVal));
    expect(byContains.length).toBe(1);
  });

  it("Filters support SqlFn values", async () => {
    const uniqueEmail = `mixedCASE${Date.now()}@test.com`;
    const otherEmail = `other${Date.now()}@test.com`;

    await db.insert(schema.Users).values([
      createTestUser({
        username: "SqlFn Filter Test",
        email: uniqueEmail,
      }),
      createTestUser({
        username: "SqlFn Filter Test 2",
        email: otherEmail,
      }),
    ]);

    // eq with lower
    const eqResult = await db
      .from(schema.Users)
      .select({ email: schema.Users.email })
      .where(eq(lower(schema.Users.email), uniqueEmail.toLowerCase()));
    expect(eqResult.length).toBe(1);

    // ne with lower
    const neResult = await db
      .from(schema.Users)
      .select({ email: schema.Users.email })
      .where(ne(lower(schema.Users.email), uniqueEmail.toLowerCase()));
    expect(neResult.length).toBeGreaterThan(0);
    expect(neResult.find((u) => u.email === uniqueEmail)).toBeUndefined();

    // gt, gte, lt, lte with length
    const lenGt = await db
      .from(schema.Users)
      .select({ email: schema.Users.email })
      .where(
        and(
          eq(schema.Users.email, uniqueEmail),
          gt(length(schema.Users.email), uniqueEmail.length - 1),
        ),
      );
    expect(lenGt.length).toBe(1);

    const lenLt = await db
      .from(schema.Users)
      .select({ email: schema.Users.email })
      .where(
        and(
          eq(schema.Users.email, uniqueEmail),
          lt(length(schema.Users.email), uniqueEmail.length + 1),
        ),
      );
    expect(lenLt.length).toBe(1);
  });
});
