import { Arg, prequery, Query } from "durcno";
import { describe, expect, it } from "vitest";
import type { QueryExecutor } from "../../src/connectors/common";
import type { AnyDBorTX } from "../../src/db";

describe("prequery (unit)", () => {
  it("assigns index and key to args", () => {
    const args = {
      foo: new Arg((v: any) => v),
    } as const;

    const prepared = prequery(args, () =>
      Object.assign(Promise.resolve([]), {
        toQuery: () => new Query("SELECT 1", (r) => r),
      }),
    );

    expect(args.foo.index).toBe(1);
    expect(args.foo.key).toBe("foo");
    expect(prepared).toHaveProperty("run");
  });

  it("run replaces query.arguments with handler outputs and execute returns rows", async () => {
    const args = {
      foo: new Arg<string>((v: string) => `${v}-handled`),
    } as const;

    const q = new Query("SELECT * FROM test", (rows) => rows);
    // The query is expected to contain argument names initially
    q.arguments = ["foo"];

    const prepared = prequery(args, () =>
      Object.assign(Promise.resolve([]), { toQuery: () => q }),
    );

    const executor = (() => {
      return {
        query: async (_sql: string, _args?: (string | number | null)[]) => ({
          rows: [{ value: _args ? _args[0] : null }],
        }),
        execQuery(q: any) {
          return this.query(q.sql, q.arguments);
        },
        getRows: (res: any) => res.rows,
        connect: async () => {},
        close: async () => {},
      } as QueryExecutor;
    })();

    const dbStub = {
      $: { config: {} },
      _: { getExecutor: () => executor },
    } as unknown as AnyDBorTX;

    const pq = prepared.run(dbStub, { foo: "X" });

    // After run, the query arguments should be replaced with handler outputs
    expect(pq.query.arguments).toEqual(["X-handled"]);

    // Executing should call the executor and return rows via rowsHandler
    const res = await pq.execute();
    expect(res).toEqual([{ value: "X-handled" }]);
  });

  it("run replaces only arg keys and preserves non-arg arguments", async () => {
    const args = {
      bar: new Arg<number>((v: number) => v * 10),
    } as const;

    const q = new Query(
      "UPDATE test SET col = 'inline' WHERE id = $1",
      (rows) => rows,
    );
    // Only arg keys in arguments (SET values are inlined in prepare mode)
    q.arguments = ["bar"];

    const prepared = prequery(args, () =>
      Object.assign(Promise.resolve([]), { toQuery: () => q }),
    );

    const executor = (() => {
      return {
        query: async (_sql: string, _args?: (string | number | null)[]) => ({
          rows: [] as never[],
        }),
        execQuery(q: any) {
          return this.query(q.sql, q.arguments);
        },
        getRows: (res: any) => res.rows,
        connect: async () => {},
        close: async () => {},
      } as QueryExecutor;
    })();

    const dbStub = {
      $: { config: {} },
      _: { getExecutor: () => executor },
    } as unknown as AnyDBorTX;

    const pq = prepared.run(dbStub, { bar: 5 });

    // bar should be replaced with handler output (5 * 10 = 50)
    expect(pq.query.arguments).toEqual([50]);
  });
});
