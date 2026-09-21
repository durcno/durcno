import { is, isCol } from "./entity";
import { type AnySqlFn, SqlFn } from "./functions/index";
import { type AnyArg, Arg } from "./query-builders/prepare";
import type { Query, QueryContext } from "./query-builders/query";
import type { TableAnyColumn } from "./table";

export class Sql<TTsType = unknown> {
  readonly $!: {
    kind: "sql";
    TsType: TTsType;
  };

  readonly #strings: TemplateStringsArray;
  readonly #params: SqlParam[];

  constructor(strings: TemplateStringsArray | string, params: SqlParam[] = []) {
    if (typeof strings === "string") {
      this.#strings = Object.assign([strings], {
        raw: [strings],
      }) as TemplateStringsArray;
      this.#params = [];
    } else {
      this.#strings = strings;
      this.#params = params;
    }
  }

  /** Creates a Sql instance from a raw SQL string (no interpolation). */
  static raw<T = unknown>(s: string): Sql<T> {
    return new Sql<T>(s);
  }

  /** Represents a SQL NULL value with TypeScript return type `null`. */
  static readonly null: Sql<null> = new Sql<null>("NULL");

  get string(): string {
    return this.toSQL();
  }

  toSQL(): string {
    let s = "";
    this.#strings.forEach((str, i) => {
      s += str;
      const param = this.#params[i];
      if (param !== undefined) {
        if (is(param, Arg)) {
          throw new Error(
            "Cannot evaluate Sql containing prepared argument (Arg) without a query context",
          );
        } else if (isCol(param)) {
          s += param.fullName;
        } else if (param instanceof Sql) {
          s += param.toSQL();
        } else if (param instanceof SqlFn) {
          s += param.toSQL();
        } else {
          s += toSqlValue(param);
        }
      }
    });
    return s;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    this.#strings.forEach((str, i) => {
      query.sql += str;
      const param = this.#params[i];
      if (param !== undefined) {
        if (is(param, Arg)) {
          query.addArg(param);
        } else if (isCol(param)) {
          param.toQuery(query, ctx);
        } else if (param instanceof Sql) {
          param.toQuery(query, ctx);
        } else if (param instanceof SqlFn) {
          param.toQuery(query, ctx);
        } else {
          query.sql += toSqlValue(param);
        }
      }
    });
  }
}

type SqlParam =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | TableAnyColumn
  | AnyArg
  | Sql
  | AnySqlFn;

export function sql<T = unknown>(
  strings: TemplateStringsArray,
  ...params: SqlParam[]
): Sql<T> {
  return new Sql<T>(strings, params);
}

sql.raw = <T = unknown>(s: string): Sql<T> => Sql.raw<T>(s);
sql.null = Sql.null;

/**
 * Escapes a string for use as a double-quoted PostgreSQL identifier.
 * Doubles any embedded `"` characters: `foo"bar` -> `foo""bar`.
 */
export function escIdentifier(value: string): string {
  return value.replace(/"/g, '""');
}

/**
 * Escapes a string for use inside a single-quoted PostgreSQL literal.
 * Doubles any embedded `'` characters: `it's` -> `it''s`.
 */
export function escLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

export function toSqlValue(
  value:
    | string
    | number
    | bigint
    | boolean
    | null
    | undefined
    | TableAnyColumn
    | Sql
    | AnySqlFn,
): string {
  if (value === null || value === undefined) {
    return "NULL";
  } else if (value instanceof Sql) {
    return value.toSQL();
  } else if (value instanceof SqlFn) {
    return value.toSQL();
  } else if (typeof value === "string") {
    return `'${escLiteral(value)}'`;
  } else if (typeof value === "number" || typeof value === "bigint") {
    return value.toString();
  } else if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  } else if (isCol(value)) {
    return value.fullName;
  } else {
    return (value as { toSQL(): string }).toSQL();
  }
}
