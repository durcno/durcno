---
bump: patch
---

# fix(migrations): improve internal table dependency tracking

Fixed a bug in the `orderTables` function where self-referencing tables (tables that have foreign keys to themselves) were being included in the dependency list.

The fix adds an additional filter condition to exclude tables from their own dependency list, preventing circular reference issues during migration generation.