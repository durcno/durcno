import { Migrations, notNull, pk, table, unique, varchar } from "durcno";

export { Migrations };

const stage = Number(process.env.STAGE ?? 1);

// Scenarios:
// - Stage 1: users table (id, username, email)
// - Stage 2: users renamed to members, username renamed to handle
// - Stage 3: members renamed to accounts
// - Stage 4: accounts.handle renamed to username

export const Users =
  stage === 1
    ? table("public", "users", {
        id: pk(),
        username: varchar({ length: 50, unique, notNull }),
        email: varchar({ length: 100, notNull }),
      })
    : undefined;

export const Members =
  stage === 2
    ? table("public", "members", {
        id: pk(),
        handle: varchar({ length: 50, unique, notNull }),
        email: varchar({ length: 100, notNull }),
      })
    : undefined;

export const Accounts =
  stage >= 3
    ? table("public", "accounts", {
        id: pk(),
        ...(stage === 3
          ? { handle: varchar({ length: 50, unique, notNull }) }
          : { username: varchar({ length: 50, unique, notNull }) }),
        email: varchar({ length: 100, notNull }),
      })
    : undefined;
