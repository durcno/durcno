---
name: report-refactoring
description: "Analyze staged changes in src/ and produce a refactoring opportunity report"
agent: "agent"
---

Run the following command to get staged changes scoped to `src/`:

```bash
git diff --staged -- src/ | cat
```

If there are no staged changes in `src/`, fall back to:

```bash
git diff HEAD -- src/ | cat
```

If the diff is empty, report that there are no changes to analyze in `src/`.

---

Using the diff output, produce a **Refactoring Report** by applying the guidelines from
[.agents/skills/refactor/SKILL.md](../../.agents/skills/refactor/SKILL.md).

## Report Structure

### 1. Summary

One short paragraph describing what the staged changes do (feature, fix, restructure, etc.).

### 2. Code Smells Detected

For each smell found, produce a table row:

| #   | Smell | File & Location | Severity (low/med/high) | Notes |
| --- | ----- | --------------- | ----------------------- | ----- |

Severity guide:

- **high** — hurts readability or maintainability significantly, should be fixed before merge
- **med** — worth addressing soon but not a blocker
- **low** — minor style/clarity issue

Only report smells that are present in the diff (added or modified lines). Do not flag code that was not touched.

### 3. Refactoring Suggestions

For each high/medium smell, provide a concrete suggestion:

- **What to do** — specific operation (Extract Method, Introduce Named Constant, Replace Nested Conditional, etc.)
- **Why** — one sentence justification
- **Sketch** — a short before/after diff snippet (5–15 lines) showing the change

Skip low-severity smells unless there are no higher-priority ones.

### 4. Positive Observations

Call out up to three things the diff does well (good naming, clean guard clauses, proper typing, etc.).

### 5. Verdict

A one-line recommendation: **Ready to merge**, **Minor cleanup suggested**, or **Refactoring recommended before merge**.

---

Keep the report concise. Focus on actionable, specific feedback rather than general advice.