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

// Environment variable controls the test scenario:
// - "initial": Initial enum with ['admin', 'user']
// - "append": Append 'moderator' to end: ['admin', 'user', 'moderator']
// - "insert_middle": Insert 'editor' in middle: ['admin', 'editor', 'user']
// - "insert_start": Insert 'superadmin' at start: ['superadmin', 'admin', 'user']
// - "remove": Remove 'user': ['admin'] (should fail)
// - "reorder": Reorder values: ['user', 'admin'] (should fail)

const enumValuesMap = {
  initial: ["admin", "user"],
  append: ["admin", "user", "moderator"],
  insert_middle: ["admin", "editor", "user"],
  insert_start: ["superadmin", "admin", "user"],
  remove: ["admin"],
  reorder: ["user", "admin"],
} as const;

const scenario = (process.env.ENUM_SCENARIO ??
  "initial") as keyof typeof enumValuesMap;

const enumValues = enumValuesMap[scenario] ?? enumValuesMap.initial;

export const RoleType = enumtype("public", "role", enumValues);

export const Users = table("public", "users", {
  id: pk(),
  username: varchar({ length: 50, notNull }),
  role: RoleType.enumed({ notNull }),
  createdAt: timestamp({ notNull, default: now() }),
});
