import { bigint } from "./columns/bigint";
import { identity, notNull, primaryKey, unique } from "./columns/common";
import { timestamp } from "./columns/timestamp";
import { varchar } from "./columns/varchar";
import { now } from "./functions";
import { table } from "./table";

/**
 * Returns a BigintColumn with { primaryKey } and .generatedAlways().as(identity)
 * @returns BigintColumn
 */
export const pk = () => bigint({ primaryKey }).generatedAlways().as(identity);

export const Migrations = table("durcno", "migrations", {
  id: pk(),
  name: varchar({ length: 100, unique, notNull }),
  createdAt: timestamp({ notNull }).default(now()),
});
