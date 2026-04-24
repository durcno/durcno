import { describe, expect, it, vi } from "vitest";
import type { DurcnoLogger } from "durcno";
import { createDurcnoLogger } from "durcno/logger";
import { Query } from "../../src/query-builders/query";
import { $Client, $Pool } from "../../src/connectors/common";

const minimalOptions = { dbCredentials: { url: "postgres://localhost/test" } };

/** Minimal concrete $Client for testing. */
class TestClient extends $Client {
	constructor() {
		super(minimalOptions);
		this.query = async (_sql: string, _args?: (string | number | null)[]) => ({
			rows: [],
		});
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
		this.query = async (_sql: string, _args?: (string | number | null)[]) => ({
			rows: [],
		});
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
	describe("createDurcnoLogger", () => {
		it("returns an object with an info method", () => {
			const logger = createDurcnoLogger();
			expect(typeof logger.info).toBe("function");
		});
	});

	describe("$Client.execQuery with logger", () => {
		it("calls logger.info with structured query metadata", async () => {
			const mockLogger: DurcnoLogger = { info: vi.fn() };
			const client = new TestClient();
			client.logger = mockLogger;

			const q = new Query("SELECT * FROM users WHERE id = $1", (r) => r);
			q.arguments = [42];

			await client.execQuery(q);

			expect(mockLogger.info).toHaveBeenCalledOnce();
			expect(mockLogger.info).toHaveBeenCalledWith("Query", {
				sql: "SELECT * FROM users WHERE id = $1",
				arguments: [42],
			});
		});

		it("does not throw when no logger is configured", async () => {
			const client = new TestClient();
			const q = new Query("SELECT 1", (r) => r);

			await expect(client.execQuery(q)).resolves.not.toThrow();
		});
	});

	describe("$Pool.execQuery with logger", () => {
		it("calls logger.info with structured query metadata", async () => {
			const mockLogger: DurcnoLogger = { info: vi.fn() };
			const pool = new TestPool();
			pool.logger = mockLogger;

			const q = new Query(
				'INSERT INTO users ("name") VALUES ($1)',
				(r) => r,
			);
			q.arguments = ["John"];

			await pool.execQuery(q);

			expect(mockLogger.info).toHaveBeenCalledOnce();
			expect(mockLogger.info).toHaveBeenCalledWith("Query", {
				sql: 'INSERT INTO users ("name") VALUES ($1)',
				arguments: ["John"],
			});
		});

		it("does not throw when no logger is configured", async () => {
			const pool = new TestPool();
			const q = new Query("SELECT 1", (r) => r);

			await expect(pool.execQuery(q)).resolves.not.toThrow();
		});
	});

	describe("$Pool.execQuery logs multiple arguments correctly", () => {
		it("passes all arguments in the metadata", async () => {
			const mockLogger: DurcnoLogger = { info: vi.fn() };
			const pool = new TestPool();
			pool.logger = mockLogger;

			const q = new Query(
				"SELECT * FROM users WHERE id = $1 AND name = $2",
				(r) => r,
			);
			q.arguments = [1, "Alice"];

			await pool.execQuery(q);

			expect(mockLogger.info).toHaveBeenCalledWith("Query", {
				sql: "SELECT * FROM users WHERE id = $1 AND name = $2",
				arguments: [1, "Alice"],
			});
		});
	});

	describe("$Client.execQuery logs query with null arguments", () => {
		it("includes null in arguments array", async () => {
			const mockLogger: DurcnoLogger = { info: vi.fn() };
			const client = new TestClient();
			client.logger = mockLogger;

			const q = new Query("UPDATE users SET name = $1 WHERE id = $2", (r) => r);
			q.arguments = [null, 5];

			await client.execQuery(q);

			expect(mockLogger.info).toHaveBeenCalledWith("Query", {
				sql: "UPDATE users SET name = $1 WHERE id = $2",
				arguments: [null, 5],
			});
		});
	});
});
