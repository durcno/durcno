---
description: >
  Validate a documentation page under website/docs/ against the source code in src/.
  Checks that all documented APIs, functions, arguments, types, options, and examples
  accurately reflect the current implementation. Fixes any drift by updating the docs.
agent: agent
---

# Validate Documentation Against Source

You are given a documentation page from `website/docs/`. Your job is to verify every
technical claim in that page against the actual source code in `src/`, and fix any
discrepancies **in the documentation** (never modify source code).

## Input

The user will reference a specific doc file, e.g. `website/docs/Schema/columns.md`.

## Steps

### 1. Read the documentation page

Read the entire documentation file the user provides.

### 2. Inventory documented items

Extract a checklist of every technical claim:

- Exported function/class/type names and their import paths
- Function signatures (parameter names, types, defaults, return types)
- Constructor or factory options (names, types, whether required/optional, defaults)
- Chainable method names and their signatures
- Enum values, constant values
- SQL type mappings, JS/TS type mappings
- Code examples (imports, API usage, expected behavior)

### 3. Locate and read the source

For each documented item, find the corresponding source file(s) in `src/`.
Verify against the **actual implementation**, not just type declarations.
Also check `src/index.ts` to confirm the item is publicly exported.

### 4. Compare and identify discrepancies

Flag any of:

- **Missing**: documented API that doesn't exist in source
- **Renamed**: API exists but under a different name
- **Signature mismatch**: different parameters, types, defaults, or return type
- **Wrong options**: documented options that don't exist, or missing options that do
- **Wrong type mapping**: incorrect SQL or JS/TS type stated in docs
- **Outdated examples**: code that wouldn't compile or work against current source
- **Missing docs**: exported public APIs related to the page's topic that aren't documented

### 5. Fix the documentation

For each discrepancy, update the documentation file to match the source:

- Fix function names, signatures, options, types, and examples
- Add any missing public APIs that belong on this page
- Remove references to APIs that no longer exist
- Keep the existing writing style, structure, and formatting conventions

### 6. Report

After making changes, provide a brief summary listing:

- What was correct (no changes needed)
- What was fixed and why
- Any items that were ambiguous or need the user's decision

## Rules

- **Never modify source code** — only update `website/docs/` files.
- Do not touch `website/versioned_docs/`.
- Preserve the doc page's existing structure, tone, and Docusaurus frontmatter.
- When adding new sections for undocumented APIs, follow the page's existing patterns.
- If an API is exported from `src/index.ts` but intentionally undocumented (internal helpers, etc.), note it in your report but don't force-add it.
- Read source files thoroughly — don't rely on names alone; check actual implementations.