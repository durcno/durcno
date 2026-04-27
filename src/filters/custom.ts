import type { Query } from "../query-builders/query";
import type { AnyColumn, TableColumn } from "../table";

/** Abstract base class for SQL filter expressions used in `WHERE`/`ON` clauses. */
export abstract class Filter<
  TColumn extends TableColumn<any, any, any, AnyColumn>,
> {
  readonly $Columns!: TColumn;
  abstract toQuery(query: Query): void;
}
