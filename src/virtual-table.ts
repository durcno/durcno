import * as z from "zod";
import { Column } from "./columns/common";
import { isCol } from "./entity";
import type { AnySqlFn } from "./functions";
import type { AnyQuery } from "./query-builders/query";
import type { AnyQueryPromise } from "./query-builders/query-promise";
import type { Sql } from "./sql";
import {
  type AnyColumn,
  type StdTable,
  Table,
  type TableAnyColumn,
  type TableColumn,
  type UnwrapTableColumn,
} from "./table";
import type { Key } from "./types";

export type AnySelectableSource = AnyColumn | AnySqlFn;

export type AnySubquery = AnyQueryPromise & {
  toQuery(parentQuery?: AnyQuery): AnyQuery;
  getResolvedColumns(): Record<string, AnySelectableSource>;
};

type VirtualizedColumn<
  TVirtualName extends string,
  TKey extends Key,
  TColumn extends AnyColumn,
> = TableColumn<
  "",
  TVirtualName,
  TKey,
  VirtualColumn<UnwrapTableColumn<TColumn>>
>;

type VirtualizedSqlFn<
  TVirtualName extends string,
  TKey extends Key,
  TTsType,
  TPgType extends string,
> = TableColumn<
  "",
  TVirtualName,
  TKey,
  VirtualColumn<Column<Record<never, never>, TTsType, TPgType>>
>;

type MapSourcesToColumns<
  TVirtualName extends string,
  TSources extends Record<string, AnySelectableSource>,
> = {
  [K in keyof TSources]: TSources[K] extends TableAnyColumn<infer TCol>
    ? VirtualizedColumn<TVirtualName, K extends Key ? K : never, TCol>
    : TSources[K] extends {
          $: { TsType: infer TTsType; PgType: infer TPgType extends string };
        }
      ? VirtualizedSqlFn<
          TVirtualName,
          K extends Key ? K : never,
          TTsType,
          TPgType
        >
      : never;
};

export type InferQueryColumns<
  TVirtualName extends string,
  TQuery,
> = TQuery extends {
  getResolvedColumns(): infer TColumns extends Record<
    string,
    AnySelectableSource
  >;
}
  ? MapSourcesToColumns<TVirtualName, TColumns>
  : never;

class VirtualColumn<TColumn extends AnyColumn> extends Column<
  TColumn["config"],
  TColumn["$"]["TsType"],
  TColumn["$"]["PgType"]
> {
  readonly #source: AnySelectableSource;

  constructor(source: AnySelectableSource, config?: TColumn["config"]) {
    super(
      config ?? ((isCol(source) ? source.config : {}) as TColumn["config"]),
    );
    this.#source = source;
  }

  get sqlTypeScalar() {
    if (isCol(this.#source)) {
      return this.#source.sqlTypeScalar;
    }
    return this.#source.$.PgType;
  }

  get sqlCastScalar() {
    if (isCol(this.#source)) {
      return this.#source.sqlCastScalar;
    }
    return null;
  }

  get zodTypeScaler() {
    if (isCol(this.#source)) {
      return this.#source.zodTypeScaler;
    }
    return z.any();
  }

  toDriverScalar(value: TColumn["$"]["TsType"] | Sql | null) {
    if (isCol(this.#source)) {
      return this.#source.toDriverScalar(value as never);
    }
    return this.#source.toDriverValue(value as never) as string | number | null;
  }

  toSQLScalar(value: TColumn["$"]["TsType"] | Sql | null): string {
    if (isCol(this.#source)) {
      return this.#source.toSQLScalar(value as never);
    }
    return this.#source.toSQLValue(value as never);
  }

  fromDriverScalar(value: unknown): TColumn["$"]["TsType"] | null {
    if (isCol(this.#source)) {
      return this.#source.fromDriverScalar(value) as
        | TColumn["$"]["TsType"]
        | null;
    }
    return this.#source.fromDriverValue(value) as TColumn["$"]["TsType"] | null;
  }

  /** @internal */
  clone(): VirtualColumn<TColumn> {
    const cloned = new VirtualColumn<TColumn>(this.#source, this.config);
    if (this.name) cloned._.setName(this.name);
    if (this.table) cloned._.setTable(this.table as unknown as StdTable);
    return cloned;
  }

  /**
   * Creates a nullable clone — strips `notNull` and `primaryKey` from the config
   * while preserving the underlying selectable source.
   * @internal
   */
  cloneAsNullable(): Column<
    Omit<TColumn["config"], "notNull" | "primaryKey">,
    TColumn["$"]["TsType"],
    TColumn["$"]["PgType"]
  > {
    const {
      notNull: _nn,
      primaryKey: _pk,
      ...rest
    } = this.config as Record<string, unknown>;
    const cloned = new VirtualColumn<TColumn>(
      this.#source,
      rest as TColumn["config"],
    );
    if (this.name) cloned._.setName(this.name);
    if (this.table) cloned._.setTable(this.table as unknown as StdTable);
    return cloned as unknown as Column<
      Omit<TColumn["config"], "notNull" | "primaryKey">,
      TColumn["$"]["TsType"],
      TColumn["$"]["PgType"]
    >;
  }
}

function createVirtualColumns(
  sources: Record<string, AnySelectableSource>,
): Record<string, AnyColumn> {
  return Object.fromEntries(
    Object.entries(sources).map(([name, source]) => [
      name,
      new VirtualColumn(source as AnyColumn),
    ]),
  ) as Record<string, AnyColumn>;
}

export class VirtualTable<
  TName extends string,
  TColumns extends Record<string, AnyColumn>,
> extends Table<"", TName, TColumns> {
  declare readonly $isVirtual: true;

  readonly query: AnySubquery;

  constructor(
    name: TName,
    columns: Record<string, AnySelectableSource>,
    query: AnySubquery,
  ) {
    super("", name, createVirtualColumns(columns) as TColumns, {});
    this.query = query;
  }
}

// biome-ignore lint/suspicious/noExplicitAny: <>
export type AnyVirtualTable = VirtualTable<any, any>;

export function bindVirtualTableColumns<TVTable extends AnyVirtualTable>(
  vt: TVTable,
) {
  for (const colName in vt._.columns) {
    Object.defineProperty(vt, colName, {
      get() {
        return vt._.columns[colName];
      },
    });
  }
  return vt as TVTable & TVTable["_"]["columns"];
}
