---
bump: major
---

# change(columns)!: change timestamp default and introduce timestamptz/timetz

The `timestamp` column builder now defaults to `timestamp without time zone` instead of opting into timezone-aware storage by default. This is a **breaking change** for projects that relied on the old behavior for UTC-aware timestamps.

### New builders: `timestamptz` and `timetz`

We added dedicated PostgreSQL column builders for timezone-aware SQL types:

- `timestamptz`: maps to `timestamp with time zone` and is now the recommended choice for UTC-safe timestamps.
- `timetz`: maps to `time with time zone` for timezone-aware time-of-day values.

```typescript
import { table, timestamptz, timetz, timestamp, time } from "durcno";

export const Events = table("public", "events", {
  // New timezone-aware alias types
  createdAt: timestamptz({ notNull: true }),
  startTime: timetz({ notNull: true }),

  localDate: timestamp({}),
  localTime: time({}),
});
```

The CLI `init` template and related docs/tests were updated to prefer `timestamptz` for UTC-aware timestamps.