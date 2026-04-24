---
bump: minor
---

# impr(logger): log query execution duration

`execQuery` now measures wall-clock time around each query and passes `durationMs` to the logger alongside the existing `sql` and `arguments` fields.

The built-in Winston formatter renders the new field as a `Duration` section in the box-drawing output:

```
  ├ Duration
  │ 3.21ms
```

Internally, `$Client` and `$Pool` were unified under a shared abstract base class `$QueryExecutor` so the timing logic only lives in one place.