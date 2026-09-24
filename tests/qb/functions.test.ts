import fs from "node:fs";
import path from "node:path";
import type Docker from "dockerode";
import {
  type $Client,
  abs,
  add,
  ceil,
  coalesce,
  concat,
  concatWs,
  database,
  defineConfig,
  div,
  eq,
  floor,
  greatest,
  least,
  left,
  length,
  lower,
  mod,
  mul,
  nullif,
  position,
  power,
  right,
  round,
  sql,
  sub,
  trim,
  trunc,
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
      .insertInto(schema.Users)
      .values([
        createTestUser({
          username: "  TEST User  ",
          email: "tEsT@exAmple.com",
        }),
      ])
      .returning({ id: true });

    const result = await db
      .from(schema.Users)
      .select(() => ({
        len: length(schema.Users.email),
        low: lower(schema.Users.email),
        up: upper(schema.Users.email),
        trimmed: trim(schema.Users.username),
        l: left(schema.Users.email, 4),
        r: right(schema.Users.email, 4),
        pos: position(schema.Users.email, "@"),
      }))
      .where(() => eq(schema.Users.id, user.id));

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
      .insertInto(schema.Users)
      .values([
        createTestUser({
          username: "Num",
          age,
        }),
      ])
      .returning({ id: true });

    const result = await db
      .from(schema.Users)
      .select(() => ({
        a: abs(schema.Users.age),
        m: mod(schema.Users.age, 2),
        r: round(schema.Users.age),
        c: ceil(schema.Users.age),
        f: floor(schema.Users.age),
        t: trunc(schema.Users.age),
        p: power(schema.Users.age, 2),
      }))
      .where(() => eq(schema.Users.id, user.id));

    expect(Number(result[0].a)).toBe(age);
    expect(Number(result[0].m)).toBe(age % 2);
    expect(Number(result[0].r)).toBe(age);
    expect(Number(result[0].c)).toBe(age);
    expect(Number(result[0].f)).toBe(age);
    expect(Number(result[0].t)).toBe(age);
    expect(Number(result[0].p)).toBe(age ** 2);
  });

  it("Arithmetic functions (add, sub, mul, div) evaluate correctly", async () => {
    const baseValue = 10;
    const [user] = await db
      .insertInto(schema.Users)
      .values([
        createTestUser({
          username: "ArithmeticTest",
          age: baseValue,
        }),
      ])
      .returning({ id: true });

    const result = await db
      .from(schema.Users)
      .select(() => ({
        added: add(schema.Users.age, 5),
        subtracted: sub(schema.Users.age, 3),
        multiplied: mul(schema.Users.age, 2),
        divided: div(schema.Users.age, 2),
        nested: add(mul(schema.Users.age, 2), sub(5, 1)), // (age * 2) + (5 - 1)
      }))
      .where(() => eq(schema.Users.id, user.id));

    expect(Number(result[0].added)).toBe(baseValue + 5); // 15
    expect(Number(result[0].subtracted)).toBe(baseValue - 3); // 7
    expect(Number(result[0].multiplied)).toBe(baseValue * 2); // 20
    expect(Number(result[0].divided)).toBe(baseValue / 2); // 5
    expect(Number(result[0].nested)).toBe(baseValue * 2 + (5 - 1)); // 24
  });

  it("Null-sensitive functions and null projections evaluate correctly", async () => {
    // Insert a test user with null email and age
    const [user] = await db
      .insertInto(schema.Users)
      .values([
        createTestUser({
          username: "NullSensUser",
          email: null,
          age: null,
        }),
      ])
      .returning({ id: true });

    const result = await db
      .from(schema.Users)
      .select(() => ({
        directNull: null,
        sqlNull: sql.null,
        rawStr: "hello",
        rawNum: 42,
        lowNull: lower(null),
        upNull: upper(null),
        trimNull: trim(null),
        lenNull: length(null),
        absNull: abs(null),
        addNull: add(5, null),
        lowEmail: lower(schema.Users.email),
        absAge: abs(schema.Users.age),
      }))
      .where(() => eq(schema.Users.id, user.id));

    expect(result[0].directNull).toBeNull();
    expect(result[0].sqlNull).toBeNull();
    expect(result[0].rawStr).toBe("hello");
    expect(result[0].rawNum).toBe(42);
    expect(result[0].lowNull).toBeNull();
    expect(result[0].upNull).toBeNull();
    expect(result[0].trimNull).toBeNull();
    expect(result[0].lenNull).toBeNull();
    expect(result[0].absNull).toBeNull();
    expect(result[0].addNull).toBeNull();
    expect(result[0].lowEmail).toBeNull();
    expect(result[0].absAge).toBeNull();
  });

  it("coalesce, nullif, concat, concatWs, and primitive projections evaluate correctly", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values([
        createTestUser({
          username: "CondUser",
          email: null,
          age: 25,
        }),
      ])
      .returning({ id: true });

    const result = await db
      .from(schema.Users)
      .select(() => ({
        coalEmail: coalesce(schema.Users.email, "default@test.com"),
        coalNull: coalesce(schema.Users.email, null),
        coalId: coalesce(schema.Users.id, 0n),
        nullIfMatch: nullif(schema.Users.age, 25),
        nullIfDiff: nullif(schema.Users.age, 30),
        concatenated: concat(schema.Users.username, "!", 42),
        concatColumn: concat(schema.Users.username, "#", schema.Users.id),
        greatestAge: greatest(schema.Users.age, 30),
        leastAge: least(schema.Users.age, 20),
        separated: concatWs(" - ", schema.Users.username, "active"),
        nullSep: concatWs(null, schema.Users.username),
        directBigInt: 100n,
        directBoolTrue: true,
        directBoolFalse: false,
        addBigInt: add(schema.Users.id, 10n),
      }))
      .where(() => eq(schema.Users.id, user.id));

    expect(result[0].coalEmail).toBe("default@test.com");
    expect(result[0].coalNull).toBeNull();
    expect(result[0].coalId).toBe(user.id);
    expect(typeof result[0].coalId).toBe("bigint");
    expect(result[0].nullIfMatch).toBeNull();
    expect(result[0].nullIfDiff).toBe(25);
    expect(result[0].concatenated).toBe("CondUser!42");
    expect(result[0].concatColumn).toBe(`CondUser#${user.id}`);
    expect(result[0].greatestAge).toBe(30);
    expect(result[0].leastAge).toBe(20);
    expect(result[0].separated).toBe("CondUser - active");
    expect(result[0].nullSep).toBeNull();
    expect(result[0].directBigInt).toBe(100n);
    expect(result[0].directBoolTrue).toBe(true);
    expect(result[0].directBoolFalse).toBe(false);
  });
});
