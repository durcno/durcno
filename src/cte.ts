import type { AnyColumn } from "./table";
import { VirtualTable } from "./virtual-table";

export class Cte<
  TName extends string,
  TColumns extends Record<string, AnyColumn>,
> extends VirtualTable<TName, TColumns> {
  /** Phantom type — extracts `TName` safely through `CteWithColumns` intersections. */
  declare readonly $cteName: TName;
}

export type CteWithColumns<
  TName extends string,
  TColumns extends Record<string, AnyColumn>,
> = Cte<TName, TColumns> & TColumns;

/** A CTE widened for use as a constraint; `Cte` is invariant in its columns. */
// biome-ignore lint/suspicious/noExplicitAny: Cte is invariant in its columns
export type AnyCteWithColumns = Cte<any, any>;
