---
bump: patch
---

# perf(qb): inline variable access during row processing

Optimized query result mapping in `rq` and `select` query builders by removing intermediate variable declarations during row iteration. This reduces unnecessary memory allocations and improves performance when mapping database rows to TypeScript objects.