import {
  integer,
  Migrations,
  notNull,
  now,
  table,
  timestamp,
  varchar,
} from "durcno";

export { Migrations };

// Scenarios:
// - initial: composite PK + composite unique on constraint_test
// - add_unique: add a new unique constraint (unique_name)
// - remove_unique: remove the unique_email_name constraint
// - modify_unique: change unique_email_name columns (email only)
// - modify_pk: change the PK columns

const scenario = (process.env.CONSTRAINT_SCENARIO ?? "initial") as
  | "initial"
  | "add_unique"
  | "remove_unique"
  | "modify_unique"
  | "modify_pk";

export const ConstraintTest = table(
  "public",
  "constraint_test",
  {
    userId: integer({ notNull }),
    groupId: integer({ notNull }),
    email: varchar({ length: 255, notNull }),
    name: varchar({ length: 100, notNull }),
    createdAt: timestamp({ notNull, default: now() }),
  },
  {
    uniqueConstraints: (t, unique) => {
      const base = [unique("unique_email_name", [t.email, t.name])];

      if (scenario === "initial") return base;

      if (scenario === "add_unique") {
        return [...base, unique("unique_name_created", [t.name, t.createdAt])];
      }

      if (scenario === "remove_unique") {
        return [];
      }

      if (scenario === "modify_unique") {
        // Change columns of unique_email_name: (email, name) -> (email, createdAt)
        return [unique("unique_email_name", [t.email, t.createdAt])];
      }

      if (scenario === "modify_pk") return base;

      return base;
    },
    primaryKeyConstraint: (t, primaryKey) => {
      if (scenario === "modify_pk") {
        // Change PK from (userId, groupId) to (userId, groupId, email)
        return primaryKey("pk", [t.userId, t.groupId, t.email]);
      }
      return primaryKey("pk", [t.userId, t.groupId]);
    },
  },
);
