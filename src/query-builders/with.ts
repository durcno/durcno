import type { QueryExecutor } from "../connectors/common";
import type { AnyCteWithColumns } from "../cte";
import type {
  AnyColumn,
  AnyRelations,
  AnyTableWithColumns,
  StdTableFullName,
  TableWithColumns,
} from "../table";
import { DeleteQuery } from "./delete";
import { InsertBuilder } from "./insert";
import { RelationQueryBuilder } from "./rq";
import { SelectBuilder } from "./select";
import { UpdateBuilder } from "./update";

/**
 * List of CTEs to be attached to a query statement.
 * Created via `db.with(cte1, cte2, ...)` and provides `.from()`, `.insertInto()`,
 * `.update()`, `.deleteFrom()`, and `.query()` to build the query that uses the declared CTEs.
 */
export class WithStatement<
  TCtes extends AnyCteWithColumns[],
  TAllRelations extends Record<StdTableFullName, AnyRelations>,
  TPrepare extends boolean,
> {
  readonly #ctes: TCtes;
  readonly #allRelations: TAllRelations;
  readonly #executor: QueryExecutor;
  readonly #prepare: TPrepare;

  constructor(
    ctes: TCtes,
    allRelations: TAllRelations,
    executor: QueryExecutor,
    prepare: TPrepare,
  ) {
    this.#ctes = ctes;
    this.#allRelations = allRelations;
    this.#executor = executor;
    this.#prepare = prepare;
  }

  /**
   * SELECT from a real table or a CTE with the declared CTEs in scope.
   * CTEs are used like normal tables — pass the CTE instance directly
   * and reference its columns directly (e.g. `activeUsers.username`).
   * @param table The table or CTE to query.
   */
  from<
    UTSchema extends string,
    UTName extends string,
    UTColumns extends Record<string, AnyColumn>,
  >(
    table: TableWithColumns<UTSchema, UTName, UTColumns>,
  ): SelectBuilder<UTSchema, UTName, UTColumns, TPrepare, null> {
    return new SelectBuilder(
      table,
      null,
      undefined,
      this.#executor,
      this.#prepare,
      this.#ctes,
    );
  }

  /**
   * Start building a relational query for the specified table with CTEs declared in the WITH clause.
   *
   * @param table The table to query — must have relations registered via `relations()`.
   * @returns A `RelationQueryBuilder` with `.findMany()` and `.findFirst()` methods.
   */
  query<
    UTSchema extends string,
    UTName extends string,
    TColumns extends Record<string, AnyColumn>,
  >(
    table: TableWithColumns<UTSchema, UTName, TColumns> & {
      $isVirtual?: never;
    },
  ) {
    return new RelationQueryBuilder(
      table,
      this.#allRelations[table._.fullName],
      this.#allRelations,
      this.#executor,
      this.#prepare,
      this.#ctes,
    );
  }

  /**
   * Start an INSERT into a real table with CTEs in scope.
   * @param table The table to insert into.
   */
  insertInto<TTable extends AnyTableWithColumns & { $isVirtual?: never }>(
    table: TTable,
  ) {
    return new InsertBuilder(table, this.#executor, this.#prepare, this.#ctes);
  }

  /**
   * Start an UPDATE on a real table with CTEs declared in the WITH clause.
   * @param table The table to update.
   */
  update<TTable extends AnyTableWithColumns & { $isVirtual?: never }>(
    table: TTable,
  ) {
    return new UpdateBuilder(table, this.#executor, this.#prepare, this.#ctes);
  }

  /**
   * Start a DELETE from a real table with CTEs declared in the WITH clause.
   * @param table The table to delete from.
   */
  deleteFrom<TTable extends AnyTableWithColumns & { $isVirtual?: never }>(
    table: TTable,
  ) {
    return new DeleteQuery(
      table,
      undefined,
      undefined,
      this.#executor,
      this.#prepare,
      this.#ctes,
    );
  }
}
