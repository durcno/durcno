---
sidebar_position: 3
---

# Relations

Relations define the relationships between tables in your database schema. Durcno provides a type-safe way to declare one-to-many, many-to-one, and one-to-one relationships using the `relations()` function with `fk()`, `one()`, and `many()` helpers.

## Why Use Relations?

While foreign keys enforce referential integrity at the database level, relations in Durcno provide:

- **Type-safe queries**: Full TypeScript inference when joining tables
- **Simplified queries**: Cleaner syntax for complex joins
- **Better developer experience**: Auto-completion for related data
- **Documentation**: Self-documenting schema relationships

## Defining Relations

Relations are defined using the `relations()` function, separate from the table definition:

```typescript
import {
  table,
  pk,
  bigint,
  varchar,
  relations,
  many,
  one,
  fk,
  notNull,
} from "durcno";

// Define tables
export const Users = table("public", "users", {
  id: pk(),
  username: varchar({ length: 50, notNull }),
});

export const Posts = table("public", "posts", {
  id: pk(),
  userId: bigint({ notNull }).references(() => Users.id),
  title: varchar({ length: 255, notNull }),
});

// Define relations
export const UsersRelations = relations(Users, () => ({
  posts: many(Posts, Posts.userId),
}));

export const PostsRelations = relations(Posts, () => ({
  author: fk(Posts.userId, Users),
}));
```

:::tip Naming Convention
Use the `Relations` suffix for relation objects (e.g., `UsersRelations`, `PostsRelations`) to distinguish them from table definitions.
:::

## Relation Types

### One-to-Many Relationship

A one-to-many relationship exists when one record in a table can be associated with multiple records in another table.

```typescript
import {
  table,
  pk,
  bigint,
  varchar,
  relations,
  many,
  one,
  notNull,
} from "durcno";

// One user can have many posts
export const Users = table("public", "users", {
  id: pk(),
  username: varchar({ length: 50, notNull }),
});

export const Posts = table("public", "posts", {
  id: pk(),
  userId: bigint({ notNull }).references(() => Users.id),
  title: varchar({ length: 255, notNull }),
});

// User has many posts
export const UsersRelations = relations(Users, () => ({
  posts: many(Posts, Posts.userId),
}));
```

**Syntax:**

```typescript
many(targetTable, foreignKeyColumn);
```

**Parameters:**

- `targetTable`: The table that contains the foreign key
- `foreignKeyColumn`: The column in the target table that references this table

### Many-to-One Relationship

The inverse of one-to-many - multiple records reference a single record. Use `fk()` when the foreign key column is on the current table:

```typescript
// Post belongs to one user
export const PostsRelations = relations(Posts, () => ({
  author: fk(Posts.userId, Users),
}));
```

**Syntax:**

```typescript
fk(foreignKeyColumn, targetTable);
```

**Parameters:**

- `foreignKeyColumn`: The column on the current table that references another table
- `targetTable`: The table being referenced

:::tip Nullability
The result type of `fk()` relations depends on the foreign key column's nullability:

- If the FK column has `notNull`, the result is `T`
- If the FK column is nullable, the result is `T | null`
  :::

### One-to-One Relationship

A one-to-one relationship exists when one record in a table is associated with exactly one record in another table.

```typescript
import {
  table,
  pk,
  bigint,
  varchar,
  relations,
  one,
  fk,
  notNull,
  unique,
} from "durcno";

export const Users = table("public", "users", {
  id: pk(),
  username: varchar({ length: 50, notNull }),
});

export const UserProfiles = table("public", "user_profiles", {
  id: pk(),
  userId: bigint({ unique, notNull }).references(() => Users.id),
  bio: varchar({ length: 500 }),
  avatarUrl: varchar({ length: 255 }),
});

// User has one profile (using `one` - FK is on the related table)
export const UsersRelations = relations(Users, () => ({
  profile: one(UserProfiles, UserProfiles.userId),
}));

// Profile belongs to one user (using `fk` - FK is on the current table)
export const UserProfilesRelations = relations(UserProfiles, () => ({
  user: fk(UserProfiles.userId, Users),
}));
```

:::tip One-to-One Requirement
For true one-to-one relationships, use `unique` constraint on the foreign key column to ensure each user can only have one profile.
:::

### Choosing Between `fk()` and `one()`

Use `fk()` when the foreign key column is on the **current table** (the table defining the relation):

```typescript
// Posts has userId column that references Users
export const PostsRelations = relations(Posts, () => ({
  author: fk(Posts.userId, Users), // FK is on Posts (current table)
}));
```

Use `one()` when the foreign key column is on the **related table**:

```typescript
// Users wants to reference UserProfiles, but userId is on UserProfiles
export const UsersRelations = relations(Users, () => ({
  profile: one(UserProfiles, UserProfiles.userId), // FK is on UserProfiles (related table)
}));
```

## Complete Example

Here's a complete example with multiple relationship types:

```typescript
import {
  table,
  pk,
  bigint,
  varchar,
  text,
  timestamp,
  relations,
  many,
  one,
  fk,
  notNull,
  unique,
  now,
} from "durcno";

// Users table
export const Users = table("public", "users", {
  id: pk(),
  username: varchar({ length: 50, unique, notNull }),
  email: varchar({ length: 255, unique, notNull }),
  createdAt: timestamp({ notNull }).default(now()),
});

// User profiles (one-to-one with users)
export const UserProfiles = table("public", "user_profiles", {
  id: pk(),
  userId: bigint({ unique, notNull }).references(() => Users.id),
  bio: varchar({ length: 500 }),
  avatarUrl: varchar({ length: 255 }),
  website: varchar({ length: 255 }),
});

// Posts (many-to-one with users)
export const Posts = table("public", "posts", {
  id: pk(),
  userId: bigint({ notNull }).references(() => Users.id),
  title: varchar({ length: 255, notNull }),
  content: text({ notNull }),
  createdAt: timestamp({ notNull }).default(now()),
});

// Comments (many-to-one with users and posts)
export const Comments = table("public", "comments", {
  id: pk(),
  postId: bigint({ notNull }).references(() => Posts.id),
  userId: bigint({ notNull }).references(() => Users.id),
  body: text({ notNull }),
  createdAt: timestamp({ notNull }).default(now()),
});

// Define all relations
export const UsersRelations = relations(Users, () => ({
  profile: one(UserProfiles, UserProfiles.userId),
  posts: many(Posts, Posts.userId),
  comments: many(Comments, Comments.userId),
}));

export const UserProfilesRelations = relations(UserProfiles, () => ({
  user: fk(UserProfiles.userId, Users),
}));

export const PostsRelations = relations(Posts, () => ({
  author: fk(Posts.userId, Users),
  comments: many(Comments, Comments.postId),
}));

export const CommentsRelations = relations(Comments, () => ({
  post: fk(Comments.postId, Posts),
  author: fk(Comments.userId, Users),
}));
```

## Registering Relations with Database

Relations must be exported and included when creating the database instance:

```typescript
import { database } from "durcno";
import config from "./durcno.config.ts";
import * as schema from "./schema.ts";

export const db = database(schema, config);
```

:::important
Both the table definition and its relations must be exported and included in the database schema object.
:::

## Using Relations in Queries

Relations enable type-safe joins and nested queries:

### Basic Join

```typescript
// Query posts with author information
const postsWithAuthors = await db
  .from(Posts)
  .innerJoin(Users, eq(Posts.userId, Users.id))
  .select({
    postId: Posts.id,
    title: Posts.title,
    authorName: Users.username,
  });
```

### Nested Queries (Future Feature)

While Durcno's relations prepare your schema for advanced query capabilities, nested query syntax is a planned feature:

```typescript
// Planned future syntax
const usersWithPosts = await db
  .from(Users)
  .with({
    posts: PostsRelations,
  })
  .select();
```

## Common Relationship Patterns

### Blog System

```typescript
// Users, Posts, Comments, Categories, Tags
export const Users = table("public", "users", {
  id: pk(),
  username: varchar({ length: 50, notNull }),
});

export const Categories = table("public", "categories", {
  id: pk(),
  name: varchar({ length: 100, notNull }),
});

export const Posts = table("public", "posts", {
  id: pk(),
  userId: bigint({ notNull }).references(() => Users.id),
  categoryId: bigint({ notNull }).references(() => Categories.id),
  title: varchar({ length: 255, notNull }),
  content: text({ notNull }),
});

export const UsersRelations = relations(Users, () => ({
  posts: many(Posts, Posts.userId),
}));

export const CategoriesRelations = relations(Categories, () => ({
  posts: many(Posts, Posts.categoryId),
}));

export const PostsRelations = relations(Posts, () => ({
  author: fk(Posts.userId, Users),
  category: fk(Posts.categoryId, Categories),
}));
```

### E-commerce System

```typescript
export const Customers = table("public", "customers", {
  id: pk(),
  email: varchar({ length: 255, unique, notNull }),
  name: varchar({ length: 255, notNull }),
});

export const Orders = table("public", "orders", {
  id: pk(),
  customerId: bigint({ notNull }).references(() => Customers.id),
  totalAmount: integer({ notNull }),
  createdAt: timestamp({ notNull }).default(now()),
});

export const OrderItems = table("public", "order_items", {
  id: pk(),
  orderId: bigint({ notNull }).references(() => Orders.id),
  productId: bigint({ notNull }).references(() => Products.id),
  quantity: integer({ notNull }),
  price: integer({ notNull }),
});

export const Products = table("public", "products", {
  id: pk(),
  name: varchar({ length: 255, notNull }),
  price: integer({ notNull }),
});

export const CustomersRelations = relations(Customers, () => ({
  orders: many(Orders, Orders.customerId),
}));

export const OrdersRelations = relations(Orders, () => ({
  customer: fk(Orders.customerId, Customers),
  items: many(OrderItems, OrderItems.orderId),
}));

export const OrderItemsRelations = relations(OrderItems, () => ({
  order: fk(OrderItems.orderId, Orders),
  product: fk(OrderItems.productId, Products),
}));

export const ProductsRelations = relations(Products, () => ({
  orderItems: many(OrderItems, OrderItems.productId),
}));
```

### Social Network

```typescript
export const Users = table("public", "users", {
  id: pk(),
  username: varchar({ length: 50, unique, notNull }),
});

export const Follows = table("public", "follows", {
  id: pk(),
  followerId: bigint({ notNull }).references(() => Users.id),
  followingId: bigint({ notNull }).references(() => Users.id),
  createdAt: timestamp({ notNull }).default(now()),
});

export const UsersRelations = relations(Users, () => ({
  following: many(Follows, Follows.followerId),
  followers: many(Follows, Follows.followingId),
}));

export const FollowsRelations = relations(Follows, () => ({
  follower: fk(Follows.followerId, Users),
  following: fk(Follows.followingId, Users),
}));
```

## Best Practices

### Always Define Both Sides

For clarity and type safety, define relations from both sides:

```typescript
// ✅ Good: Both sides defined
export const UsersRelations = relations(Users, () => ({
  posts: many(Posts, Posts.userId),
}));

export const PostsRelations = relations(Posts, () => ({
  author: fk(Posts.userId, Users),
}));

// ❌ Incomplete: Only one side defined
export const UsersRelations = relations(Users, () => ({
  posts: many(Posts, Posts.userId),
}));
// Missing PostsRelations relation
```

### Use Descriptive Relation Names

Choose relation names that describe the relationship:

```typescript
// ✅ Good: Descriptive names
export const UsersRelations = relations(Users, () => ({
  posts: many(Posts, Posts.userId),
  comments: many(Comments, Comments.userId),
  profile: one(UserProfiles, UserProfiles.userId),
}));

// ❌ Unclear: Generic names
export const UsersRelations = relations(Users, () => ({
  items: many(Posts, Posts.userId),
  things: many(Comments, Comments.userId),
  data: one(UserProfiles, UserProfiles.userId),
}));
```

### Match Foreign Key Constraints

Always define `.references()` in your column definitions to match your relations:

```typescript
// ✅ Good: Foreign key and relation match
export const Posts = table("public", "posts", {
  id: pk(),
  userId: bigint({ notNull }).references(() => Users.id), // Foreign key
});

export const PostsRelations = relations(Posts, () => ({
  author: fk(Posts.userId, Users), // Matching relation using fk()
}));

// ❌ Bad: Relation without foreign key
export const Posts = table("public", "posts", {
  id: pk(),
  userId: bigint({ notNull }), // No foreign key!
});

export const PostsRelations = relations(Posts, () => ({
  author: fk(Posts.userId, Users),
}));
```

### Export All Relations

Don't forget to export and register all relation objects:

```typescript
// schema.ts
export const UsersRelations = relations(Users, () => ({
  posts: many(Posts, Posts.userId),
}));

// db/index.ts
import { database } from "durcno";
import * as schema from "./schema.ts";
import config from "./durcno.config.ts";

export const db = database(schema, config);
```

### Use Lazy References

Use arrow functions in `.references()` to avoid circular dependency issues:

```typescript
// ✅ Good: Lazy reference
export const Posts = table("public", "posts", {
  userId: bigint({ notNull }).references(() => Users.id),
});

// ❌ Bad: Direct reference (may cause circular dependency)
export const Posts = table("public", "posts", {
  userId: bigint({ notNull }).references(Users.id),
});
```

## Type Safety

Durcno provides full type inference for relations:

```typescript
// TypeScript knows the shape of related data
const posts = await db
  .from(Posts)
  .innerJoin(Users, eq(Posts.userId, Users.id))
  .select({
    postId: Posts.id, // bigint
    title: Posts.title, // string | null
    authorName: Users.username, // string
  });

// Type: { postId: bigint; title: string | null; authorName: string }[]
```

## Migration Considerations

Relations in your TypeScript code don't create database constraints automatically. You must:

1. Define foreign key constraints in column definitions
2. Generate migrations to create the constraints
3. Apply migrations to your database

```typescript
// 1. Define foreign key in schema
export const Posts = table("public", "posts", {
  userId: bigint({ notNull }).references(() => Users.id),
});

// 2. Generate migration
// $ npm exec durcno generate

// 3. Apply migration
// $ npm exec durcno migrate
```

## Next Steps

- Learn about [Columns](./columns.md) to define table structures
- Explore [Indexes](./indexes.md) to optimize query performance