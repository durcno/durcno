import type { QueryLogger } from "durcno";
import {
  createDurcnoLogger,
  createLogger,
  createQueryLogger,
  formatDurcnoLog,
} from "durcno/logger";
import { describe, expect, it, vi } from "vitest";
import { $Client, $Pool } from "../../src/connectors/common";
import { Query } from "../../src/query-builders/query";

const minimalOptions = { dbCredentials: { url: "postgres://localhost/test" } };

/** Minimal concrete $Client for testing. */
class TestClient extends $Client {
  constructor() {
    super(minimalOptions);
  }
  async query(
    _sql: string,
    _args?: (string | number | null)[],
  ): Promise<unknown> {
    return { rows: [] };
  }
  async connect() {}
  getRows(response: any): any[] {
    return response.rows;
  }
  async close() {}
}
/** Minimal concrete $Pool for testing. */
class TestPool extends $Pool {
  constructor() {
    super(minimalOptions);
  }
  async query(
    _sql: string,
    _args?: (string | number | null)[],
  ): Promise<unknown> {
    return { rows: [] };
  }
  async connect() {}
  getRows(response: any): any[] {
    return response.rows;
  }
  async close() {}
  async acquireClient() {
    return new TestClient();
  }
}

describe("Logger", () => {
  describe("createLogger", () => {
    it("returns an object with an info and error method", () => {
      const logger = createLogger();
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.error).toBe("function");
    });

    it("aliases createQueryLogger and createDurcnoLogger", () => {
      expect(createQueryLogger).toBe(createLogger);
      expect(createDurcnoLogger).toBe(createLogger);
    });
  });

  describe("$Client.execQuery with logger", () => {
    it("calls logger.info with structured query metadata", async () => {
      const mockLogger: QueryLogger = { info: vi.fn(), error: vi.fn() };
      const client = new TestClient();
      client.logger = mockLogger;

      const q = new Query("SELECT * FROM users WHERE id = $1", (r) => r);
      q.arguments = [42];

      await client.execQuery(q);

      expect(mockLogger.info).toHaveBeenCalledOnce();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Query executed",
        expect.objectContaining({
          query: expect.objectContaining({
            sql: "SELECT * FROM users WHERE id = $1",
            arguments: [42],
          }),
        }),
      );
    });

    it("does not throw when no logger is configured", async () => {
      const client = new TestClient();
      const q = new Query("SELECT 1", (r) => r);

      await expect(client.execQuery(q)).resolves.not.toThrow();
    });

    it("logs query failure and rethrows", async () => {
      const mockLogger: QueryLogger = { info: vi.fn(), error: vi.fn() };
      const client = new TestClient();
      client.logger = mockLogger;

      const testError = new Error("Connection lost");
      client.query = vi.fn().mockRejectedValueOnce(testError);

      const q = new Query("SELECT 1", (r) => r);
      await expect(client.execQuery(q)).rejects.toThrow(testError);

      expect(mockLogger.error).toHaveBeenCalledOnce();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Query failed",
        expect.objectContaining({
          query: expect.objectContaining({
            sql: "SELECT 1",
          }),
          error: testError,
        }),
      );
    });
  });

  describe("$Pool.execQuery with logger", () => {
    it("calls logger.info with structured query metadata", async () => {
      const mockLogger: QueryLogger = { info: vi.fn(), error: vi.fn() };
      const pool = new TestPool();
      pool.logger = mockLogger;

      const q = new Query('INSERT INTO users ("name") VALUES ($1)', (r) => r);
      q.arguments = ["John"];

      await pool.execQuery(q);

      expect(mockLogger.info).toHaveBeenCalledOnce();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Query executed",
        expect.objectContaining({
          query: expect.objectContaining({
            sql: 'INSERT INTO users ("name") VALUES ($1)',
            arguments: ["John"],
          }),
        }),
      );
    });

    it("does not throw when no logger is configured", async () => {
      const pool = new TestPool();
      const q = new Query("SELECT 1", (r) => r);

      await expect(pool.execQuery(q)).resolves.not.toThrow();
    });

    it("logs query failure and rethrows", async () => {
      const mockLogger: QueryLogger = { info: vi.fn(), error: vi.fn() };
      const pool = new TestPool();
      pool.logger = mockLogger;

      const testError = new Error("DB Error");
      pool.query = vi.fn().mockRejectedValueOnce(testError);

      const q = new Query("SELECT 1", (r) => r);
      await expect(pool.execQuery(q)).rejects.toThrow(testError);

      expect(mockLogger.error).toHaveBeenCalledOnce();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Query failed",
        expect.objectContaining({
          query: expect.objectContaining({
            sql: "SELECT 1",
          }),
          error: testError,
        }),
      );
    });
  });

  describe("$Pool.execQuery logs multiple arguments correctly", () => {
    it("passes all arguments in the metadata", async () => {
      const mockLogger: QueryLogger = { info: vi.fn(), error: vi.fn() };
      const pool = new TestPool();
      pool.logger = mockLogger;

      const q = new Query(
        "SELECT * FROM users WHERE id = $1 AND name = $2",
        (r) => r,
      );
      q.arguments = [1, "Alice"];

      await pool.execQuery(q);

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Query executed",
        expect.objectContaining({
          query: expect.objectContaining({
            sql: "SELECT * FROM users WHERE id = $1 AND name = $2",
            arguments: [1, "Alice"],
          }),
        }),
      );
    });
  });

  describe("$Client.execQuery logs query with null arguments", () => {
    it("includes null in arguments array", async () => {
      const mockLogger: QueryLogger = { info: vi.fn(), error: vi.fn() };
      const client = new TestClient();
      client.logger = mockLogger;

      const q = new Query("UPDATE users SET name = $1 WHERE id = $2", (r) => r);
      q.arguments = [null, 5];

      await client.execQuery(q);

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Query executed",
        expect.objectContaining({
          query: expect.objectContaining({
            sql: "UPDATE users SET name = $1 WHERE id = $2",
            arguments: [null, 5],
          }),
        }),
      );
    });
  });

  describe("formatDurcnoLog", () => {
    const formatInfo = (info: Record<string, unknown>) => {
      return formatDurcnoLog({
        level: "info",
        message: "test",
        label: "durcno",
        timestamp: "2026-10-02T10:00:00.000Z",
        ...info,
      });
    };

    it("formats a standard query with SQL, arguments, and duration using query object", () => {
      const out = formatInfo({
        level: "info",
        message: "Query executed",
        query: {
          sql: "SELECT * FROM users\nWHERE id = $1",
          arguments: [42],
          durationMs: 3.14,
        },
      });

      expect(out).toBe(
        [
          "2026-10-02T10:00:00.000Z [durcno] INFO: Query executed",
          "  ┌ SQL",
          "  │ SELECT * FROM users",
          "  │ WHERE id = $1",
          "  ├ Arguments",
          "  │ $1 = 42",
          "  ├ Duration",
          "  │ 3.14ms",
          "  └",
        ].join("\n"),
      );
    });

    it("supports legacy flat metadata format as a fallback", () => {
      const out = formatInfo({
        level: "info",
        message: "Query executed",
        sql: "SELECT * FROM users\nWHERE id = $1",
        arguments: [42],
        durationMs: 3.14,
      });

      expect(out).toBe(
        [
          "2026-10-02T10:00:00.000Z [durcno] INFO: Query executed",
          "  ┌ SQL",
          "  │ SELECT * FROM users",
          "  │ WHERE id = $1",
          "  ├ Arguments",
          "  │ $1 = 42",
          "  ├ Duration",
          "  │ 3.14ms",
          "  └",
        ].join("\n"),
      );
    });

    it("formats a failed query with SQL and Error", () => {
      const err = new Error("syntax error at or near 'FORM'");
      err.stack = "Error: syntax error\n    at Driver.query (/db/driver.ts:10)";

      const out = formatInfo({
        level: "error",
        message: "Query failed",
        sql: "SELECT * FORM users",
        durationMs: 1.5,
        error: err,
      });

      expect(out).toBe(
        [
          "2026-10-02T10:00:00.000Z [durcno] ERROR: Query failed",
          "  ┌ SQL",
          "  │ SELECT * FORM users",
          "  ├ Duration",
          "  │ 1.50ms",
          "  ├ Error",
          "  │ Error: syntax error",
          "  │     at Driver.query (/db/driver.ts:10)",
          "  └",
        ].join("\n"),
      );
    });

    it("formats transaction failure logs with only error field (no SQL)", () => {
      const rollbackErr = new Error("Connection terminated unexpectedly");
      rollbackErr.stack =
        "Error: Connection terminated\n    at Socket.onClose (/net/socket.ts:25)";

      const out = formatInfo({
        level: "error",
        message: "Transaction ROLLBACK failed",
        error: rollbackErr,
      });

      expect(out).toBe(
        [
          "2026-10-02T10:00:00.000Z [durcno] ERROR: Transaction ROLLBACK failed",
          "  ┌ Error",
          "  │ Error: Connection terminated",
          "  │     at Socket.onClose (/net/socket.ts:25)",
          "  └",
        ].join("\n"),
      );
    });

    it("formats object errors cleanly", () => {
      const out = formatInfo({
        level: "error",
        message: "Failed to release transaction connection",
        error: { code: "ECONNRESET", detail: "socket hang up" },
      });

      expect(out).toContain("  ┌ Error");
      expect(out).toContain('  │   "code": "ECONNRESET"');
      expect(out).toContain('  │   "detail": "socket hang up"');
      expect(out).toContain("  └");
    });

    it("handles circular objects in error without throwing", () => {
      const circular: Record<string, unknown> = { name: "cycle" };
      circular.self = circular;

      const out = formatInfo({
        level: "error",
        message: "Custom error",
        error: circular,
      });

      expect(out).toContain("  ┌ Error");
      expect(out).toContain("  │ [object Object]");
      expect(out).toContain("  └");
    });

    it("formats plain messages without metadata as single-line", () => {
      const out = formatInfo({
        level: "info",
        message: "Connected to database",
      });

      expect(out).toBe(
        "2026-10-02T10:00:00.000Z [durcno] INFO: Connected to database",
      );
    });
  });
});
