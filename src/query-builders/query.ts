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

  addArg(arg: Arg<any>) {
    this.sql += `$${arg.index}`;
    this.arguments.push(arg.key);
  }
}
