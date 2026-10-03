---
bump: patch
---

# fix(prepare): bind a reused Arg once and bind values to their own placeholder

Referencing the same `Arg` in several places of one prepared statement — `isIn(col, [arg, arg])`, a multi-row insert sharing one argument, or an `UPDATE` using one argument in both `set()` and `where()` — sent one argument per reference while the SQL kept one placeholder per reference:

```sql
WHERE "users"."username" IN ($1, $1)   -- 1 placeholder, 2 arguments sent
```

PostgreSQL rejected the statement:

```
ERROR:  bind message supplies 2 parameters, but prepared statement "" requires 1
```

`Query.addArg` now registers an argument in the placeholder slot it owns, so a repeated reference writes its `$N` again without registering the value twice.

The same change fixes a silent wrong-results bug that did not need a repeated argument. Placeholder numbers come from the argument names (sorted), while values used to be bound in the order the statement happened to write them, so any statement whose arguments were not written in name order bound each value to the wrong placeholder:

```ts
// "age" is $1 (sorts before "username"), so this used to run as
// "users"."username" = $2 AND "users"."age" = $1 with the values swapped
prepare({ age: Users.age.arg(), username: Users.username.arg() }, (args) =>
  db
    .prepare()
    .from(Users)
    .select("*")
    .where(() =>
      and(eq(Users.username, args.username), eq(Users.age, args.age))
    ));
```

Values are now bound in placeholder order, so every `$N` receives the value of its own argument. `INSERT` (both `values()` and `ON CONFLICT ... DO UPDATE SET`) and `UPDATE` argument emission go through the same `Query.addArg` path, replacing their direct argument pushes.
