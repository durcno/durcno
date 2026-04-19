import { type Sql, sql } from "../sql";

/**
 * Returns a Sql object that represents the SQL function `now()`.
 * @returns Sql
 */
export function now(): Sql {
  return sql`now()`;
}

/**
 * Returns a Sql object that represents the SQL function `gen_random_uuid()` (UUID v4).
 *
 * Note: Requires the pgcrypto extension in PostgreSQL.
 * @returns Sql
 */
export function uuidv4(): Sql {
  return sql`gen_random_uuid()`;
}

/**
 * Returns a Sql object that represents the SQL function `uuid_generate_v7()` (UUID v7).
 *
 * Note: Requires the uuid-ossp extension in PostgreSQL.
 * @returns Sql
 */
export function uuidv7(): Sql {
  return sql`uuid_generate_v7()`;
}
