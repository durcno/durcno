import { is, isCol } from "./entity";
import { type AnyArg, Arg } from "./query-builders/prepare";
import type { Query, QueryContext } from "./query-builders/query";
import type { TableAnyColumn } from "./table";

export class Sql {
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
  static raw(s: string): Sql {
    return new Sql(s);
  }

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
  | AnyArg;

export function sql(strings: TemplateStringsArray, ...params: SqlParam[]) {
  return new Sql(strings, params);
}

export function toSqlValue(
  value: string | number | bigint | boolean | null | undefined | TableAnyColumn,
): string {
  if (value === null || value === undefined) {
    return "NULL";
  } else if (typeof value === "string") {
    return `'${value.replace(/'/g, "''")}'`;
  } else if (typeof value === "number" || typeof value === "bigint") {
    return value.toString();
  } else if (typeof value === "boolean") {
    return value ? "'t'" : "'f'";
  } else if (isCol(value)) {
    return value.fullName;
  } else {
    return "NULL";
  }
}
