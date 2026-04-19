import { bigint } from "./columns/bigint";
import { notNull, primaryKey, unique } from "./columns/common";
import { timestamp } from "./columns/timestamp";
import { varchar } from "./columns/varchar";
import { now } from "./functions";
import { table } from "./table";

/**
 * Returns a BigintColumn with { primaryKey, generated: "ALWAYS", as: "IDENTITY" }.
 * @returns BigintColumn
 */
export const pk = () =>
  bigint({ primaryKey, generated: "ALWAYS", as: "IDENTITY" });

export const Migrations = table("durcno", "migrations", {
  id: pk(),
  name: varchar({ length: 100, unique, notNull }),
  createdAt: timestamp({ notNull }).default(now()),
});
