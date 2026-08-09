---
bump: patch
---

# fix(query-builder): escape SQL identifiers and literals

This update introduces `escIdentifier` and `escLiteral` helper functions to properly escape PostgreSQL identifiers and string literals. These functions are now utilized across the query builders (e.g. for column aliases, table aliases, and JSON keys) to neutralize potential SQL injection vulnerabilities.