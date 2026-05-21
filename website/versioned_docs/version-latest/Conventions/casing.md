---
sidebar_position: 1
---

# Casing

Durcno lets you write all identifiers in camelCase — the natural TypeScript convention — and automatically converts them to snake_case when generating SQL and migrations.

## How it works

Whenever you define a table, column, enum, or sequence, Durcno converts the name you provide to snake_case before using it in any SQL statement or migration file.

```typescript
export const BlogPosts = table("public", "blogPosts", {
  id: pk(),
  authorId: bigint({ notNull }),
  publishedAt: timestamp({ notNull }),
});
```

The generated SQL uses snake_case throughout:

```sql
CREATE TABLE "public"."blog_posts" (
  "id" bigserial PRIMARY KEY,
  "author_id" bigint NOT NULL,
  "published_at" timestamp NOT NULL
);
```

You write TypeScript-style names; Durcno takes care of the rest.

## What gets converted

Every identifier you pass to a Durcno schema builder is automatically converted:

| Builder                       | Identifier(s) converted          |
| ----------------------------- | -------------------------------- |
| `table(schema, name, ...)`    | schema, table name, column names |
| `enumtype(schema, name, ...)` | schema, enum name                |
| `sequence(schema, name, ...)` | schema, sequence name            |

Enum _values_ (e.g. `["admin", "user"]`) are **not** converted — they are stored in the database exactly as written.

## Conversion rules

The conversion follows standard camelCase-to-snake_case rules:

| You write           | SQL uses              |
| ------------------- | --------------------- |
| `blogPosts`         | `blog_posts`          |
| `firstName`         | `first_name`          |
| `userRole`          | `user_role`           |
| `publishedAt`       | `published_at`        |
| `XMLParser`         | `xml_parser`          |
| `parseHTTPResponse` | `parse_http_response` |

Consecutive uppercase sequences (acronyms) are handled correctly: `XMLParser` becomes `xml_parser`, not `x_m_l_parser`.

## Column names in queries

When querying, results are returned with the camelCase keys you defined — not the snake_case names from the database. This keeps your application code consistent with your schema definitions.

```typescript
const posts = await db.from(BlogPosts).select();

// Result keys match your schema definition
posts[0].authorId; // ✅
posts[0].author_id; // ❌ TypeScript error
```

## Naming recommendations

- **Table names**: camelCase (`blogPosts`, `userProfiles`)
- **Column names**: camelCase (`firstName`, `createdAt`)
- **Enum names**: camelCase (`userRole`, `orderStatus`)
- **Schema names**: camelCase (`public`, `appData`)

:::tip
You never need to write `blog_posts` or `first_name` anywhere in your schema. Stick to camelCase everywhere and let Durcno handle the PostgreSQL side.
:::