import { eq } from "durcno";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { destroyTestContext, getDb, initTestContext, schema } from "./setup";

describe("Network Column Types", () => {
  beforeAll(async () => {
    await initTestContext();
  }, 120000);

  afterAll(async () => {
    await destroyTestContext();
  });

  // ==========================================================================
  // INET
  // ==========================================================================

  describe("inet", () => {
    let insertedId: bigint;

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.InetTests)
        .values({ ip: "192.168.1.1" })
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.InetTests)
        .select()
        .where(eq(schema.InetTests.id, insertedId));
      expect(row.ip).toBe("192.168.1.1");
      expect(row.ipWithDefault).toBe("127.0.0.1");
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.InetTests)
        .set({ ip: "10.0.0.1" })
        .where(eq(schema.InetTests.id, insertedId));
      const [row] = await db
        .from(schema.InetTests)
        .select()
        .where(eq(schema.InetTests.id, insertedId));
      expect(row.ip).toBe("10.0.0.1");
    });
  });

  // ==========================================================================
  // CIDR
  // ==========================================================================

  describe("cidr", () => {
    let insertedId: bigint;

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.CidrTests)
        .values({ network: "10.0.0.0/8" })
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.CidrTests)
        .select()
        .where(eq(schema.CidrTests.id, insertedId));
      expect(row.network).toBe("10.0.0.0/8");
      expect(row.networkWithDefault).toBe("0.0.0.0/0");
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.CidrTests)
        .set({ network: "192.168.0.0/16" })
        .where(eq(schema.CidrTests.id, insertedId));
      const [row] = await db
        .from(schema.CidrTests)
        .select()
        .where(eq(schema.CidrTests.id, insertedId));
      expect(row.network).toBe("192.168.0.0/16");
    });
  });

  // ==========================================================================
  // MACADDR
  // ==========================================================================

  describe("macaddr", () => {
    let insertedId: bigint;

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.MacaddrTests)
        .values({ mac: "00:11:22:33:44:55" })
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.MacaddrTests)
        .select()
        .where(eq(schema.MacaddrTests.id, insertedId));
      expect(row.mac).toBe("00:11:22:33:44:55");
      expect(row.macWithDefault).toBe("00:00:00:00:00:00");
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.MacaddrTests)
        .set({ mac: "aa:bb:cc:dd:ee:ff" })
        .where(eq(schema.MacaddrTests.id, insertedId));
      const [row] = await db
        .from(schema.MacaddrTests)
        .select()
        .where(eq(schema.MacaddrTests.id, insertedId));
      expect(row.mac).toBe("aa:bb:cc:dd:ee:ff");
    });
  });
});
