import { eq, isNotNull, isNull, ne } from "durcno";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  cleanTestData,
  destroyTestContext,
  getDb,
  initTestContext,
  schema,
} from "./setup";

describe("Network Address Column Types", () => {
  beforeAll(async () => {
    await initTestContext();
  }, 120000);

  beforeEach(async () => {
    await cleanTestData([
      schema.InetTests,
      schema.CidrTests,
      schema.MacaddrTests,
    ]);
  });

  afterAll(async () => {
    await destroyTestContext();
  });

  // ============================================================================
  // INET Column Tests
  // ============================================================================
  describe("INET Column Type", () => {
    // Test data
    const ipv4Host = "192.168.1.1";
    const ipv4WithMask = "192.168.1.1/24";
    const ipv6Host = "2001:db8::1";
    const ipv6WithMask = "2001:db8::1/64";
    const localhostV4 = "127.0.0.1";
    const localhostV6 = "::1";

    describe("notNull constraint", () => {
      it("should insert and read required inet", async () => {
        const db = getDb();
        await db.insert(schema.InetTests).values({
          requiredIp: ipv4Host,
        });

        const [row] = await db.from(schema.InetTests).select();
        expect(row.requiredIp).toBe(ipv4Host);
      });

      it("should allow null for optional inet", async () => {
        const db = getDb();
        await db.insert(schema.InetTests).values({
          requiredIp: ipv4Host,
          // optionalIp not provided - should be null
        });

        const [row] = await db.from(schema.InetTests).select();
        expect(row.optionalIp).toBeNull();
      });
    });

    describe("create and read", () => {
      it("should handle IPv4 addresses", async () => {
        const db = getDb();
        await db.insert(schema.InetTests).values({
          requiredIp: ipv4Host,
        });

        const [row] = await db.from(schema.InetTests).select();
        expect(row.requiredIp).toBe(ipv4Host);
      });

      it("should handle IPv4 addresses with CIDR mask", async () => {
        const db = getDb();
        await db.insert(schema.InetTests).values({
          requiredIp: ipv4WithMask,
        });

        const [row] = await db.from(schema.InetTests).select();
        expect(row.requiredIp).toBe(ipv4WithMask);
      });

      it("should handle IPv6 addresses", async () => {
        const db = getDb();
        await db.insert(schema.InetTests).values({
          requiredIp: ipv6Host,
        });

        const [row] = await db.from(schema.InetTests).select();
        expect(row.requiredIp).toBe(ipv6Host);
      });

      it("should handle localhost addresses", async () => {
        const db = getDb();
        await db
          .insert(schema.InetTests)
          .values([{ requiredIp: localhostV4 }, { requiredIp: localhostV6 }]);

        const rows = await db.from(schema.InetTests).select();
        expect(rows).toHaveLength(2);
        expect(rows[0].requiredIp).toBe(localhostV4);
        expect(rows[1].requiredIp).toBe(localhostV6);
      });

      it("should handle multiple rows with different IPs", async () => {
        const db = getDb();
        await db
          .insert(schema.InetTests)
          .values([
            { requiredIp: ipv4Host },
            { requiredIp: ipv6Host },
            { requiredIp: localhostV4 },
          ]);

        const rows = await db.from(schema.InetTests).select();
        expect(rows).toHaveLength(3);
      });

      it("should handle IPv6 addresses with CIDR mask", async () => {
        const db = getDb();
        await db.insert(schema.InetTests).values({
          requiredIp: ipv6WithMask,
        });

        const [row] = await db.from(schema.InetTests).select();
        expect(row.requiredIp).toBe(ipv6WithMask);
      });
    });

    describe("filtering", () => {
      beforeEach(async () => {
        const db = getDb();
        await db.insert(schema.InetTests).values([
          { requiredIp: ipv4Host, optionalIp: null },
          { requiredIp: ipv6Host, optionalIp: ipv4Host },
          { requiredIp: localhostV4, optionalIp: ipv6Host },
        ]);
      });

      it("should filter with eq operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.InetTests)
          .select()
          .where(eq(schema.InetTests.requiredIp, ipv6Host));

        expect(result).toHaveLength(1);
        expect(result[0].requiredIp).toBe(ipv6Host);
      });

      it("should filter with ne operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.InetTests)
          .select()
          .where(ne(schema.InetTests.requiredIp, ipv4Host));

        expect(result).toHaveLength(2);
      });

      it("should filter with isNull operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.InetTests)
          .select()
          .where(isNull(schema.InetTests.optionalIp));

        expect(result).toHaveLength(1);
        expect(result[0].requiredIp).toBe(ipv4Host);
      });

      it("should filter with isNotNull operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.InetTests)
          .select()
          .where(isNotNull(schema.InetTests.optionalIp));

        expect(result).toHaveLength(2);
      });
    });

    describe("unique constraint", () => {
      it("should allow unique inet values", async () => {
        const db = getDb();
        await db.insert(schema.InetTests).values([
          { requiredIp: ipv4Host, uniqueIp: "10.0.0.1" },
          { requiredIp: ipv6Host, uniqueIp: "10.0.0.2" },
        ]);

        const rows = await db.from(schema.InetTests).select();
        expect(rows).toHaveLength(2);
      });

      it("should reject duplicate unique inet values", async () => {
        const db = getDb();
        await db.insert(schema.InetTests).values({
          requiredIp: ipv4Host,
          uniqueIp: "10.0.0.1",
        });

        await expect(
          db.insert(schema.InetTests).values({
            requiredIp: ipv6Host,
            uniqueIp: "10.0.0.1", // duplicate
          }),
        ).rejects.toThrow();
      });
    });
  });

  // ============================================================================
  // CIDR Column Tests
  // ============================================================================
  describe("CIDR Column Type", () => {
    // Test data - CIDR always has network prefix
    const privateNetworkA = "10.0.0.0/8";
    const privateNetworkB = "172.16.0.0/12";
    const privateNetworkC = "192.168.0.0/16";
    const ipv6Network = "2001:db8::/32";
    const singleHost = "192.168.1.1/32";

    describe("notNull constraint", () => {
      it("should insert and read required cidr", async () => {
        const db = getDb();
        await db.insert(schema.CidrTests).values({
          requiredNetwork: privateNetworkA,
        });

        const [row] = await db.from(schema.CidrTests).select();
        expect(row.requiredNetwork).toBe(privateNetworkA);
      });

      it("should allow null for optional cidr", async () => {
        const db = getDb();
        await db.insert(schema.CidrTests).values({
          requiredNetwork: privateNetworkA,
        });

        const [row] = await db.from(schema.CidrTests).select();
        expect(row.optionalNetwork).toBeNull();
      });
    });

    describe("create and read", () => {
      it("should handle Class A private network", async () => {
        const db = getDb();
        await db.insert(schema.CidrTests).values({
          requiredNetwork: privateNetworkA,
        });

        const [row] = await db.from(schema.CidrTests).select();
        expect(row.requiredNetwork).toBe(privateNetworkA);
      });

      it("should handle Class B private network", async () => {
        const db = getDb();
        await db.insert(schema.CidrTests).values({
          requiredNetwork: privateNetworkB,
        });

        const [row] = await db.from(schema.CidrTests).select();
        expect(row.requiredNetwork).toBe(privateNetworkB);
      });

      it("should handle IPv6 networks", async () => {
        const db = getDb();
        await db.insert(schema.CidrTests).values({
          requiredNetwork: ipv6Network,
        });

        const [row] = await db.from(schema.CidrTests).select();
        expect(row.requiredNetwork).toBe(ipv6Network);
      });

      it("should handle single host CIDR (/32)", async () => {
        const db = getDb();
        await db.insert(schema.CidrTests).values({
          requiredNetwork: singleHost,
        });

        const [row] = await db.from(schema.CidrTests).select();
        expect(row.requiredNetwork).toBe(singleHost);
      });

      it("should handle multiple networks", async () => {
        const db = getDb();
        await db
          .insert(schema.CidrTests)
          .values([
            { requiredNetwork: privateNetworkA },
            { requiredNetwork: privateNetworkB },
            { requiredNetwork: privateNetworkC },
          ]);

        const rows = await db.from(schema.CidrTests).select();
        expect(rows).toHaveLength(3);
      });
    });

    describe("filtering", () => {
      beforeEach(async () => {
        const db = getDb();
        await db.insert(schema.CidrTests).values([
          { requiredNetwork: privateNetworkA, optionalNetwork: null },
          {
            requiredNetwork: privateNetworkB,
            optionalNetwork: privateNetworkA,
          },
          { requiredNetwork: privateNetworkC, optionalNetwork: ipv6Network },
        ]);
      });

      it("should filter with eq operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.CidrTests)
          .select()
          .where(eq(schema.CidrTests.requiredNetwork, privateNetworkB));

        expect(result).toHaveLength(1);
        expect(result[0].requiredNetwork).toBe(privateNetworkB);
      });

      it("should filter with isNull operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.CidrTests)
          .select()
          .where(isNull(schema.CidrTests.optionalNetwork));

        expect(result).toHaveLength(1);
        expect(result[0].requiredNetwork).toBe(privateNetworkA);
      });

      it("should filter with isNotNull operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.CidrTests)
          .select()
          .where(isNotNull(schema.CidrTests.optionalNetwork));

        expect(result).toHaveLength(2);
      });
    });

    describe("unique constraint", () => {
      it("should allow unique cidr values", async () => {
        const db = getDb();
        await db.insert(schema.CidrTests).values([
          { requiredNetwork: privateNetworkA, uniqueNetwork: "10.1.0.0/16" },
          { requiredNetwork: privateNetworkB, uniqueNetwork: "10.2.0.0/16" },
        ]);

        const rows = await db.from(schema.CidrTests).select();
        expect(rows).toHaveLength(2);
      });

      it("should reject duplicate unique cidr values", async () => {
        const db = getDb();
        await db.insert(schema.CidrTests).values({
          requiredNetwork: privateNetworkA,
          uniqueNetwork: "10.1.0.0/16",
        });

        await expect(
          db.insert(schema.CidrTests).values({
            requiredNetwork: privateNetworkB,
            uniqueNetwork: "10.1.0.0/16", // duplicate
          }),
        ).rejects.toThrow();
      });
    });
  });

  // ============================================================================
  // MACADDR Column Tests
  // ============================================================================
  describe("MACADDR Column Type", () => {
    // Test data - various MAC address formats
    const macColon = "00:11:22:33:44:55";
    const macHyphen = "aa-bb-cc-dd-ee-ff";
    const macUppercase = "AA:BB:CC:DD:EE:FF";
    const macBroadcast = "ff:ff:ff:ff:ff:ff";
    const macZero = "00:00:00:00:00:00";

    describe("notNull constraint", () => {
      it("should insert and read required macaddr", async () => {
        const db = getDb();
        await db.insert(schema.MacaddrTests).values({
          requiredMac: macColon,
        });

        const [row] = await db.from(schema.MacaddrTests).select();
        expect(row.requiredMac).toBe(macColon);
      });

      it("should allow null for optional macaddr", async () => {
        const db = getDb();
        await db.insert(schema.MacaddrTests).values({
          requiredMac: macColon,
        });

        const [row] = await db.from(schema.MacaddrTests).select();
        expect(row.optionalMac).toBeNull();
      });
    });

    describe("create and read", () => {
      it("should handle colon-separated MAC addresses", async () => {
        const db = getDb();
        await db.insert(schema.MacaddrTests).values({
          requiredMac: macColon,
        });

        const [row] = await db.from(schema.MacaddrTests).select();
        expect(row.requiredMac).toBe(macColon);
      });

      it("should handle broadcast MAC address", async () => {
        const db = getDb();
        await db.insert(schema.MacaddrTests).values({
          requiredMac: macBroadcast,
        });

        const [row] = await db.from(schema.MacaddrTests).select();
        expect(row.requiredMac).toBe(macBroadcast);
      });

      it("should handle zero MAC address", async () => {
        const db = getDb();
        await db.insert(schema.MacaddrTests).values({
          requiredMac: macZero,
        });

        const [row] = await db.from(schema.MacaddrTests).select();
        expect(row.requiredMac).toBe(macZero);
      });

      it("should handle multiple MAC addresses", async () => {
        const db = getDb();
        await db
          .insert(schema.MacaddrTests)
          .values([
            { requiredMac: macColon },
            { requiredMac: macBroadcast },
            { requiredMac: macZero },
          ]);

        const rows = await db.from(schema.MacaddrTests).select();
        expect(rows).toHaveLength(3);
      });

      it("should handle hyphen-separated MAC addresses", async () => {
        const db = getDb();
        await db.insert(schema.MacaddrTests).values({
          requiredMac: macHyphen,
        });

        const [row] = await db.from(schema.MacaddrTests).select();
        // PostgreSQL normalizes MAC addresses to colon-separated lowercase
        expect(row.requiredMac).toBe("aa:bb:cc:dd:ee:ff");
      });

      it("should handle uppercase MAC addresses", async () => {
        const db = getDb();
        await db.insert(schema.MacaddrTests).values({
          requiredMac: macUppercase,
        });

        const [row] = await db.from(schema.MacaddrTests).select();
        // PostgreSQL normalizes MAC addresses to lowercase
        expect(row.requiredMac).toBe("aa:bb:cc:dd:ee:ff");
      });
    });

    describe("filtering", () => {
      beforeEach(async () => {
        const db = getDb();
        await db.insert(schema.MacaddrTests).values([
          { requiredMac: macColon, optionalMac: null },
          { requiredMac: macBroadcast, optionalMac: macColon },
          { requiredMac: macZero, optionalMac: macBroadcast },
        ]);
      });

      it("should filter with eq operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.MacaddrTests)
          .select()
          .where(eq(schema.MacaddrTests.requiredMac, macBroadcast));

        expect(result).toHaveLength(1);
        expect(result[0].requiredMac).toBe(macBroadcast);
      });

      it("should filter with ne operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.MacaddrTests)
          .select()
          .where(ne(schema.MacaddrTests.requiredMac, macColon));

        expect(result).toHaveLength(2);
      });

      it("should filter with isNull operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.MacaddrTests)
          .select()
          .where(isNull(schema.MacaddrTests.optionalMac));

        expect(result).toHaveLength(1);
        expect(result[0].requiredMac).toBe(macColon);
      });

      it("should filter with isNotNull operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.MacaddrTests)
          .select()
          .where(isNotNull(schema.MacaddrTests.optionalMac));

        expect(result).toHaveLength(2);
      });
    });

    describe("unique constraint", () => {
      it("should allow unique macaddr values", async () => {
        const db = getDb();
        await db.insert(schema.MacaddrTests).values([
          { requiredMac: macColon, uniqueMac: "11:22:33:44:55:66" },
          { requiredMac: macBroadcast, uniqueMac: "22:33:44:55:66:77" },
        ]);

        const rows = await db.from(schema.MacaddrTests).select();
        expect(rows).toHaveLength(2);
      });

      it("should reject duplicate unique macaddr values", async () => {
        const db = getDb();
        await db.insert(schema.MacaddrTests).values({
          requiredMac: macColon,
          uniqueMac: "11:22:33:44:55:66",
        });

        await expect(
          db.insert(schema.MacaddrTests).values({
            requiredMac: macBroadcast,
            uniqueMac: "11:22:33:44:55:66", // duplicate
          }),
        ).rejects.toThrow();
      });

      it("should allow null for unique macaddr (multiple nulls allowed)", async () => {
        const db = getDb();
        await db.insert(schema.MacaddrTests).values([
          { requiredMac: macColon, uniqueMac: null },
          { requiredMac: macBroadcast, uniqueMac: null },
        ]);

        const rows = await db.from(schema.MacaddrTests).select();
        expect(rows).toHaveLength(2);
      });
    });
  });
});
