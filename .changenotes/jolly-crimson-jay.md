---
bump: minor
---

# feat(logger): add error logging for failed queries

Query execution logging now reports both successful and failed queries. When a query throws, the logger receives an `error()` call with the SQL text, bound arguments, and elapsed time, while successful executions continue to use `info()`.