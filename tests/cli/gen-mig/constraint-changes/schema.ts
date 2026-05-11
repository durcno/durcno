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

// Stage 1: composite PK (userId, groupId) + unique on (email, name)
// Stage 2: add unique constraint on (name, createdAt)
// Stage 3: remove unique_email_name constraint
// Stage 4: modify PK to (userId, groupId, email)

const stage = Number(process.env.STAGE ?? 1);

export const ConstraintTest = table(
  "public",
  "constraint_test",
  {
    userId: integer({ notNull }),
    groupId: integer({ notNull }),
    email: varchar({ length: 255, notNull }),
    name: varchar({ length: 100, notNull }),
    createdAt: timestamp({ notNull }).default(now()),
  },
  {
    uniqueConstraints: (t, unique) => {
      const emailNameUnique = unique("unique_email_name", [t.email, t.name]);
      const nameCreatedUnique = unique("unique_name_created", [
        t.name,
        t.createdAt,
      ]);

      if (stage === 1) return [emailNameUnique];
      if (stage === 2) return [emailNameUnique, nameCreatedUnique];
      if (stage === 3) return [nameCreatedUnique];
      if (stage >= 4) return [nameCreatedUnique];

      return [emailNameUnique];
    },
    primaryKeyConstraint: (t, primaryKey) => {
      if (stage >= 4) {
        return primaryKey("pk", [t.userId, t.groupId, t.email]);
      }
      return primaryKey("pk", [t.userId, t.groupId]);
    },
  },
);
