import type { QueryExecutor } from "../connectors/common";
import { fk } from "../constraints/foreign-key";
import type { AnyCteWithColumns } from "../cte";
import { is, isTCol } from "../entity";
import type { FilterExpression } from "../filters/index";
import { type InferValueType, SqlFn } from "../functions/index";
import { escIdentifier, escLiteral } from "../sql";
import type {
  AnyColumn,
  AnyRelation,
  Relations,
  StdRelations,
  StdTableWithColumns,
  TableWithColumns,
} from "../table";
import type { SelfOrArray, Valueof } from "../types";
import { buildWithClause } from "./helpers";
import type {
  OrderExpression,
  StdOrder,
  StdOrderSqlFn,
} from "./orderby-clause";
import { Arg } from "./prepare";
import { type AnyQuery, Query, type QueryContext } from "./query";
import { QueryPromise } from "./query-promise";

type RelationReturnType<
  O,
  TRelation extends AnyRelation,
> = TRelation["t"] extends "Many"
  ? O[]
  : TRelation extends { t: "Fk"; col: infer TCol }
    ? TCol extends { isNotNull: true }
      ? O
      : O | null
    : O | null;

type AllOtps = {
  where: true;
  limit: true;
  offset: true;
  orderBy: true;
};

type NoOtps = {
  where: false;
  limit: false;
  offset: false;
  orderBy: false;
};

/**
 * A single aliased projection value in alias-based column selection.
 * Either a column of the queried table or a `SqlFn` scoped to that
 * table's columns (mirrors `.select()` projection values).
 */
type AliasedSelectItem<
  TTSchema extends string,
  TTName extends string,
  TTColumns extends Record<string, AnyColumn>,
  TPrepare extends boolean,
> =
  | Valueof<TableWithColumns<TTSchema, TTName, TTColumns>["_"]["columns"]>
  | SqlFn<
      Valueof<TableWithColumns<TTSchema, TTName, TTColumns>["_"]["columns"]>,
      TPrepare extends true ? boolean : false
    >;

type Options<
  TTSchema extends string,
  TTName extends string,
  TTColumns extends Record<string, AnyColumn>,
  TAllRelations extends Record<string, StdRelations>,
  TOpts extends {
    where: boolean;
    orderBy: boolean;
    limit: boolean;
    offset: boolean;
  } = {
    where: boolean;
    orderBy: boolean;
    limit: boolean;
    offset: boolean;
  },
  TPrepare extends boolean = boolean,
> = {
  columns?:
    | Partial<Record<keyof TTColumns, true>>
    | Partial<Record<keyof TTColumns, false>>;
  /**
   * Alias-based selection: `{ alias: column | SqlFn }`, mirroring
   * `.select()` projections. Mutually exclusive with `columns`
   * (enforced by `findMany`/`findFirst` overloads and at runtime).
   */
  select?: Record<
    string,
    AliasedSelectItem<TTSchema, TTName, TTColumns, TPrepare>
  >;
  where?: TOpts["where"] extends true
    ? FilterExpression<
        Valueof<TableWithColumns<TTSchema, TTName, TTColumns>["_"]["columns"]>,
        TPrepare
      >
    : never;
  orderBy?: TOpts["orderBy"] extends true
    ? SelfOrArray<
        OrderExpression<TableWithColumns<TTSchema, TTName, TTColumns>, TPrepare>
      >
    : never;
  limit?: TOpts["limit"] extends true
    ?
        | number
        | bigint
        | (TPrepare extends true ? Arg<number> | Arg<bigint> : never)
    : never;
  offset?: TOpts["offset"] extends true
    ?
        | number
        | bigint
        | (TPrepare extends true ? Arg<number> | Arg<bigint> : never)
    : never;
  with?: keyof TAllRelations[`"${TTSchema}"."${TTName}"`]["map"] extends never
    ? never
    : {
        [TRelationName in keyof TAllRelations[`"${TTSchema}"."${TTName}"`]["map"]]?: NestedOptions<
          TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TRelationName]["table"]["_"]["schema"],
          TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TRelationName]["table"]["_"]["name"],
          TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TRelationName]["table"]["$"]["columns"],
          TAllRelations,
          TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TRelationName]["t"] extends "Many"
            ? AllOtps
            : NoOtps,
          TPrepare
        >;
      };
};

/**
 * Nested relation options enforcing mutual exclusivity between `columns`
 * and `select` at compile time.
 */
type NestedOptions<
  TTSchema extends string,
  TTName extends string,
  TTColumns extends Record<string, AnyColumn>,
  TAllRelations extends Record<string, StdRelations>,
  TOpts extends {
    where: boolean;
    orderBy: boolean;
    limit: boolean;
    offset: boolean;
  },
  TPrepare extends boolean = boolean,
> =
  | (Options<TTSchema, TTName, TTColumns, TAllRelations, TOpts, TPrepare> & {
      select?: never;
    })
  | (Options<TTSchema, TTName, TTColumns, TAllRelations, TOpts, TPrepare> & {
      columns?: never;
    });

type StdOptions = Options<
  string,
  string,
  Record<string, AnyColumn>,
  Record<string, StdRelations>,
  any
>;

/**
 * Resolves the row shape for the boolean `columns` selection mode.
 * Handles include (`true`), exclude (`false`), and absent/empty (all) maps.
 * Membership guards keep indexing valid without altering the original
 * include/exclude semantics for keys missing from the map.
 */
type ColumnsRow<
  TTSchema extends string,
  TTName extends string,
  TTColumns extends Record<string, AnyColumn>,
  TColumnsOpt = unknown,
> = keyof TColumnsOpt extends never
  ? TableWithColumns<TTSchema, TTName, TTColumns>["$"]["inferSelect"]
  : TColumnsOpt extends Record<string, true>
    ? {
        [ColName in keyof TTColumns as ColName extends keyof NonNullable<TColumnsOpt>
          ? NonNullable<TColumnsOpt>[ColName] extends true
            ? ColName
            : never
          : never]: TTColumns[ColName]["ValTypeSelect"];
      }
    : TColumnsOpt extends Record<string, false>
      ? {
          [ColName in keyof TTColumns as ColName extends keyof NonNullable<TColumnsOpt>
            ? NonNullable<TColumnsOpt>[ColName] extends false
              ? never
              : ColName
            : ColName]: TTColumns[ColName]["ValTypeSelect"];
        }
      : TableWithColumns<TTSchema, TTName, TTColumns>["$"]["inferSelect"];

type Row<
  TTSchema extends string,
  TTName extends string,
  TTColumns extends Record<string, AnyColumn>,
  TAllRelations extends Record<
    string,
    Relations<any, any, Record<any, any>, Record<any, AnyRelation>>
  >,
  // biome-ignore lint/suspicious/noExplicitAny: allows both top-level Options and NestedOptions unions
  TOptions extends Record<string, any> = any,
> = (TOptions extends { select?: infer S }
  ? [S] extends [null | undefined]
    ? ColumnsRow<TTSchema, TTName, TTColumns, TOptions["columns"]>
    : [keyof S] extends [never]
      ? ColumnsRow<TTSchema, TTName, TTColumns, TOptions["columns"]>
      : {
          [Alias in keyof S]: InferValueType<S[Alias]>;
        }
  : ColumnsRow<TTSchema, TTName, TTColumns, TOptions["columns"]>) &
  (keyof TOptions["with"] extends never
    ? Record<never, never>
    : {
        [TWith in keyof TOptions["with"]]: TOptions["with"][TWith] extends infer TNestedOptions
          ? TNestedOptions extends Record<string, any>
            ? RelationReturnType<
                {
                  [K in keyof Row<
                    TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TWith]["table"]["_"]["schema"],
                    TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TWith]["table"]["_"]["name"],
                    TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TWith]["table"]["$"]["columns"],
                    TAllRelations,
                    TNestedOptions
                  >]: Row<
                    TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TWith]["table"]["_"]["schema"],
                    TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TWith]["table"]["_"]["name"],
                    TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TWith]["table"]["$"]["columns"],
                    TAllRelations,
                    TNestedOptions
                  >[K];
                },
                TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TWith]
              >
            : never
          : never;
      });

export class RelationQueryBuilder<
  TTSchema extends string,
  TTName extends string,
  TTColumns extends Record<string, AnyColumn>,
  TTRelations extends Relations<
    TTSchema,
    TTName,
    TTColumns,
    Record<any, AnyRelation>
  >,
  TAllRelations extends Record<string, StdRelations>,
  TPrepare extends boolean = false,
> {
  readonly #table: TableWithColumns<TTSchema, TTName, TTColumns>;
  readonly #relations: TTRelations;
  readonly #allRelations: TAllRelations;
  readonly #executor: QueryExecutor;
  readonly #prepare: TPrepare;
  readonly #ctes: readonly AnyCteWithColumns[] | null;
  constructor(
    table: TableWithColumns<TTSchema, TTName, TTColumns>,
    relations: TTRelations,
    allRelations: TAllRelations,
    executor: QueryExecutor,
    prepare: TPrepare,
    ctes: readonly AnyCteWithColumns[] | null = null,
  ) {
    this.#table = table;
    this.#relations = relations;
    this.#allRelations = allRelations;
    this.#executor = executor;
    this.#prepare = prepare;
    this.#ctes = ctes;
  }

  findMany<
    TOptions extends Options<
      TTSchema,
      TTName,
      TTColumns,
      TAllRelations,
      AllOtps,
      TPrepare
    > & { select?: never },
  >(
    options: TOptions,
  ): RelationQuery<
    TTSchema,
    TTName,
    TTColumns,
    TTRelations,
    TAllRelations,
    TOptions
  >;
  findMany<
    TOptions extends Options<
      TTSchema,
      TTName,
      TTColumns,
      TAllRelations,
      AllOtps,
      TPrepare
    > & { columns?: never },
  >(
    options: TOptions,
  ): RelationQuery<
    TTSchema,
    TTName,
    TTColumns,
    TTRelations,
    TAllRelations,
    TOptions
  >;
  findMany(
    options: Options<
      TTSchema,
      TTName,
      TTColumns,
      TAllRelations,
      AllOtps,
      TPrepare
    >,
  ) {
    return new RelationQuery(
      this.#table,
      this.#relations,
      this.#allRelations,
      options,
      this.#executor,
      this.#ctes,
    );
  }

  async findFirst<
    TOptions extends Options<
      TTSchema,
      TTName,
      TTColumns,
      TAllRelations,
      Omit<NoOtps, "where" | "orderBy"> & {
        where: true;
        orderBy: true;
      },
      TPrepare
    > & { select?: never },
  >(
    options: TOptions,
  ): Promise<
    | Awaited<
        RelationQuery<
          TTSchema,
          TTName,
          TTColumns,
          TTRelations,
          TAllRelations,
          TOptions
        >
      >[number]
    | null
  >;
  async findFirst<
    TOptions extends Options<
      TTSchema,
      TTName,
      TTColumns,
      TAllRelations,
      Omit<NoOtps, "where" | "orderBy"> & {
        where: true;
        orderBy: true;
      },
      TPrepare
    > & { columns?: never },
  >(
    options: TOptions,
  ): Promise<
    | Awaited<
        RelationQuery<
          TTSchema,
          TTName,
          TTColumns,
          TTRelations,
          TAllRelations,
          TOptions
        >
      >[number]
    | null
  >;
  async findFirst(
    options: Options<
      TTSchema,
      TTName,
      TTColumns,
      TAllRelations,
      Omit<NoOtps, "where" | "orderBy"> & {
        where: true;
        orderBy: true;
      },
      TPrepare
    >,
  ): Promise<
    | Awaited<
        RelationQuery<
          TTSchema,
          TTName,
          TTColumns,
          TTRelations,
          TAllRelations,
          // biome-ignore lint/suspicious/noExplicitAny: implementation signature
          any
        >
      >[number]
    | null
  > {
    const query = new RelationQuery(
      this.#table,
      this.#relations,
      this.#allRelations,
      { ...options, limit: 1 },
      this.#executor,
      this.#ctes,
    );
    const result = await query;
    // biome-ignore lint/suspicious/noExplicitAny: <>
    return (result.at(0) ?? null) as any;
  }
}

class RelationQuery<
  TTSchema extends string,
  TTName extends string,
  TTColumns extends Record<string, AnyColumn>,
  TTRelations extends Relations<
    TTSchema,
    TTName,
    TTColumns,
    Record<any, AnyRelation>
  >,
  TAllRelations extends Record<string, StdRelations>,
  TOptions extends Options<
    TTSchema,
    TTName,
    TTColumns,
    TAllRelations,
    any,
    any
  >,
  TReturn = {
    [K in keyof Row<TTSchema, TTName, TTColumns, TAllRelations, TOptions>]: Row<
      TTSchema,
      TTName,
      TTColumns,
      TAllRelations,
      TOptions
    >[K];
  }[],
> extends QueryPromise<TReturn> {
  readonly #table: TableWithColumns<TTSchema, TTName, TTColumns>;
  readonly #relations: TTRelations;
  readonly #allRelations: TAllRelations;
  readonly #options: TOptions;
  readonly #executor: QueryExecutor;
  readonly #ctes: readonly AnyCteWithColumns[] | null;

  constructor(
    table: TableWithColumns<TTSchema, TTName, TTColumns>,
    relations: TTRelations,
    allRelations: TAllRelations,
    options: TOptions,
    executor: QueryExecutor,
    ctes: readonly AnyCteWithColumns[] | null = null,
  ) {
    super();
    this.#table = table;
    this.#relations = relations;
    this.#allRelations = allRelations;
    this.#options = options;
    this.#executor = executor;
    this.#ctes = ctes;
  }

  toQuery(parentQuery?: AnyQuery): Query<TReturn> {
    const isRoot = parentQuery === undefined;
    const options = this.#options;
    const query: Query<TReturn> = parentQuery
      ? (parentQuery as unknown as Query<TReturn>)
      : new Query("", this.handleRows.bind(this));

    if (isRoot && this.#ctes?.length) {
      buildWithClause(this.#ctes, query);
    }

    query.sql += "SELECT ";

    const selects: string[] = [];
    const selectEntries = getSelectEntries(options);
    if (selectEntries) {
      validateAliasKeys(
        options.select as Record<string, unknown>,
        options.with as Record<string, unknown> | undefined,
      );
      for (const [alias, expr] of selectEntries) {
        validateAliasExpr(
          expr,
          this.#table as unknown as StdTableWithColumns,
          alias,
        );
        const fragment = renderAliasedExpr(query, expr);
        selects.push(`${fragment} AS "${escIdentifier(alias)}"`);
      }
    } else {
      for (const [colName, column] of getSelectedColumns(
        options.columns,
        this.#table._.columns,
      )) {
        selects.push(`${column.fullName} AS "${escIdentifier(colName)}"`);
      }
    }
    const relations = this.#allRelations[this.#table._.fullName];
    if (relations) {
      if (options.with) {
        for (const key in options.with) {
          const relation = relations.map[key];
          if (relation) {
            // Use relation key as alias for top-level relations
            selects.push(
              `"${escIdentifier(key)}"."data" AS "${escIdentifier(key)}"`,
            );
          }
        }
      }
    }
    query.sql += selects.join(", ");

    query.sql += " FROM";
    query.sql += ` ${this.#table._.fullName} "${escIdentifier(this.#table._.nameSql)}"`;
    if (options.with) {
      for (const key in options.with) {
        const otps = options.with[key];
        const relations = this.#allRelations[this.#table._.fullName];
        if (relations) {
          const relation = relations.map[key];
          if (relation) {
            // Use path-based alias: top-level is just the key, nested use "__" separator
            // Parent table alias is the root table name (snake_case) for top-level relations
            buildRelationSubquery(
              query,
              key, // aliasPath at top level is just the key
              this.#table._.nameSql, // parent table alias is the root table name (snake_case)
              otps as StdOptions,
              relation,
              this.#allRelations,
            );
          }
        }
      }
    }
    if (options.where) {
      query.sql += " WHERE ";
      options.where.toQuery(query);
    }
    if (options.orderBy) {
      const orders = (
        Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy]
      ) as (StdOrder | StdOrderSqlFn)[];
      orderByToQuery(orders, query);
    }
    if (options.limit !== undefined) {
      query.sql += " LIMIT ";
      if (is(options.limit, Arg<number | bigint>)) {
        query.addArg(options.limit);
      } else {
        query.sql += options.limit.toString();
      }
    }
    if (options.offset !== undefined) {
      query.sql += " OFFSET ";
      if (is(options.offset, Arg<number | bigint>)) {
        query.addArg(options.offset);
      } else {
        query.sql += options.offset.toString();
      }
    }
    query.sql += ";";
    return query;
  }

  async execute() {
    const query = this.toQuery();
    const res = await this.#executor.execQuery(query);
    const rows = this.#executor.getRows(res);
    return this.handleRows(rows);
  }

  #convertCtx?: ConvertContext;

  #getConvertCtx(): ConvertContext {
    if (!this.#convertCtx) {
      this.#convertCtx = buildConvertContext(
        this.#options as unknown as OptionsView,
      );
    }
    return this.#convertCtx;
  }

  handleRows(rows: Record<string, unknown>[]): TReturn {
    if (rows.length === 0) return rows as TReturn;
    const ctx = this.#getConvertCtx();
    for (let i = 0; i < rows.length; i++) {
      convert(
        rows[i],
        this.#table as unknown as StdTableWithColumns,
        this.#allRelations,
        ctx,
      );
    }
    return rows as TReturn;
  }
}

/**
 * Returns the [colName, column] entries to include based on the columns filter option.
 */
function getSelectedColumns(
  columns: StdOptions["columns"],
  tableColumns: Record<string, AnyColumn>,
): [string, AnyColumn][] {
  const entries = Object.entries(tableColumns) as [string, AnyColumn][];
  if (columns === undefined || Object.keys(columns).length === 0) {
    return entries;
  }
  if (Object.values(columns).at(0) === true) {
    return entries.filter(([colName]) => colName in columns);
  }
  return entries.filter(([colName]) => !(colName in columns));
}

/** Structural view of relational options used by runtime helpers. */
type OptionsView = {
  select?: Record<string, unknown> | undefined;
  columns?: Record<string, unknown> | undefined;
  with?: Record<string, OptionsView | undefined> | undefined;
};

/**
 * Returns validated [alias, expr] entries when `select` is present and
 * non-empty, otherwise null (fall back to `columns`).
 * @throws If both `select` and `columns` select entries at the same level.
 */
function getSelectEntries(options: OptionsView): [string, unknown][] | null {
  const select = options.select as Record<string, unknown> | undefined;
  if (select === undefined || Object.keys(select).length === 0) {
    return null;
  }
  const columns = options.columns as Record<string, unknown> | undefined;
  if (columns !== undefined && Object.keys(columns).length > 0) {
    throw new Error(
      "Relational `select` and `columns` are mutually exclusive. Use one or the other at each level (including inside `with`).",
    );
  }
  return Object.entries(select);
}

/** Rejects empty aliases and aliases colliding with sibling relation keys. */
function validateAliasKeys(
  select: Record<string, unknown>,
  withOptions: Record<string, unknown> | undefined,
): void {
  for (const alias of Object.keys(select)) {
    if (alias.length === 0) {
      throw new Error("Relational `select` alias names must be non-empty.");
    }
    if (withOptions && alias in withOptions) {
      throw new Error(
        `Relational \`select\` alias "${alias}" collides with a \`with\` relation key at the same level. Rename the alias.`,
      );
    }
  }
}

/** Validates a single `select` value belongs to the queried table. */
function validateAliasExpr(
  expr: unknown,
  table: StdTableWithColumns,
  alias: string,
): void {
  if (isTCol(expr)) {
    const exprTable = (
      expr as unknown as { table?: { _: { schema: string; name: string } } }
    ).table;
    if (
      exprTable &&
      (exprTable._.schema !== table._.schema ||
        exprTable._.name !== table._.name)
    ) {
      throw new Error(
        `Relational \`select\` alias "${alias}" references a column from another table. Only columns of the queried table are allowed.`,
      );
    }
    return;
  }
  if (expr instanceof SqlFn) {
    if (expr.isAggregate) {
      throw new Error(
        "Aggregate functions are not supported in relational `select`. Use scalar columns or scalar SqlFns (e.g. `lower(...)`).",
      );
    }
    return;
  }
  throw new Error(
    `Relational \`select\` alias "${alias}" must be a table column or SqlFn.`,
  );
}

/**
 * Renders a column/`SqlFn` expression to a SQL fragment, preserving
 * `query.arguments` placeholder indices by slicing the appended SQL.
 */
function renderAliasedExpr(
  query: Query,
  expr: unknown,
  ctx?: QueryContext,
): string {
  const marker = query.sql.length;
  if (isTCol(expr)) {
    (expr as { toQuery: (q: Query, c?: QueryContext) => void }).toQuery(
      query,
      ctx,
    );
  } else {
    (expr as SqlFn<AnyColumn, boolean>).toQuery(query, ctx);
  }
  const fragment = query.sql.slice(marker);
  query.sql = query.sql.slice(0, marker);
  return fragment;
}

/**
 * Build the json_build_object selects for a relation, including nested relations.
 * @param query - The query object (used to render alias-mode expressions with correct arg indices)
 * @param alias - The alias used for the inner subquery (e.g., "posts", "posts__comments")
 * @param options - The options for this relation
 * @param table - The table being selected from
 * @param allRelations - All relations in the schema
 */
function getJsonBuildObjectSelects(
  query: Query,
  alias: string,
  options: StdOptions,
  table: StdTableWithColumns,
  allRelations: Record<string, StdRelations>,
) {
  const selects: string[] = [];

  // Add column selects
  const selectEntries = getSelectEntries(options);
  if (selectEntries) {
    validateAliasKeys(
      options.select as Record<string, unknown>,
      options.with as Record<string, unknown> | undefined,
    );
    const ctx: QueryContext = {
      tableAliases: new Map([[`${table._.schema}.${table._.name}`, alias]]),
    };
    for (const [outKey, expr] of selectEntries) {
      validateAliasExpr(expr, table, outKey);
      const fragment = renderAliasedExpr(query, expr, ctx);
      selects.push(`'${escLiteral(outKey)}', ${fragment}`);
    }
  } else {
    for (const [colName, column] of getSelectedColumns(
      options.columns,
      table._.columns,
    )) {
      selects.push(
        `'${escLiteral(colName)}', "${escIdentifier(alias)}"."${escIdentifier(column.nameSql ?? "")}"`,
      );
    }
  }

  // Add nested relation selects
  if (options.with) {
    const tableRelations = allRelations[table._.fullName];
    if (tableRelations) {
      for (const nestedKey in options.with) {
        const nestedRelation = tableRelations.map[nestedKey];
        if (nestedRelation) {
          // The inner subquery aliases nested data as "${nestedKey}_data",
          // and the inner subquery itself is aliased as "${alias}",
          // so we reference "${alias}"."${nestedKey}_data"
          selects.push(
            `'${escLiteral(nestedKey)}', "${escIdentifier(alias)}"."${escIdentifier(nestedKey)}_data"`,
          );
        }
      }
    }
  }

  return selects;
}

/**
 * Build a LATERAL JOIN subquery for a relation, recursively handling nested relations.
 * Mutates query.sql directly to avoid intermediate string allocations.
 * Alias path format: "relationKey" for top-level, "parent__child" for nested (debuggable).
 *
 * @param query - The query object to mutate
 * @param aliasPath - The full alias path (e.g., "posts", "posts__comments")
 * @param parentTableAlias - The alias of the parent table (e.g., "users" for top-level, "posts" for nested)
 * @param options - The options for this relation
 * @param relation - The relation definition (Many, One, or Fk)
 * @param allRelations - All relations in the schema
 */
function buildRelationSubquery(
  query: Query,
  aliasPath: string,
  parentTableAlias: string,
  options: StdOptions,
  relation: AnyRelation,
  allRelations: Record<string, StdRelations>,
): void {
  query.sql += " LEFT JOIN LATERAL (";

  const jsonSelects = getJsonBuildObjectSelects(
    query,
    aliasPath,
    options,
    relation.table,
    allRelations,
  );

  if (relation.t === "Many") {
    query.sql += `SELECT coalesce(json_agg(json_build_object(${jsonSelects.join(", ")})), '[]'::json) AS "data"`;
  } else {
    // One or Fk
    query.sql += `SELECT json_build_object(${jsonSelects.join(", ")}) AS "data"`;
  }

  const nestedTableRelations = options.with
    ? allRelations[relation.table._.fullName]
    : undefined;

  query.sql += ` FROM (SELECT "${escIdentifier(aliasPath)}".*`;

  if (nestedTableRelations) {
    for (const nestedKey in options.with) {
      const nestedRelation = nestedTableRelations.map[nestedKey];
      if (nestedRelation) {
        const nestedAliasPath = `${aliasPath}__${nestedKey}`;
        query.sql += `, "${escIdentifier(nestedAliasPath)}"."data" AS "${escIdentifier(nestedKey)}_data"`;
      }
    }
  }

  query.sql += ` FROM ${relation.table._.fullName} "${escIdentifier(aliasPath)}"`;

  if (nestedTableRelations) {
    for (const nestedKey in options.with) {
      const nestedOptions = options.with[nestedKey];
      const nestedRelation = nestedTableRelations.map[nestedKey];
      if (nestedRelation && nestedOptions) {
        const nestedAliasPath = `${aliasPath}__${nestedKey}`;
        buildRelationSubquery(
          query,
          nestedAliasPath,
          aliasPath,
          nestedOptions,
          nestedRelation,
          allRelations,
        );
      }
    }
  }

  // Add WHERE clause for the relation join condition
  // For Many/One: relation.col is the FK column on the related table, references points to parent
  // For Fk: relation.col is the FK column on the parent table, table is the referenced table
  if (relation.t === "Many" || relation.t === "One") {
    let referencedCol = relation.col.getReferencesCol;
    if (!referencedCol) {
      const tableExtraFks =
        relation.col.table?._.extra.foreignKeys?.(
          relation.col.table as StdTableWithColumns,
          fk,
        ) ?? [];
      const foundFk = tableExtraFks.find(
        (f) => f._.getColumn().name === relation.col.name,
      );
      if (foundFk) {
        referencedCol = foundFk._.getReference();
      }
    }

    if (!referencedCol) {
      throw new Error(
        `Relation column "${relation.col.name}"/${relation.col.nameSql} has no .references() definition. ` +
          `Columns used in 'many' or 'one' relations must call .references() to define the join target.`,
      );
    }
    query.sql += ` WHERE "${escIdentifier(aliasPath)}"."${escIdentifier(relation.col.nameSql)}" = "${escIdentifier(parentTableAlias)}"."${escIdentifier(referencedCol.nameSql)}"`;
    // Apply user-supplied where filter on top of the join condition (Many only)
    if (relation.t === "Many" && options.where) {
      const ctx: QueryContext = {
        tableAliases: new Map([
          [`${relation.table._.schema}.${relation.table._.name}`, aliasPath],
        ]),
      };
      query.sql += " AND ";
      options.where.toQuery(query, ctx);
    }
    if (relation.t === "One") {
      query.sql += ` LIMIT 1`;
    }
  } else if (relation.t === "Fk") {
    // For Fk: relation.col is the FK column on the parent, relation.table is the referenced table
    // We need to find the primary key of the referenced table (relation.table)
    let referencedCol = relation.col.getReferencesCol;
    if (!referencedCol) {
      const tableExtraFks =
        relation.col.table?._.extra.foreignKeys?.(
          relation.col.table as StdTableWithColumns,
          fk,
        ) ?? [];
      const foundFk = tableExtraFks.find(
        (f) => f._.getColumn().name === relation.col.name,
      );
      if (foundFk) {
        referencedCol = foundFk._.getReference();
      }
    }

    if (!referencedCol) {
      throw new Error(
        `Relation column "${relation.col.name}"/${relation.col.nameSql} has no .references() definition. ` +
          `Columns used in 'fk' relations must call .references() to define the join target.`,
      );
    }
    query.sql += ` WHERE "${escIdentifier(aliasPath)}"."${escIdentifier(referencedCol.nameSql)}" = "${escIdentifier(parentTableAlias)}"."${escIdentifier(relation.col.nameSql)}"`;
    query.sql += ` LIMIT 1`;
  }

  // Apply user-supplied orderBy and limit for Many relations
  if (relation.t === "Many") {
    if (options.orderBy) {
      const orders = (
        Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy]
      ) as (StdOrder | StdOrderSqlFn)[];
      const ctx: QueryContext = {
        tableAliases: new Map([
          [`${relation.table._.schema}.${relation.table._.name}`, aliasPath],
        ]),
      };
      orderByToQuery(orders, query, ctx);
    }
    if (options.limit) query.sql += ` LIMIT ${options.limit}`;
  }

  query.sql += `) "${escIdentifier(aliasPath)}"`;
  query.sql += `) "${escIdentifier(aliasPath)}" ON true`;
}

/** Appends an ORDER BY clause for `orders` to `query.sql`. */
function orderByToQuery(
  orders: (StdOrder | StdOrderSqlFn)[],
  query: Query,
  ctx?: QueryContext,
): void {
  query.sql += " ORDER BY ";
  for (let i = 0; i < orders.length; i++) {
    orders[i].toQuery(query, ctx);
    if (i < orders.length - 1) query.sql += ", ";
  }
}

/** Precomputed conversion context for a level in the relation tree. */
type ConvertContext = {
  aliasMap: Map<string, unknown> | null;
  with?: Record<string, ConvertContext> | undefined;
};

/**
 * Builds the conversion context tree once for the given options,
 * avoiding per-row Map allocations and validations during row conversion.
 */
function buildConvertContext(options?: OptionsView): ConvertContext {
  const selectEntries = options ? getSelectEntries(options) : null;
  const aliasMap = selectEntries ? new Map(selectEntries) : null;
  let nestedWith: Record<string, ConvertContext> | undefined;
  if (options?.with) {
    for (const key of Object.keys(options.with)) {
      const nestedOpts = options.with[key];
      if (nestedOpts) {
        if (!nestedWith) nestedWith = {};
        nestedWith[key] = buildConvertContext(nestedOpts);
      }
    }
  }
  return { aliasMap, with: nestedWith };
}

function convert(
  object: Record<string, any>,
  table: StdTableWithColumns,
  allRelations: Record<string, StdRelations>,
  ctx?: ConvertContext,
) {
  const aliasMap = ctx?.aliasMap;
  for (const key of Object.keys(object)) {
    const aliased = aliasMap?.get(key);
    if (aliased !== undefined) {
      if (isTCol(aliased)) {
        object[key] = aliased.fromDriver(object[key]);
      } else if (aliased instanceof SqlFn) {
        object[key] = aliased.fromDriverValue(object[key]);
      }
      continue;
    }
    const column = table._.columns[key];
    if (column) {
      object[key] = column.fromDriver(object[key]);
    } else {
      const relations = allRelations[table._.fullName];
      if (relations) {
        const relation = relations.map[key];
        if (relation) {
          const nestedCtx = ctx?.with?.[key];
          if (relation.t === "Many") {
            for (let i = 0; i < object[key].length; i++) {
              convert(object[key][i], relation.table, allRelations, nestedCtx);
            }
          } else if (relation.t === "One" || relation.t === "Fk") {
            if (object[key] !== null) {
              convert(object[key], relation.table, allRelations, nestedCtx);
            }
          }
        }
      }
    }
  }
}
