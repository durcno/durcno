import type { QueryExecutor } from "../connectors/common";
import type { AnyCteWithColumns, CtesByName } from "../cte";
import type {
  AnyColumn,
  AnyTableWithColumns,
  TableWithColumns,
} from "../table";
import { DeleteQuery } from "./delete";
import { InsertBuilder } from "./insert";
import { SelectBuilder } from "./select";
import { UpdateBuilder } from "./update";

/**
 * List of CTEs to be attached to a query statement.
 * Created via `db.with(cte1, cte2, ...)` and provides `.from()`, `.insert()`,
 * `.update()`, and `.delete()` to build the query that uses the declared CTEs.
 */
export class WithStatement<
  TCtes extends AnyCteWithColumns[],
  TPrepare extends boolean,
> {
  readonly #ctes: TCtes;
  readonly #executor: QueryExecutor;
  readonly #prepare: TPrepare;

  constructor(ctes: TCtes, executor: QueryExecutor, prepare: TPrepare) {
    this.#ctes = ctes;
    this.#executor = executor;
    this.#prepare = prepare;
  }

  /**
   * SELECT from a real table with the declared CTEs in scope.
   * @param table The table to query.
   */
  from<TTable extends AnyTableWithColumns>(
    table: TTable,
  ): SelectBuilder<
    TTable["_"]["schema"],
    TTable["_"]["name"],
    TTable["_"]["columns"],
    TPrepare,
    null
  >;
  /**
   * Build the CTE name→instance map and call the callback to pick the FROM target.
   * @param cb Callback receiving the typed CTE map; return the CTE to query from.
   */
  from<TChosenCte extends AnyCteWithColumns>(
    cb: (ctes: CtesByName<TCtes>) => TChosenCte,
  ): SelectBuilder<
    "",
    TChosenCte["_"]["name"],
    TChosenCte["_"]["columns"],
    TPrepare,
    null
  >;
  from(
    tableOrCb:
      | TableWithColumns<string, string, Record<string, AnyColumn>>
      | ((ctes: CtesByName<TCtes>) => AnyCteWithColumns),
  ) {
    if (typeof tableOrCb === "function") {
      const cteMap = Object.fromEntries(
        this.#ctes.map((c) => [c._.name, c]),
      ) as CtesByName<TCtes>;
      const table = tableOrCb(cteMap);
      return new SelectBuilder(
        table,
        null,
        undefined,
        this.#executor,
        this.#prepare,
        this.#ctes,
      );
    }
    return new SelectBuilder(
      tableOrCb,
      null,
      undefined,
      this.#executor,
      this.#prepare,
      this.#ctes,
    );
  }

  /**
   * Start an INSERT into a real table with CTEs in scope.
   * @param table The table to insert into.
   */
  insert<TTable extends AnyTableWithColumns & { $isVirtual?: never }>(
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
  delete<TTable extends AnyTableWithColumns & { $isVirtual?: never }>(
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
