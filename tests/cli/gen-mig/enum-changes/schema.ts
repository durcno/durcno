import {
  enumtype,
  Migrations,
  notNull,
  now,
  pk,
  table,
  timestamp,
  varchar,
} from "durcno";

export { Migrations };

// Stage 1: ['admin', 'user'] (initial)
// Stage 2: ['admin', 'user', 'moderator'] (append to end)
// Stage 3: ['admin', 'editor', 'user', 'moderator'] (insert in middle)
// Stage 4: ['superadmin', 'admin', 'editor', 'user', 'moderator'] (insert at start)
// Stage 5: ['superadmin', 'admin', 'editor', 'moderator'] (remove 'user' - should fail)
// Stage 6: ['admin', 'superadmin', 'editor', 'user', 'moderator'] (reorder - should fail)

const enumValuesMap = {
  1: ["admin", "user"],
  2: ["admin", "user", "moderator"],
  3: ["admin", "editor", "user", "moderator"],
  4: ["superadmin", "admin", "editor", "user", "moderator"],
  5: ["superadmin", "admin", "editor", "moderator"],
  6: ["admin", "superadmin", "editor", "user", "moderator"],
} as const;

const stage = Number(process.env.STAGE ?? 1) as keyof typeof enumValuesMap;

const enumValues = enumValuesMap[stage] ?? enumValuesMap[1];

export const RoleType = enumtype("public", "role", enumValues);

export const Users = table("public", "users", {
  id: pk(),
  username: varchar({ length: 50, notNull }),
  role: RoleType.enumed({ notNull }),
  createdAt: timestamp({ notNull }).default(now()),
});
