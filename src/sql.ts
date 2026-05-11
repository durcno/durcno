import { isCol } from "./entity";
import type { Query } from "./query-builders/query";
import type { TableAnyColumn } from "./table";

export class Sql {
  readonly #string: string;

  constructor(sql: string) {
    this.#string = sql;
  }

  get string() {
    return this.#string;
  }

  toSQL(): string {
    return this.#string;
  }

  toQuery(query: Query) {
    query.sql += this.#string;
  }
}

type SqlParam =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | TableAnyColumn;

export function sql(strings: TemplateStringsArray, ...params: SqlParam[]) {
  let s = "";
  strings.forEach((str, i) => {
    s += str;
    const param = params[i];
    if (param !== undefined) {
      s += toSqlValue(param);
    }
  });
  return new Sql(s);
}

export function toSqlValue(value: SqlParam): string {
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
