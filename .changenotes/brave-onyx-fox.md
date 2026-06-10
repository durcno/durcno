---
bump: patch
---

# fix(migration/ddl): extract DDLStatement to break recursive import

`DDLStatement`, `DDLStatementType`, `CustomStatement`, and `custom` were previously defined directly in `src/migration/ddl/index.ts`. Since other DDL modules (`schema.ts`, `table.ts`, `types.ts`, `indexes.ts`, `sequence.ts`) all imported `DDLStatement` from `./index`, this created a recursive import cycle.

The fix extracts these base definitions into a new dedicated file `src/migration/ddl/statement.ts`. All DDL modules now import `DDLStatement` from `./statement`, and `index.ts` re-exports everything from `statement.ts` — eliminating the circular dependency.