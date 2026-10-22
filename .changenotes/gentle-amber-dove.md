---
bump: major
---

# change(cli)!: drop deno runtime support

`durcno init` no longer detects Deno, and Durcno's supported runtimes are now Node.js and Bun.

Under Deno, the generated `durcno.config.ts` used to import Deno's own env loader. It now imports the standard one, like every other Node.js-compatible runtime:

```ts
// before, under Deno
import "@std/dotenv/load";

// after
import "dotenv/config";
```

Bun is unaffected — it keeps its built-in loader, so no import is emitted at all.

## Why

On October 9, 2026 the Deno team joined Cloudflare, and the announcement set the end of the standalone runtime: one more year of monthly releases carrying bug fixes and security updates, after which development stops. Deno remains MIT-licensed and open source, so the repository lives on, but the runtime is no longer where the work goes. The team is merging `celld` into `workerd` to make the Workers programming model self-hostable, and Deno Deploy itself shuts down in six months.

Cloudflare Workers was advertised as a supported target for the `postgres` connector. Durcno has never been tested against it, so the claim is removed rather than left standing as an untested promise.

Bun stays, for reasons of its own. Its roadmap still centers on Node.js compatibility — its docs describe it as aiming to be a drop-in replacement for Node.js apps, where Node.js APIs, `node_modules`, and your framework work as-is — and it ships a native PostgreSQL client that Durcno targets directly through its own connector. It is also under active development rather than winding down.

## Breaking

- `durcno init` under Deno generates `import "dotenv/config"` instead of `import "@std/dotenv/load"`, and installs the `dotenv` package alongside it. A Deno project that wants the standard library loader must import `@std/dotenv/load` itself.
