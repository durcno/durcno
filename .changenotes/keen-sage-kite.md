---
bump: minor
---

# feat(connectors): support prepared statements to postgres connector

Add support for executing queries as prepared statements in the `postgres` (postgres.js) connector.

### Prepared Statements in Postgres Connector

The `postgres` connector now passes `{ prepare: true }` to `postgres.js` during query execution when the `prepare` flag is enabled:

```typescript
import { database, defineConfig, eq, prepare } from "durcno";
import { postgres } from "durcno/connectors/postgres";

export const db = database(
  schema,
  defineConfig({
    schema: "./schema.ts",
    connector: postgres({
      dbCredentials: { url: process.env.DATABASE_URL! },
    }),
  }),
);

const findUser = prepare({ id: Users.id.arg() }, (args) =>
  db
    .prepare()
    .from(Users)
    .select("*")
    .where(() => eq(Users.id, args.id)));

const users = await findUser.run(db, { id: 1 });
```
