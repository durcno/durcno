/**
 * Benchmarks the compile cost of a prepared bulk `INSERT`: rows leave two
 * `$insertFn` columns out, so each row contributes two deferred placeholders.
 * No database is involved; the stub connector throws if a query is issued.
 *
 * The statement has no static argument, so every placeholder comes from a
 * generated value. Row counts are varied to show cost growth, while the rows
 * are built outside the measured region and hooks run only per `run()`.
 *
 * `pnpm bench`. Reading the numbers: AGENTS.md (Performance).
 */
import { database, defineConfig, prepare } from "durcno";
import { describe, test } from "vitest";
import * as schema from "./schema";
import { createStubConnector } from "./stub-connector";

const db = database(
  schema,
  defineConfig({
    schema: "./schema.ts",
    connector: createStubConnector(),
  }),
);

const ROW_COUNTS = [1, 100, 1000, 4000];

/** Rows that leave both `$insertFn` columns out, so each row adds two generated values. */
function rowsOf(count: number) {
  return Array.from({ length: count }, (_, i) => ({ label: `row ${i}` }));
}

describe("prepare — compile a bulk insert with generated values", () => {
  for (const rows of ROW_COUNTS) {
    const label = rows === 1 ? "row" : "rows";
    test(`prepare() — insert ${rows} ${label}, 2 generated values each`, async ({
      bench,
      task,
    }) => {
      const values = rowsOf(rows);
      await bench(task.name, () => {
        prepare({}, () =>
          db
            .prepare()
            .insertInto(schema.GeneratedRows)
            .values(values)
            .returning("*"),
        );
      }).run();
    });
  }
});
