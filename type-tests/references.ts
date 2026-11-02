import {
  bigint as bigintColumn,
  notNull,
  type OnDeleteAction,
  pk,
  table,
} from "durcno";
import { ddl } from "durcno/migration";
import { type Equal, Expect } from "./utils";

const Users = table("public", "users", { id: pk() });

const Posts = table("public", "posts", {
  id: pk(),
  plain: bigintColumn({ notNull }).references(() => Users.id),
  cascade: bigintColumn({ notNull })
    .references(() => Users.id)
    .onDeleteCascade(),
  setNull: bigintColumn({})
    .references(() => Users.id)
    .onDeleteSetNull(),
  setDefault: bigintColumn({})
    .references(() => Users.id)
    .onDeleteSetDefault(),
  restrict: bigintColumn({ notNull })
    .references(() => Users.id)
    .onDeleteRestrict(),
  noAction: bigintColumn({ notNull })
    .references(() => Users.id)
    .onDeleteNoAction(),
  generic: bigintColumn({ notNull })
    .references(() => Users.id)
    .onDelete("RESTRICT"),
  actionBeforeReference: bigintColumn({ notNull })
    .onDeleteCascade()
    .references(() => Users.id),
});

Expect<Equal<(typeof Posts)["$"]["inferSelect"]["plain"], bigint>>();

Expect<
  Equal<
    OnDeleteAction,
    "CASCADE" | "SET NULL" | "SET DEFAULT" | "RESTRICT" | "NO ACTION"
  >
>();

// @ts-expect-error: the object form is no longer accepted
bigintColumn({}).references({ column: () => Users.id });

bigintColumn({})
  .references(() => Users.id)
  // @ts-expect-error: unsupported ON DELETE action
  .onDelete("INVALID");

ddl.createTable("public", "posts").column("user_id", "bigint", {
  references: { schema: "public", table: "users", column: "id" },
});

ddl.createTable("public", "posts").column("user_id", "bigint", {
  references: {
    schema: "public",
    table: "users",
    column: "id",
    onDelete: "CASCADE",
  },
});

ddl.createTable("public", "posts").column("user_id", "bigint", {
  references: {
    schema: "public",
    table: "users",
    column: "id",
    // @ts-expect-error: unsupported ON DELETE action
    onDelete: "INVALID",
  },
});
