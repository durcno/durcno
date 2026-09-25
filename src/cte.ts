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

// biome-ignore lint/suspicious/noExplicitAny: widened alias for constraint purposes
export type AnyCteWithColumns = CteWithColumns<any, any>;
