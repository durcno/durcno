import {
  and,
  eq,
  index,
  isNull,
  pk,
  sql,
  table,
  timestamptz,
  uniqueIndex,
  varchar,
} from "durcno";

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

export const Users = table(
  "public",
  "users",
  {
    id: pk(),
    email: varchar({ length: 255 }),
    status: varchar({ length: 50 }),
    deletedAt: timestamptz({}),
  },
  {
    indexes: (t) => [
      // Basic index without name
      index([t.email]),

      // Basic index with method
      index([t.email], "hash"),

      // Basic index with name
      index("idx_users_email", [t.email]),

      // Basic index with name and method
      index("idx_users_email_btree", [t.email], "btree"),

      // Unique index without name
      uniqueIndex([t.email]),

      // Unique index with name
      uniqueIndex("uidx_users_email", [t.email]),

      // Partial index with filter
      index([t.email]).where(eq(t.status, "active")),

      // Partial index with name and filter
      index("idx_users_active_email", [t.email]).where(eq(t.status, "active")),

      // Partial unique index (soft deletes)
      uniqueIndex([t.email]).where(isNull(t.deletedAt)),

      // Partial unique index with custom name
      uniqueIndex("uidx_users_active_email", [t.email]).where(
        isNull(t.deletedAt),
      ),

      // Chaining .using() and .where() in SQL order
      index("idx_users_status_btree", [t.status])
        .using("btree")
        .where(eq(t.status, "active")),

      // Multi-column partial index with and()
      index([t.email, t.status]).where(
        and(eq(t.status, "active"), isNull(t.deletedAt)),
      ),

      // Mixed column types in one composite index
      index([t.id, t.email]),
      index("idx_users_id_email", [t.email, t.id]),
      uniqueIndex([t.id, t.email]),
      uniqueIndex("uidx_users_id_email", [t.email, t.id]),

      // Mixed column types with an operator class key
      index([t.id, t.email.opclass("text_pattern_ops")]),

      // Callback syntax for .where()
      index([t.email]).where(() => eq(t.status, "active")),

      // Raw SQL expression for .where()
      index([t.email]).where(sql`"status" = 'active'`),
    ],
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Rejected index inputs
// ─────────────────────────────────────────────────────────────────────────────

// @ts-expect-error Arg is not allowed in partial index where condition
index([Users.email]).where(eq(Users.status, Users.status.arg()));

// @ts-expect-error Invalid argument type to where
index([Users.email]).where(123);

// @ts-expect-error Index keys must be table columns, not plain strings
index([Users.email, "status"]);
