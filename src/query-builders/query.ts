import type { Arg } from "./pre";

type SqlArgType = string | number | null;

export class Query<T = unknown> {
  readonly returnType!: T;
  sql: string;
  arguments: SqlArgType[] = [];
  rowsHandler: (rows: any[]) => T;
  constructor(sql: string, rowsHandler: (rows: any[]) => T) {
    this.sql = sql;
    this.rowsHandler = rowsHandler;
  }

  /** Appends a prepared-query `Arg` placeholder with optional cast suffix. */
  addArg(arg: Arg<any>) {
    const castSuffix = arg.cast ? `::${arg.cast}` : "";
    this.sql += `$${arg.index}${castSuffix}`;
    this.arguments.push(arg.key);
  }

  /** Pushes an argument value and returns the `$N[::cast]` placeholder string. */
  pushArg(value: SqlArgType, cast: string | null): string {
    this.arguments.push(value);
    const idx = this.arguments.length;
    return cast && value !== null ? `$${idx}::${cast}` : `$${idx}`;
  }

  /** Returns a human-readable representation of the query for debugging. */
  prettify(): string {
    const args = this.arguments
      .map((v, i) => `  $${i + 1} = ${v === null ? "NULL" : JSON.stringify(v)}`)
      .join("\n");
    return args.length > 0
      ? `SQL:\n  ${this.sql}\nArguments:\n${args}`
      : `SQL:\n  ${this.sql}`;
  }
}
