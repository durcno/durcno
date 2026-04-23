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
}
