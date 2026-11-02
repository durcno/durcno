import { bigint, notNull, pk, table } from "durcno";
import { ddl, snapshot } from "durcno/migration";
import { describe, expect, it } from "vitest";

const Users = table("public", "users", { id: pk() });

const Posts = table("public", "posts", {
  id: pk(),
  plain: bigint({ notNull }).references(() => Users.id),
  cascade: bigint({ notNull })
    .references(() => Users.id)
    .onDeleteCascade(),
  setNull: bigint({})
    .references(() => Users.id)
    .onDeleteSetNull(),
  setDefault: bigint({})
    .references(() => Users.id)
    .onDeleteSetDefault(),
  restrict: bigint({ notNull })
    .references(() => Users.id)
    .onDeleteRestrict(),
  noAction: bigint({ notNull })
    .references(() => Users.id)
    .onDeleteNoAction(),
  generic: bigint({ notNull })
    .references(() => Users.id)
    .onDelete("RESTRICT"),
  actionBeforeReference: bigint({ notNull })
    .onDeleteCascade()
    .references(() => Users.id),
});

const Comments = table(
  "public",
  "comments",
  {
    id: pk(),
    parentId: bigint({}),
    mergedIntoId: bigint({}),
  },
  {
    foreignKeys: (t, fk) => [
      fk(t.parentId).references(t.id),
      fk(t.mergedIntoId).references(t.id).onDeleteSetNull(),
    ],
  },
);

const schemaSnapshot = snapshot([Users, Posts]);
const columns = schemaSnapshot.tables["public.posts"].columns;
const commentColumns = snapshot([Comments]).tables["public.comments"].columns;

describe("column references", () => {
  it("omits onDelete when no action is set", () => {
    expect(columns.plain.references).toEqual({
      schema: "public",
      table: "users",
      column: "id",
    });
  });

  it.each([
    ["cascade", "CASCADE"],
    ["set_null", "SET NULL"],
    ["set_default", "SET DEFAULT"],
    ["restrict", "RESTRICT"],
    ["no_action", "NO ACTION"],
    ["generic", "RESTRICT"],
    ["action_before_reference", "CASCADE"],
  ] as const)("records the onDelete action for %s", (column, action) => {
    expect(columns[column].references?.onDelete).toBe(action);
  });

  it("omits onDelete for the fk() builder by default", () => {
    expect(commentColumns.parent_id.references).toEqual({
      schema: "public",
      table: "comments",
      column: "id",
    });
  });

  it("records an explicit table-level onDelete action", () => {
    expect(commentColumns.merged_into_id.references?.onDelete).toBe("SET NULL");
  });
});

describe("foreign key DDL", () => {
  it("omits ON DELETE when no action is set", () => {
    const sql = ddl
      .createTable("public", "posts")
      .column("user_id", "bigint", {
        references: { schema: "public", table: "users", column: "id" },
      })
      .toSQL();

    expect(sql).toContain('REFERENCES "public"."users"(id)');
    expect(sql).not.toContain("ON DELETE");
  });

  it("emits ON DELETE for a column reference action", () => {
    const sql = ddl
      .createTable("public", "posts")
      .column("user_id", "bigint", {
        references: {
          schema: "public",
          table: "users",
          column: "id",
          onDelete: "SET NULL",
        },
      })
      .toSQL();

    expect(sql).toContain("ON DELETE SET NULL");
  });

  it("emits ON DELETE for an added foreign key", () => {
    const sql = ddl
      .alterTable("public", "posts")
      .addForeignKey("posts_user_id_fkey", "user_id", {
        schema: "public",
        table: "users",
        column: "id",
        onDelete: "CASCADE",
      })
      .toSQL();

    expect(sql).toContain("ON DELETE CASCADE");
  });

  it("omits ON DELETE for an added foreign key without an action", () => {
    const sql = ddl
      .alterTable("public", "posts")
      .addForeignKey("posts_user_id_fkey", "user_id", {
        schema: "public",
        table: "users",
        column: "id",
      })
      .toSQL();

    expect(sql).not.toContain("ON DELETE");
  });
});
