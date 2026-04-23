---
bump: patch
---

# fix(rq): throw clear error when relation column missing .references()

When using `many`, `one`, or `fk` in a `relations()` definition, the relation column must call `.references()` to declare the join target. If `.references()` was omitted, the relational query (`db.query(...).findMany(...)`) would crash with a cryptic runtime error.

Now a clear `Error` is thrown with a message that identifies the offending column and tells you exactly what to fix.