import type { ConnectionOptions } from "node:tls";
import type { Connector } from "./connectors/common";

export { bigint } from "./columns/bigint";
export { bigserial } from "./columns/bigserial";
export { boolean } from "./columns/boolean";
export { bytea } from "./columns/bytea";
export { char } from "./columns/char";
export { cidr } from "./columns/cidr";
export {
  Column,
  type ColumnConfig,
  notNull,
  primaryKey,
  unique,
} from "./columns/common";
export { date } from "./columns/date";
export { enumed } from "./columns/enum";
export { inet } from "./columns/inet";
export { integer } from "./columns/integer";
export { json } from "./columns/json";
export { jsonb } from "./columns/jsonb";
export { macaddr } from "./columns/macaddr";
export { numeric } from "./columns/numeric";
export { geography } from "./columns/postgis/geography/index";
export { serial } from "./columns/serial";
export { smallint } from "./columns/smallint";
export { smallserial } from "./columns/smallserial";
export { text } from "./columns/text";
export { time } from "./columns/time";
export { timestamp } from "./columns/timestamp";
export { type UuidVersion, uuid } from "./columns/uuid";
export { varchar } from "./columns/varchar";
export {
  PrimaryKeyConstraint,
  primaryKeyConstraint,
} from "./constraints/primary-key";
export { UniqueConstraint, uniqueConstraint } from "./constraints/unique";
export { database } from "./db";
export { enumtype } from "./enumtype";
export {
  arrayAll,
  arrayContainedBy,
  arrayContains,
  arrayHas,
  arrayOverlaps,
} from "./filters/array";
export {
  and,
  eq,
  Filter,
  gt,
  gte,
  isIn,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
} from "./filters/index";
export * from "./functions";
export { index, uniqueIndex } from "./indexes";
export { Migrations, pk } from "./models";
export { asc, desc } from "./query-builders/orderby-clause";
export { Arg, prequery } from "./query-builders/pre";
export type { Query } from "./query-builders/query";
export { sequence } from "./sequence";

import { is } from "./entity";

export { Sql, sql } from "./sql";
export type { AnyTableColumn } from "./table";
export {
  type AnyColumn,
  fk,
  many,
  one,
  relations,
  type TableColumn,
  table,
} from "./table";

import { Enum } from "./enumtype";
import { Sequence } from "./sequence";
import { Table } from "./table";

export const $ = {
  isTable: (value: unknown) => is(value, Table),

  isEnum: (value: unknown) => is(value, Enum),

  isSequence: (value: unknown) => is(value, Sequence),
};

/**
 * A Durcno setup object containing the connector instance and configuration.
 *
 * Returned by `defineConfig()` and consumed by the `database()` function
 * and CLI commands.
 */
export type DurcnoSetup<T extends Connector = Connector> = {
  /** The connector instance for database operations. */
  connector: T;
  /** The configuration options passed to `defineConfig`. */
  config: Config;
};

/**
 * Define a Durcno configuration.
 *
 * This is the recommended way to create your `durcno.config.ts` file.
 * Pass a connector instance for your database driver and the configuration options.
 *
 * @param connector - The connector instance to use (e.g., `pg()`, `postgres()`, `bun()`, `pglite()`).
 * @param config - The database configuration including connection credentials and pool settings.
 * @returns A setup object containing the connector instance and the config options.
 *
 * @example
 * ```typescript
 * import { defineConfig } from "durcno";
 * import { pg } from "durcno/connectors/pg";
 *
 * export default defineConfig(pg(), {
 *   schema: "db/schema.ts",
 *   out: "migrations",
 *   dbCredentials: {
 *     url: process.env.DATABASE_URL!,
 *   },
 * });
 * ```
 */
export function defineConfig<T extends Connector>(
  connector: T,
  config: Config,
): DurcnoSetup<T> {
  connector._init(config);
  return {
    connector,
    config,
  };
}

export type Config = {
  /**
   * The relative path to the database schema file.
   */
  schema: string;
  /**
   * The relative path to the output directory for generated migrations.
   * @default "migrations"
   */
  out?: string;
  /**
   * Database connection credentials.
   */
  dbCredentials:
    | ({
        host: string;
        port?: number;
        user: string;
        password?: string;
        database: string;
        ssl?:
          | boolean
          | "require"
          | "allow"
          | "prefer"
          | "verify-full"
          | ConnectionOptions;
      } & {})
    | {
        url: string;
      };
  /**
   * Connection pool configuration.
   */
  pool?: {
    /**
     * Maximum number of connections in the `db` pool.
     * @default 10
     */
    max?: number;
  };
};

declare global {
  type Key = string | number | symbol;

  // biome-ignore lint/suspicious/noExplicitAny: <>
  type Valueof<T> = T extends any ? T[keyof T] : never;

  type SelfOrArray<T> = T | T[];
  type SelfOrReadonly<T> = T | Readonly<T>;

  type UnionToIntersection<U> =
    // biome-ignore lint/suspicious/noExplicitAny: <>
    (U extends any ? (k: U) => void : never) extends (k: infer I) => void
      ? I
      : never;

  type Is<T, U> = T extends U ? true : false;

  type Prettify<T> = { [K in keyof T]: T[K] } & {};
}
