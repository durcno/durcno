import type { QueryExecutor } from "../connectors/common";
import type { FilterExpression } from "../filters/index";
import type {
  AnyColumn,
  AnyRelation,
  Fk,
  Many,
  One,
  Relations,
  StdRelations,
  StdTableWithColumns,
  TableWithColumns,
} from "../table";
import type { Valueof } from "../types";
import { snakeToCamel } from "../utils";
import type {
  OrderExpression,
  StdOrder,
  StdOrderSqlFn,
} from "./orderby-clause";
import { Query, type QueryContext } from "./query";
import { QueryPromise } from "./query-promise";

type RelationReturnType<O, TRelation extends AnyRelation> =
  TRelation extends Many<any, any, any, any>
    ? O[]
    : TRelation extends Fk<any, any, any, infer TCol>
      ? TCol["isNotNull"] extends true
        ? O
        : O | null
      : O | null;

/**
 * Shared column-selection fields used across all option types.
 */
type ColumnsOption<
  TTSchema extends string,
  TTName extends string,
  TTColumns extends Record<string, AnyColumn>,
> = {
  columns?:
    | Partial<
        Record<
          keyof TableWithColumns<TTSchema, TTName, TTColumns>["_"]["columns"],
          true
        >
      >
    | Partial<
        Record<
          keyof TableWithColumns<TTSchema, TTName, TTColumns>["_"]["columns"],
          false
        >
      >;
};

/**
 * Options allowed for a nested `Fk` or `One` relation.
 * `where`, `orderBy`, and `limit` are excluded because the join condition
 * already uniquely identifies the row — further filtering is meaningless.
 */
type NestedOptionsFkOne<
  TTSchema extends string,
  TTName extends string,
  TTColumns extends Record<string, AnyColumn>,
  TAllRelations extends Record<string, StdRelations>,
> = ColumnsOption<TTSchema, TTName, TTColumns> & {
  with?: keyof TAllRelations[`"${TTSchema}"."${TTName}"`]["map"] extends never
    ? never
    : {
        [TRelationName in keyof TAllRelations[`"${TTSchema}"."${TTName}"`]["map"]]?: TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TRelationName] extends
          | Fk<any, any, any, any>
          | One<any, any, any, any>
          ? NestedOptionsFkOne<
              TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TRelationName]["table"]["_"]["schema"],
              TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TRelationName]["table"]["_"]["name"],
              TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TRelationName]["table"]["$"]["columns"],
              TAllRelations
            >
          : OptionsBase<
              TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TRelationName]["table"]["_"]["schema"],
              TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TRelationName]["table"]["_"]["name"],
              TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TRelationName]["table"]["$"]["columns"],
              TAllRelations
            >;
      };
};

type OptionsBase<
  TTSchema extends string,
  TTName extends string,
  TTColumns extends Record<string, AnyColumn>,
  TAllRelations extends Record<string, StdRelations>,
> = ColumnsOption<TTSchema, TTName, TTColumns> & {
  where?: FilterExpression<
    Valueof<TableWithColumns<TTSchema, TTName, TTColumns>["_"]["columns"]>
  >;
  orderBy?:
    | OrderExpression<TableWithColumns<TTSchema, TTName, TTColumns>, undefined>
    | OrderExpression<
        TableWithColumns<TTSchema, TTName, TTColumns>,
        undefined
      >[];
  limit?: number;
  with?: keyof TAllRelations[`"${TTSchema}"."${TTName}"`]["map"] extends never
    ? never
    : {
        [TRelationName in keyof TAllRelations[`"${TTSchema}"."${TTName}"`]["map"]]?: TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TRelationName] extends
          | Fk<any, any, any, any>
          | One<any, any, any, any>
          ? NestedOptionsFkOne<
              TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TRelationName]["table"]["_"]["schema"],
              TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TRelationName]["table"]["_"]["name"],
              TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TRelationName]["table"]["$"]["columns"],
              TAllRelations
            >
          : OptionsBase<
              TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TRelationName]["table"]["_"]["schema"],
              TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TRelationName]["table"]["_"]["name"],
              TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TRelationName]["table"]["$"]["columns"],
              TAllRelations
            >;
      };
};

type StdOptionsBase = OptionsBase<
  string,
  string,
  Record<string, AnyColumn>,
  Record<string, StdRelations>
>;

type Options<
  TTSchema extends string,
  TTName extends string,
  TTColumns extends Record<string, AnyColumn>,
  TAllRelations extends Record<string, StdRelations>,
  TOffset extends boolean = false,
> = OptionsBase<TTSchema, TTName, TTColumns, TAllRelations> & {
  offset?: TOffset extends true ? number : never;
};

type StdOptions = Options<
  string,
  string,
  Record<string, AnyColumn>,
  Record<string, StdRelations>
>;

type Object<
  TTSchema extends string,
  TTName extends string,
  TTColumns extends Record<string, AnyColumn>,
  TAllRelations extends Record<
    string,
    Relations<any, any, Record<any, any>, Record<any, AnyRelation>>
  >,
  TOptions extends OptionsBase<TTSchema, TTName, TTColumns, TAllRelations>,
> = (keyof TOptions["columns"] extends never
  ? TableWithColumns<TTSchema, TTName, TTColumns>["$"]["inferSelect"]
  : TOptions["columns"] extends Record<string, true>
    ? {
        [ColName in keyof TTColumns as TOptions["columns"][ColName] extends true
          ? ColName
          : never]: TTColumns[ColName]["ValTypeSelect"];
      }
    : TOptions["columns"] extends Record<string, false>
      ? {
          [ColName in keyof TTColumns as TOptions["columns"][ColName] extends false
            ? never
            : ColName]: TTColumns[ColName]["ValTypeSelect"];
        }
      : TableWithColumns<TTSchema, TTName, TTColumns>["$"]["inferSelect"]) &
  (keyof TOptions["with"] extends never
    ? Record<never, never>
    : {
        [TWith in keyof TOptions["with"]]: TOptions["with"][TWith] extends infer TNestedOptions
          ? TNestedOptions extends OptionsBase<
              TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TWith]["table"]["_"]["schema"],
              TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TWith]["table"]["_"]["name"],
              TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TWith]["table"]["$"]["columns"],
              TAllRelations
            >
            ? RelationReturnType<
                {
                  [K in keyof Object<
                    TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TWith]["table"]["_"]["schema"],
                    TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TWith]["table"]["_"]["name"],
                    TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TWith]["table"]["$"]["columns"],
                    TAllRelations,
                    TNestedOptions
                  >]: Object<
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
> {
  readonly #table: TableWithColumns<TTSchema, TTName, TTColumns>;
  readonly #relations: TTRelations;
  readonly #allRelations: TAllRelations;
  readonly #executor: QueryExecutor;
  constructor(
    table: TableWithColumns<TTSchema, TTName, TTColumns>,
    relations: TTRelations,
    allRelations: TAllRelations,
    executor: QueryExecutor,
  ) {
    this.#table = table;
    this.#relations = relations;
    this.#allRelations = allRelations;
    this.#executor = executor;
  }

  findMany<
    TOptions extends Options<TTSchema, TTName, TTColumns, TAllRelations, true>,
  >(options: TOptions) {
    return new RelationQuery(
      this.#table,
      this.#relations,
      this.#allRelations,
      options,
      this.#executor,
    );
  }

  async findFirst<
    TOptions extends Options<TTSchema, TTName, TTColumns, TAllRelations>,
  >(options: TOptions) {
    const query = new RelationQuery(
      this.#table,
      this.#relations,
      this.#allRelations,
      { ...options, limit: 1 },
      this.#executor,
    );
    const result = await query;
    return (result.at(0) ?? null) as
      | {
          [K in keyof Object<
            TTSchema,
            TTName,
            TTColumns,
            TAllRelations,
            TOptions
          >]: Object<TTSchema, TTName, TTColumns, TAllRelations, TOptions>[K];
        }
      | null;
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
  TOptions extends Options<TTSchema, TTName, TTColumns, TAllRelations, true>,
  TReturn = {
    [K in keyof Object<
      TTSchema,
      TTName,
      TTColumns,
      TAllRelations,
      TOptions
    >]: Object<TTSchema, TTName, TTColumns, TAllRelations, TOptions>[K];
  }[],
> extends QueryPromise<TReturn> {
  readonly #table: TableWithColumns<TTSchema, TTName, TTColumns>;
  readonly #relations: TTRelations;
  readonly #allRelations: TAllRelations;
  readonly #options: TOptions;
  readonly #executor: QueryExecutor;

  constructor(
    table: TableWithColumns<TTSchema, TTName, TTColumns>,
    relations: TTRelations,
    allRelations: TAllRelations,
    options: TOptions,
    executor: QueryExecutor,
  ) {
    super();
    this.#table = table;
    this.#relations = relations;
    this.#allRelations = allRelations;
    this.#options = options;
    this.#executor = executor;
  }

  toQuery() {
    const options = this.#options as StdOptionsBase;
    const query = new Query("SELECT ", this.handleRows.bind(this));

    const selects: string[] = [];
    for (const [, column] of getSelectedColumns(
      options.columns,
      this.#table._.columns,
    )) {
      selects.push(column.fullName);
    }
    const relations = this.#allRelations[this.#table._.fullName];
    if (relations) {
      if (options.with) {
        for (const key in options.with) {
          const relation = relations.map[key];
          if (relation) {
            // Use relation key as alias for top-level relations
            const select = `"${key}"."data" AS "${key}"`;
            selects.push(select);
          }
        }
      }
    }
    query.sql += selects.join(", ");

    query.sql += " FROM";
    query.sql += ` ${this.#table._.fullName} "${this.#table._.name}"`;
    if (options.with) {
      for (const key in options.with) {
        const o = options.with[key];
        const relations = this.#allRelations[this.#table._.fullName];
        if (relations) {
          const relation = relations.map[key];
          if (relation) {
            // Use path-based alias: top-level is just the key, nested use "__" separator
            // Parent table alias is the root table name for top-level relations
            buildRelationSubquery(
              query,
              key, // aliasPath at top level is just the key
              this.#table._.name, // parent table alias is the root table name
              o as StdOptionsBase,
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
    if (options.limit) query.sql += ` LIMIT ${options.limit}`;
    const optionsWithOffset = this.#options as StdOptions;
    if (optionsWithOffset.offset)
      query.sql += ` OFFSET ${optionsWithOffset.offset}`;
    query.sql += ";";
    return query;
  }

  async execute() {
    const query = this.toQuery();
    const res = await this.#executor.execQuery(query);
    const rows = this.#executor.getRows(res);
    return this.handleRows(rows);
  }

  handleRows(rows: Record<string, unknown>[]): TReturn {
    rows.forEach((row) => {
      convert(
        row,
        this.#table as unknown as StdTableWithColumns,
        this.#allRelations,
      );
    });
    return rows as TReturn;
  }
}

/**
 * Returns the [colName, column] entries to include based on the columns filter option.
 */
function getSelectedColumns(
  columns: StdOptionsBase["columns"],
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

/**
 * Build the json_build_object selects for a relation, including nested relations.
 * @param alias - The alias used for the inner subquery (e.g., "posts", "posts__comments")
 * @param options - The options for this relation
 * @param table - The table being selected from
 * @param allRelations - All relations in the schema
 */
function getJsonBuildObjectSelects(
  alias: string,
  options: StdOptionsBase,
  table: StdTableWithColumns,
  allRelations: Record<string, StdRelations>,
) {
  const selects: string[] = [];

  // Add column selects
  for (const [colName, column] of getSelectedColumns(
    options.columns,
    table._.columns,
  )) {
    selects.push(`'${colName}', "${alias}"."${column.nameSql}"`);
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
          selects.push(`'${nestedKey}', "${alias}"."${nestedKey}_data"`);
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
  options: StdOptionsBase,
  relation: AnyRelation,
  allRelations: Record<string, StdRelations>,
): void {
  query.sql += " LEFT JOIN LATERAL (";

  const jsonSelects = getJsonBuildObjectSelects(
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

  query.sql += ` FROM (SELECT "${aliasPath}".*`;

  if (nestedTableRelations) {
    for (const nestedKey in options.with) {
      const nestedRelation = nestedTableRelations.map[nestedKey];
      if (nestedRelation) {
        const nestedAliasPath = `${aliasPath}__${nestedKey}`;
        query.sql += `, "${nestedAliasPath}"."data" AS "${nestedKey}_data"`;
      }
    }
  }

  query.sql += ` FROM ${relation.table._.fullName} "${aliasPath}"`;

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
    const referencedCol = relation.col.getReferencesCol;
    if (!referencedCol) {
      throw new Error(
        `Relation column "${relation.col.name}"/${relation.col.nameSql} has no .references() definition. ` +
          `Columns used in 'many' or 'one' relations must call .references() to define the join target.`,
      );
    }
    query.sql += ` WHERE "${aliasPath}"."${relation.col.nameSql}" = "${parentTableAlias}"."${referencedCol.nameSql}"`;
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
    const referencedCol = relation.col.getReferencesCol;
    if (!referencedCol) {
      throw new Error(
        `Relation column "${relation.col.name}"/${relation.col.nameSql} has no .references() definition. ` +
          `Columns used in 'fk' relations must call .references() to define the join target.`,
      );
    }
    query.sql += ` WHERE "${aliasPath}"."${referencedCol.nameSql}" = "${parentTableAlias}"."${relation.col.nameSql}"`;
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

  query.sql += `) "${aliasPath}"`;
  query.sql += `) "${aliasPath}" ON true`;
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

function convert(
  object: Record<string, any>,
  table: StdTableWithColumns,
  allRelations: Record<string, StdRelations>,
) {
  for (const key of Object.keys(object)) {
    const value = object[key];
    const keyCamel = snakeToCamel(key);
    const column = table._.columns[keyCamel as string];
    if (column) {
      object[keyCamel] = column.fromDriver(value as never);
      if (keyCamel !== key) delete object[key];
    } else {
      const relations = allRelations[table._.fullName];
      if (relations) {
        const relation = relations.map[keyCamel as any];
        if (relation) {
          if (relation.t === "Many") {
            for (const row in object[key]) {
              convert(object[key][row], relation.table, allRelations);
            }
          } else if (relation.t === "One" || relation.t === "Fk") {
            if (object[key] !== null) {
              convert(object[key], relation.table, allRelations);
            }
          }
        }
      }
    }
  }
}
