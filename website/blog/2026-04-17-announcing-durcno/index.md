---
slug: announcing-durcno
title: Announcing Durcno - A PostgreSQL Query Builder and Migration Manager for TypeScript
authors: [almahdi404]
tags: [announcement]
---

I'm excited to announce **Durcno**, a PostgreSQL Query Builder and Migration Manager for TypeScript, designed with intuitive abstractions, robust type safety, and truly smart migration management in mind.

<!-- truncate -->

## History

I migrated from the Django ecosystem to TypeScript, seeking the type safety and DX that Python could not provide. My initial choice for database access in TypeScript was Drizzle ORM, largely because I preferred the simple, simple abstraction over PostgreSQL that query builders like Drizzle offer, as opposed to the high-level abstraction and black-box behavior of traditional ORMs like Django.

However, while Drizzle ORM provided a clean abstraction, I found myself missing the maturity and powerful migration management that Django delivers. The slow pace of development in Drizzle ORM, especially around migrations and critical hanging bugs, became a source of frustration. This gap inspired me to build my own query builder and migration manager from scratch.

To be honest, a few core ideas in Durcno are inspired by Drizzle ORM, and perhaps Durcno would never exist if Drizzle ORM wasn't there. But Durcno aims to go further, especially in migration management and developer experience.

The TypeScript ecosystem has seen significant innovation in database tooling in recent years, but Durcno is here to combine the best from every ecosystem, to bring the future into the present.

## Why Durcno?

Instead of just being another query builder, Durcno is built to be the defacto type safe PostgreSQL wrapper for rapid, collaborative and agentic development. Durcno focuses on three core pillars:

### Intuitive Abstraction

Durcno provides clean, expressive definitions and queries that map naturally to PostgreSQL. Your schema definitions read like documentation, and your queries feel like writing SQL but with full type safety. There's no magic or hidden complexity; what you write is what you get.

### Extended Type Safety

Durcno goes beyond basic type inference. It provides extended, rigorous, compile-time type safety across your entire database interaction layer. From complex joins to advanced aggregations, if it compiles, you can trust it to run correctly.

### Robust Migrations

Managing schema changes is historically painful. Durcno features a robust migrations system designed from the ground up for modern workflows. It treats schema evolution as a first-class citizen, with a powerful set of built-in commands:

- **`durcno generate`** — Auto-generate migrations from your schema changes
- **`durcno migrate`** — Apply pending migrations to your database
- **`durcno down <migration>`** — Rollback a specific migration
- **`durcno squash <start> <end>`** — Squash a range of migrations into one
- **`durcno status`** — View the current migration status at a glance

Each migration produces a dedicated folder with separate `up.ts` and `down.ts` files, making every change fully reversible and easy to review.

## Looking Forward

By focusing exclusively on PostgreSQL, Durcno is free to innovate and move faster than existing ORMs in the JavaScript ecosystem that spread themselves thin across multiple databases. This singular focus means we can leverage PostgreSQL-specific features deeply and ship improvements at a pace that multi-database tools simply can't match.

Although Durcno has been baked in private for a long time, it is still in an **alpha stage**. There are rough edges to smooth out and APIs that may evolve based on real-world usage. With feedback from the community, the plan is to reach a **beta stage within July 2026**.

Check out the [documentation](/docs/latest/intro) to learn more and start building with Durcno today!