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
export type { $Client, ConnectorOptions } from "./connectors/common";
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
export { Query } from "./query-builders/query";
export { sequence } from "./sequence";

import { is } from "./entity";

export type { DurcnoLogger } from "./logger";
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
 * Define a Durcno configuration.
 *
 * This is the recommended way to create your `durcno.config.ts` file.
 * Pass a configuration object that includes a connector instance for your
 * database driver as well as the schema and migrations output path.
 *
 * @param config - The configuration object including the connector instance,
 *   schema file path, and optional migrations output directory.
 * @returns The same configuration object, with the connector stamped with a
 *   back-reference to the config.
 *
 * @example
 * ```typescript
 * import { defineConfig } from "durcno";
 * import { pg } from "durcno/connectors/pg";
 *
 * export default defineConfig({
 *   schema: "db/schema.ts",
 *   out: "migrations",
 *   connector: pg({
 *     dbCredentials: { url: process.env.DATABASE_URL! },
 *   }),
 * });
 * ```
 */
export function defineConfig<T extends Connector>(
  config: Config<T>,
): Config<T> {
  return config;
}

export type Config<T extends Connector = Connector> = {
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
   * The connector instance to use for database operations.
   * Pass the result of `pg()`, `postgres()`, `bun()`, or `pglite()`,
   * each configured with connection credentials and pool/logger options.
   */
  connector: T;
};

export type {
  Is,
  Key,
  Prettify,
  SelfOrArray,
  SelfOrReadonly,
  UnionToIntersection,
  Valueof,
} from "./types";
