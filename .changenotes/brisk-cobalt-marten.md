---
bump: minor
---

# feat(filters): add LIKE/ILIKE ESCAPE modifier

`like()` and `ilike()` now support a chainable `.escape()` modifier for PostgreSQL's `ESCAPE` clause. It accepts a string literal or an `Arg<string>`, so a custom escape character also works in prepared queries.

```typescript
await db
  .from(Interests)
  .select("*")
  .where(() => ilike(Interests.content, containsPattern(token)).escape("!"));
```

`escape()` returns a new condition, leaving the original predicate unchanged. Existing predicates keep PostgreSQL's default backslash escape.
