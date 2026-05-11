---
name: update-docs
description: "Diff git staged changes and update related website/docs/ pages to reflect them"
agent: "agent"
tools: ["vscode/memory", "execute", "agent", "search", "web", "read", "edit"]
---

Run the following command to get the git diffs info:

```bash
git diff --staged | cat
```

If there is no staged diff, run:

```bash
git diff HEAD | cat
```

Use the diff output to:

1. **Identify which source areas changed** — CLI commands, config options, changenote format, plugin APIs, versioning behavior, etc.
2. **Find the relevant doc pages** in `website/docs/` — read the directory structure and page contents to determine which pages cover the changed behavior. (Do not touch any files in `website/versioned_docs/`.)
3. **Read the identified doc pages** in full before editing.
4. **Update only the sections that reflect the changed behavior** — add, remove, or reword documentation to match the new code. Do not rewrite unrelated sections.
5. Keep the doc style consistent: use the same heading levels, table formatting, and code block conventions already present in each file.

After editing, run the website build command to check for broken links:

```bash
cd website && pnpm run build 2>&1
```

If the build reports any broken links, fix them by updating the relevant link targets in `website/docs/` so the build passes. Repeat until the build succeeds.

After the build passes, briefly summarize which pages were updated and what changed.