---
sidebar_position: 1
---

# Types

Durcno is built from the ground up for end-to-end TypeScript type safety. In addition to inferring the result types of queries automatically, Durcno provides a suite of utility types to extract pure TypeScript models, column values, and query shapes directly from your schemas and queries.

These utility types produce clean domain data shapes (without query-builder internal AST wrappers), making them ideal for typing API requests, responses, service layers, and DTOs.

## Quick Reference

| Utility Type                             | Input      | Description                                                            | Primary Key Handling |
| :--------------------------------------- | :--------- | :--------------------------------------------------------------------- | :------------------- |
| `InferSelect<T>` / `InferSelectModel<T>` | Table      | Inferred select model (all columns mapped to read types)               | Included             |
| `InferInsert<T>` / `InferInsertModel<T>` | Table      | Inferred insert payload (required columns required, defaults optional) | **Excluded**         |
| `InferUpdate<T>` / `InferUpdateModel<T>` | Table      | Inferred update payload (all non-PK columns optional)                  | **Excluded**         |
| `InferInsertValue<TCol>`                 | Column     | Value type accepted when inserting into the column                     | N/A                  |
| `InferUpdateValue<TCol>`                 | Column     | Value type accepted when updating the column                           | N/A                  |
| `InferSelectValue<TCol>`                 | Column     | Value type returned when selecting the column                          | Included             |
| `InferSelectRow<TSelects>`               | Projection | Record mapping projected column expressions to their select types      | Preserves selection  |
| `InsertValues<TTable>`                   | Table      | Accepted payload for `insertInto().values()` (includes SQL / SqlFn)    | **Excluded**         |
| `UpdateValues<TTable>`                   | Table      | Accepted payload for `update().set()` (includes SQL / SqlFn / columns) | **Excluded**         |

---

## Model Type Inference

Model inference types extract pure TypeScript representations of table rows for read, create, and update operations.

```typescript
import { type InferInsert, type InferSelect, type InferUpdate } from "durcno";
import { Users } from "./schema.ts";

// 1. Select row model (all columns mapped to their read types)
type User = InferSelect<typeof Users>;

// 2. Insert payload (required fields required, defaults/nullables optional, PKs omitted)
type NewUser = InferInsert<typeof Users>;

// 3. Update payload (all non-PK fields optional, PKs omitted)
type UpdateUser = InferUpdate<typeof Users>;
```

:::tip
**Type Aliases** — You can also use the descriptive aliases `InferSelectModel<T>`, `InferInsertModel<T>`, and `InferUpdateModel<T>`.
:::

---

### `InferSelect<T>`

Extracts the full row type returned when reading from a table. Every column is mapped to its TypeScript select type, respecting nullability and enum definitions.

#### Example Schema

```typescript
import {
  bigint,
  boolean,
  enumtype,
  notNull,
  now,
  pk,
  table,
  timestamptz,
  unique,
  varchar,
} from "durcno";

export const RoleEnm = enumtype("public", "role", ["admin", "member", "guest"]);

export const Users = table("public", "users", {
  id: pk(),
  email: varchar({ length: 255, notNull, unique }),
  fullName: varchar({ length: 100 }),
  role: RoleEnm.enumed({ notNull }).default("member"),
  isActive: boolean({ notNull }).default(true),
  createdAt: timestamptz({ notNull }).default(now()),
});
```

#### Inferred Shape

```typescript
type User = InferSelect<typeof Users>;

// Equivalent to:
// type User = {
//   id: bigint;
//   email: string;
//   fullName: string | null;
//   role: "admin" | "member" | "guest";
//   isActive: boolean;
//   createdAt: Date;
// };
```

---

### `InferInsert<T>`

Extracts the input shape accepted when inserting records into a table via `db.insertInto(...)`.

`InferInsert` automatically applies the following rules:

- **Primary keys and generated columns** (such as `pk()`) are **strictly excluded**, as PostgreSQL generates these values automatically.
- **Columns marked `notNull` without a default** are **required**.
- **Columns with a default** (via `.default(...)` or `.$defaultFn(...)`) are **optional** (`?`).
- **Nullable columns** (columns without `notNull`) are **optional** (`?`) and allow `null` or `undefined`.

#### Inferred Shape

```typescript
type NewUser = InferInsert<typeof Users>;

// Equivalent to:
// type NewUser = {
//   email: string;
//   fullName?: string | null;
//   role?: "admin" | "member" | "guest";
//   isActive?: boolean;
//   createdAt?: Date;
// };
// Note: `id` is completely omitted.
```

---

### `InferUpdate<T>`

Extracts the input shape accepted when updating records via `db.update(...).set(...)`.

`InferUpdate` applies partial update semantics:

- **Primary keys** (`pk()`) are **strictly excluded** because primary key identity columns cannot be targeted for updates.
- **All non-primary-key columns are optional** (`?`), allowing you to supply only the fields you wish to modify.

#### Inferred Shape

```typescript
type UpdateUser = InferUpdate<typeof Users>;

// Equivalent to:
// type UpdateUser = {
//   email?: string;
//   fullName?: string | null;
//   role?: "admin" | "member" | "guest";
//   isActive?: boolean;
//   createdAt?: Date;
// };
// Note: `id` is completely omitted.
```

---

## Column-Level Type Inference

When building reusable form components, validation helpers, or granular update functions, you can infer the input type of an individual column.

### `InferSelectValue<TCol>`

Extracts the read/select type produced by a specific column or expression:

```typescript
import { type InferSelectValue } from "durcno";
import { Users } from "./schema.ts";

type UserId = InferSelectValue<typeof Users.id>;
// bigint

type UserEmail = InferSelectValue<typeof Users.email>;
// string

type FullName = InferSelectValue<typeof Users.fullName>;
// string | null
```

### `InferInsertValue<TCol>`

Extracts the value type accepted when inserting into a specific column:

```typescript
import { type InferInsertValue } from "durcno";
import { Users } from "./schema.ts";

type EmailInput = InferInsertValue<typeof Users.email>;
// string

type FullNameInput = InferInsertValue<typeof Users.fullName>;
// string | null | undefined
```

### `InferUpdateValue<TCol>`

Extracts the value type accepted when updating a specific column:

```typescript
import { type InferUpdateValue } from "durcno";
import { Users } from "./schema.ts";

type RoleUpdate = InferUpdateValue<typeof Users.role>;
// "admin" | "member" | "guest" | undefined
```

---

## Query Result Types

When executing queries with custom column projections, Durcno provides utilities to infer the row shape or value types directly.

### `InferSelectRow<TSelects>`

Infers the object shape returned by a custom `.select(...)` projection:

```typescript
import { type InferSelectRow } from "durcno";
import { Users } from "./schema.ts";

const projection = {
  userId: Users.id,
  userEmail: Users.email,
};

type UserSummary = InferSelectRow<typeof projection>;
// { userId: bigint; userEmail: string }
```

### `Awaited<ReturnType<...>>`

To infer the return type of a full query chain, use TypeScript's standard `Awaited` utility:

```typescript
const getUserQuery = (id: bigint) =>
  db
    .from(Users)
    .select(() => ({ id: Users.id, email: Users.email }))
    .where(() => eq(Users.id, id))
    .execute();

type UserResult = Awaited<ReturnType<typeof getUserQuery>>;
// Array<{ id: bigint; email: string }>
```

---

## Query Builder Payload Types

While model inference types (`InferInsert`, `InferUpdate`) produce pure JavaScript/TypeScript data representations (for API boundaries, DTOs, and serialization), Durcno's query builders also accept SQL expressions, column references, scalar functions, and prepared arguments.

Durcno exports these payload types for typing helper functions that construct database operations directly:

| Query Builder Type                       | Used By                             | Accepts                                                                   |
| :--------------------------------------- | :---------------------------------- | :------------------------------------------------------------------------ |
| `InsertValues<TTable, TPrepare>`         | `db.insertInto(T).values(...)`      | Column literals, `Sql`, `SqlFn` (scalar functions), `Arg` (when prepared) |
| `UpdateValues<TTable, TPrepare>`         | `db.update(T).set(...)`             | Column literals, column references, `Sql`, `SqlFn`, `Arg` (when prepared) |
| `ConflictUpdateValues<TTable, TPrepare>` | `.onConflict(...).doUpdateSet(...)` | Column literals, table columns, `excluded` columns, `Sql`, `SqlFn`, `Arg` |

### Domain Models vs. Query Builder Payloads

- **`InferInsert<typeof Users>`**: Pure domain data object (e.g. `{ username: string; email?: string | null }`). Use this for typing HTTP request bodies, form inputs, and service methods.
- **`InsertValues<typeof Users>`**: Query builder payload type. In addition to raw values, it accepts SQL functions (`lower(...)`), raw SQL (`sql`...``), and prepared placeholders (`Arg`).
- **`InferUpdate<typeof Users>`**: Pure domain partial data object (e.g. `{ username?: string; email?: string | null }`).
- **`UpdateValues<typeof Users>`**: Query builder update payload type. In addition to raw values, it accepts column references (`Users.description`), arithmetic/string functions (`add(...)`, `concat(...)`), and SQL expressions.

---

## Application Patterns

### API Request & Response DTOs

Use inferred types to strongly type your HTTP route handlers or RPC endpoints:

```typescript
import { type InferInsert, type InferSelect } from "durcno";
import { Users } from "./schema.ts";

// Response payload for GET /users/:id
export type UserResponse = InferSelect<typeof Users>;

// Request body for POST /users
export type CreateUserRequest = InferInsert<typeof Users>;

export async function createUserHandler(
  body: CreateUserRequest,
): Promise<UserResponse> {
  const [created] = await db
    .insertInto(Users)
    .values(body)
    .returning("*");

  return created;
}
```

### Compile-Time vs. Runtime Validation

Type inference provides compile-time guarantees, but incoming untrusted external input (like an HTTP JSON body) still needs runtime validation.

Durcno pairs compile-time inference with runtime schema generators like [Zod](../Validation/zod.md):

```typescript
import { type InferInsert } from "durcno";
import { createInsertSchema } from "durcno/validators/zod";
import { Users } from "./schema.ts";

// 1. Runtime validator schema
export const insertUserSchema = createInsertSchema(Users);

// 2. Compile-time inferred type matches the validated data shape
export type NewUserDTO = InferInsert<typeof Users>;
```
