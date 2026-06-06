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
export type AnyCteWithColumns = CteWithColumns<any, Record<any, any>>;

/** Maps a tuple of `CteWithColumns` to an object keyed by CTE name. */
export type CtesByName<TCtes extends AnyCteWithColumns[]> = {
  [K in TCtes[number] as K extends { $cteName: infer TName extends string }
    ? TName
    : never]: K;
};
