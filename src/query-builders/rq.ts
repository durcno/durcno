import type { QueryExecutor } from "../connectors/common";
import type { BuildFilterExpression } from "../filters/index";
import type { Config } from "../index";
import type {
  AnyColumn,
  AnyRelation,
  Fk,
  Many,
  Relations,
  StdRelations,
  StdTableWithColumns,
  TableWithColumns,
  TColsToLeftRight,
} from "../table";
import { snakeToCamel } from "../utils";
import type { OrderBy } from "./orderby-clause";
import { Query } from "./query";
import { QueryPromise } from "./query-promise";

type RelationReturnType<O, TRelation extends AnyRelation> =
  TRelation extends Many<any, any, any, any>
    ? O[]
    : TRelation extends Fk<any, any, any, infer TCol>
      ? TCol["isNotNull"] extends true
        ? O
        : O | null
      : O | null;

type OptionsBase<
  TTSchema extends string,
  TTName extends string,
  TTColumns extends Record<string, AnyColumn>,
  TAllRelations extends Record<string, StdRelations>,
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
  where?: BuildFilterExpression<
    TColsToLeftRight<
      TableWithColumns<TTSchema, TTName, TTColumns>["_"]["columns"]
    >
  >;
  orderBy?:
    | OrderBy<TableWithColumns<TTSchema, TTName, TTColumns>>
    | OrderBy<TableWithColumns<TTSchema, TTName, TTColumns>>[];
  limit?: number;
  with?: keyof TAllRelations[`"${TTSchema}"."${TTName}"`]["map"] extends never
    ? never
    : {
        [TRelationName in keyof TAllRelations[`"${TTSchema}"."${TTName}"`]["map"]]?: OptionsBase<
          TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TRelationName]["table"]["_"]["schema"],
          TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TRelationName]["table"]["_"]["name"],
          TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TRelationName]["table"]["_"]["cols"],
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
              TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TWith]["table"]["_"]["cols"],
              TAllRelations
            >
            ? RelationReturnType<
                {
                  [K in keyof Object<
                    TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TWith]["table"]["_"]["schema"],
                    TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TWith]["table"]["_"]["name"],
                    TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TWith]["table"]["_"]["cols"],
                    TAllRelations,
                    TNestedOptions
                  >]: Object<
                    TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TWith]["table"]["_"]["schema"],
                    TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TWith]["table"]["_"]["name"],
                    TAllRelations[`"${TTSchema}"."${TTName}"`]["map"][TWith]["table"]["_"]["cols"],
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
  readonly #config: Config;
  readonly #executor: QueryExecutor;
  constructor(
    table: TableWithColumns<TTSchema, TTName, TTColumns>,
    relations: TTRelations,
    allRelations: TAllRelations,
    config: Config,
    executor: QueryExecutor,
  ) {
    this.#table = table;
    this.#relations = relations;
    this.#allRelations = allRelations;
    this.#config = config;
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
      this.#config,
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
      this.#config,
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
  readonly #config: Config;
  readonly #executor: QueryExecutor;

  constructor(
    table: TableWithColumns<TTSchema, TTName, TTColumns>,
    relations: TTRelations,
    allRelations: TAllRelations,
    options: TOptions,
    config: Config,
    executor: QueryExecutor,
  ) {
    super();
    this.#table = table;
    this.#relations = relations;
    this.#allRelations = allRelations;
    this.#options = options;
    this.#config = config;
    this.#executor = executor;
  }

  toQuery() {
    const options = this.#options as StdOptionsBase;
    const query = new Query("SELECT ", this.handleRows.bind(this));

    const selects: string[] = [];
    if (
      options.columns === undefined ||
      Object.keys(options.columns).length === 0
    ) {
      for (const [, column] of Object.entries(this.#table._.columns)) {
        selects.push(column.fullName);
      }
    } else {
      if (Object.values(options.columns).at(0) === true) {
        for (const [colName, column] of Object.entries(this.#table._.columns)) {
          colName in options.columns && selects.push(column.fullName);
        }
      } else {
        for (const [colName, column] of Object.entries(this.#table._.columns)) {
          !(colName in options.columns) && selects.push(column.fullName);
        }
      }
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
            query.sql += buildRelationSubquery(
              key, // aliasPath at top level is just the key
              this.#table._.name, // parent table alias is the root table name
              o as StdOptionsBase,
              relation,
              this.#allRelations,
              this.#config,
            );
          }
        }
      }
    }
    if (options.where) {
      query.sql += ` WHERE ${options.where.toSQL()}`;
    }
    if (options.orderBy) {
      const orders = Array.isArray(options.orderBy)
        ? options.orderBy
        : [options.orderBy];
      query.sql += ` ORDER BY ${orders.map((o) => o.toSQL()).join(", ")}`;
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
    const res = await this.#executor.query(query.sql, query.arguments);
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
  if (
    options.columns === undefined ||
    Object.keys(options.columns).length === 0
  ) {
    for (const [colName, column] of Object.entries(table._.columns)) {
      selects.push(`'${colName}', "${alias}"."${column.nameSnake}"`);
    }
  } else {
    if (Object.values(options.columns).at(0) === true) {
      for (const [colName, column] of Object.entries(table._.columns)) {
        colName in options.columns &&
          selects.push(`'${colName}', "${alias}"."${column.nameSnake}"`);
      }
    } else {
      for (const [colName, column] of Object.entries(table._.columns)) {
        !(colName in options.columns) &&
          selects.push(`'${colName}', "${alias}"."${column.nameSnake}"`);
      }
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
          selects.push(`'${nestedKey}', "${alias}"."${nestedKey}_data"`);
        }
      }
    }
  }

  return selects;
}

/**
 * Build a LATERAL JOIN subquery for a relation, recursively handling nested relations.
 * Alias path format: "relationKey" for top-level, "parent__child" for nested (debuggable).
 *
 * @param aliasPath - The full alias path (e.g., "posts", "posts__comments")
 * @param parentTableAlias - The alias of the parent table (e.g., "users" for top-level, "posts" for nested)
 * @param options - The options for this relation
 * @param relation - The relation definition (Many, One, or Fk)
 * @param allRelations - All relations in the schema
 * @param config - The database config
 */
function buildRelationSubquery(
  aliasPath: string,
  parentTableAlias: string,
  options: StdOptionsBase,
  relation: AnyRelation,
  allRelations: Record<string, StdRelations>,
  config: Config,
): string {
  let sql = " LEFT JOIN LATERAL (";

  const jsonSelects = getJsonBuildObjectSelects(
    aliasPath,
    options,
    relation.table,
    allRelations,
  );

  if (relation.t === "Many") {
    sql += `SELECT coalesce(json_agg(json_build_object(${jsonSelects.join(", ")})), '[]'::json) AS "data"`;
  } else {
    // One or Fk
    sql += `SELECT json_build_object(${jsonSelects.join(", ")}) AS "data"`;
  }

  sql += ` FROM (SELECT "${aliasPath}".*`;

  // Add nested relation data columns to the inner select
  if (options.with) {
    const tableRelations = allRelations[relation.table._.fullName];
    if (tableRelations) {
      for (const nestedKey in options.with) {
        const nestedRelation = tableRelations.map[nestedKey];
        if (nestedRelation) {
          const nestedAliasPath = `${aliasPath}__${nestedKey}`;
          sql += `, "${nestedAliasPath}"."data" AS "${nestedKey}_data"`;
        }
      }
    }
  }

  sql += ` FROM ${relation.table._.fullName} "${aliasPath}"`;

  // Add nested LATERAL JOINs
  if (options.with) {
    const tableRelations = allRelations[relation.table._.fullName];
    if (tableRelations) {
      for (const nestedKey in options.with) {
        const nestedOptions = options.with[nestedKey];
        const nestedRelation = tableRelations.map[nestedKey];
        if (nestedRelation && nestedOptions) {
          const nestedAliasPath = `${aliasPath}__${nestedKey}`;
          sql += buildNestedRelationSubquery(
            nestedAliasPath,
            aliasPath,
            nestedOptions,
            nestedRelation,
            allRelations,
            config,
          );
        }
      }
    }
  }

  // Add WHERE clause for the relation join condition
  // For Many/One: relation.col is the FK column on the related table, references points to parent
  // For Fk: relation.col is the FK column on the parent table, table is the referenced table
  if (relation.t === "Many" || relation.t === "One") {
    const referencedCol = relation.col
      .referencesCol as unknown as AnyColumn | null;
    if (!referencedCol) {
      throw new Error(
        `Relation column "${relation.col.name}" has no .references() definition. ` +
          `Columns used in 'many' or 'one' relations must call .references() to define the join target.`,
      );
    }
    sql += ` WHERE "${aliasPath}"."${relation.col.nameSnake}" = "${parentTableAlias}"."${referencedCol.nameSnake}"`;
    if (relation.t === "One") {
      sql += ` LIMIT 1`;
    }
  } else if (relation.t === "Fk") {
    // For Fk: relation.col is the FK column on the parent, relation.table is the referenced table
    // We need to find the primary key of the referenced table (relation.table)
    const referencedCol = relation.col
      .referencesCol as unknown as AnyColumn | null;
    if (!referencedCol) {
      throw new Error(
        `Relation column "${relation.col.name}" has no .references() definition. ` +
          `Columns used in 'fk' relations must call .references() to define the join target.`,
      );
    }
    sql += ` WHERE "${aliasPath}"."${referencedCol.nameSnake}" = "${parentTableAlias}"."${relation.col.nameSnake}"`;
    sql += ` LIMIT 1`;
  }

  sql += `) "${aliasPath}"`;
  sql += `) "${aliasPath}" ON true`;

  return sql;
}

/**
 * Build a nested LATERAL JOIN subquery (for relations within relations).
 * Similar to buildRelationSubquery but with parent alias reference for WHERE conditions.
 */
function buildNestedRelationSubquery(
  aliasPath: string,
  parentAliasPath: string,
  options: StdOptionsBase,
  relation: AnyRelation,
  allRelations: Record<string, StdRelations>,
  config: Config,
): string {
  let sql = " LEFT JOIN LATERAL (";

  const jsonSelects = getJsonBuildObjectSelects(
    aliasPath,
    options,
    relation.table,
    allRelations,
  );

  if (relation.t === "Many") {
    sql += `SELECT coalesce(json_agg(json_build_object(${jsonSelects.join(", ")})), '[]'::json) AS "data"`;
  } else {
    sql += `SELECT json_build_object(${jsonSelects.join(", ")}) AS "data"`;
  }

  sql += ` FROM (SELECT "${aliasPath}".*`;

  // Add nested relation data columns
  if (options.with) {
    const tableRelations = allRelations[relation.table._.fullName];
    if (tableRelations) {
      for (const nestedKey in options.with) {
        const nestedRelation = tableRelations.map[nestedKey];
        if (nestedRelation) {
          const nestedAliasPath = `${aliasPath}__${nestedKey}`;
          sql += `, "${nestedAliasPath}"."data" AS "${nestedKey}_data"`;
        }
      }
    }
  }

  sql += ` FROM ${relation.table._.fullName} "${aliasPath}"`;

  // Recursively add nested LATERAL JOINs
  if (options.with) {
    const tableRelations = allRelations[relation.table._.fullName];
    if (tableRelations) {
      for (const nestedKey in options.with) {
        const nestedOptions = options.with[nestedKey];
        const nestedRelation = tableRelations.map[nestedKey];
        if (nestedRelation && nestedOptions) {
          const nestedAliasPath = `${aliasPath}__${nestedKey}`;
          sql += buildNestedRelationSubquery(
            nestedAliasPath,
            aliasPath,
            nestedOptions,
            nestedRelation,
            allRelations,
            config,
          );
        }
      }
    }
  }

  // WHERE clause with parent alias reference
  if (relation.t === "Many" || relation.t === "One") {
    const referencedCol = relation.col
      .referencesCol as unknown as AnyColumn | null;
    if (!referencedCol) {
      throw new Error(
        `Relation column "${relation.col.nameSnake}" has no .references() definition. ` +
          `Columns used in 'many' or 'one' relations must call .references() to define the join target.`,
      );
    }
    sql += ` WHERE "${aliasPath}"."${relation.col.nameSnake}" = "${parentAliasPath}"."${referencedCol.nameSnake}"`;
    if (relation.t === "One") {
      sql += ` LIMIT 1`;
    }
  } else if (relation.t === "Fk") {
    const referencedCol = relation.col
      .referencesCol as unknown as AnyColumn | null;
    if (!referencedCol) {
      throw new Error(
        `Relation column "${relation.col.nameSnake}" has no .references() definition. ` +
          `Columns used in 'fk' relations must call .references() to define the join target.`,
      );
    }
    sql += ` WHERE "${aliasPath}"."${referencedCol.nameSnake}" = "${parentAliasPath}"."${relation.col.nameSnake}"`;
    sql += ` LIMIT 1`;
  }

  sql += `) "${aliasPath}"`;
  sql += `) "${aliasPath}" ON true`;

  return sql;
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
