---
bump: patch
---

# perf: cache entity brands and precompute prepared arg slots

Two internal optimizations on the query-building and prepared-statement hot paths. No public API, type, or SQL-generation changes.

## Cache entity brand lookups

The internal `is()` helper is called ~8–20 times per query build from 35 `Arg` sites plus every `isCol` / `isTableCol` check. When the value was not a direct `instanceof` match, it walked the entire constructor prototype chain on _every_ call, reading `entityType` off each level and re-reading the target brand each iteration.

The brand set of a class is immutable, so the walk now runs **once per constructor** and is cached in a `WeakMap`, and primitives (`string`, `number`, `bigint`, `boolean`, `symbol`) short-circuit before the walk since every entity is an object:

```typescript
const ctorBrands = new WeakMap<object, ReadonlySet<string>>();

// in is(), after the `instanceof` check fails:
const ctor = proto.constructor as object;
let brands = ctorBrands.get(ctor);
if (brands === undefined) {
  brands = brandsOf(ctor); // walk the prototype chain once
  ctorBrands.set(ctor, brands);
}
return brands.has(type[entityType]);
```

The cross-copy brand fallback that `is()` provides — which is what lets entities from a second installed copy of `durcno` still match — is preserved, since the cached set holds every brand reachable from the constructor.

## Precompute prepared argument slots

`prepare()` now resolves the argument key and its `handler` once, in `$N` placeholder order, and `run()` walks that array linearly. This removes the two string-keyed lookups into the args record that previously ran per argument on **every** execution — the path that matters most, since prepared statements exist to be executed repeatedly.

## Measured impact

Verified against isolated builds of the real dist, interleaved and taking the minimum of many runs, since shared-CPU noise otherwise swamps the signal:

|                                        | before  | after          |
| -------------------------------------- | ------- | -------------- |
| `is()` on a query-build operand mix    | 73 ns   | 9.2 ns (~8x)   |
| Query build with literal filter values | 5089 ns | 3963 ns (~21%) |
| `PrepareStatement.run()`, 7 arguments  | 95.3 ns | 70.6 ns (~26%) |

One caveat worth recording: the `is()` win applies to queries carrying **literal** values. Building a _prepared_ statement routes all 8 `is()` calls through the `instanceof` fast path, so statement construction is unaffected — the gain there comes from the `run()` change alone.

## Incidental fix

`is(Object.create(null), SomeEntity)` threw `TypeError: Cannot read properties of null (reading 'constructor')` on the null-prototype object; the new guard returns `false` instead. A differential check across 23 value kinds found no other behavior change.
