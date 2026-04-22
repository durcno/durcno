---
name: add-changenote
description: "Add a changenote for staged changes. Use when: creating a changenote, recording a change, documenting a code change for release."
argument-hint: "[Optionally provide <bump type>(patch/minor/major) and <title>. Pass --no-branch to skip branch creation]"
---

# Add a Changenote

Create a changenote that documents staged code changes for the next release.

## When to Use

- After making code changes that need to be tracked for the changelog
- When you want to record a patch, minor, or major change
- Before committing with `cngpac commit`

## Procedure

### 1. Review staged changes

Inspect what's staged to understand the scope and nature of the change:

```sh
git diff --staged | cat
```

If nothing is staged yet, stage the relevant files first (`git add ...`), then diff.

### 2. Determine bump type and title

Based on the diff, determine two things: the **bump type** and the **title**.

#### Bump type

| Bump    | When                                      |
| ------- | ----------------------------------------- |
| `patch` | Bug fixes, typo corrections, minor tweaks |
| `minor` | New features, non-breaking additions      |
| `major` | Breaking changes                          |

#### Title format

Titles follow the [Conventional Commits](https://www.conventionalcommits.org/) style:

```
<type>[optional scope]: <description>
```

- **`<type>`** — the category of the change (see table below)
- **`[optional scope]`** — a parenthesized chain of one or more nouns describing the section of the codebase affected, e.g. `fix(parser/tokenizer):`, `feat(cli):`
- **`<description>`** — a short, imperative-tense summary of the change (lowercase, no trailing period)

#### Common types

| Type     | Purpose                                                | Example                                   |
| -------- | ------------------------------------------------------ | ----------------------------------------- |
| `feat`   | A new feature or capability                            | `feat(cli): add preview command`          |
| `change` | A breaking or non-breaking behavior change             | `change: remove deprecated API`           |
| `impr`   | An improvement to a feature                            | `impr(cli): add error handling`           |
| `fix`    | A bug fix                                              | `fix: resolve crash on empty changenotes` |
| `refac`  | Code restructuring with no behavior change             | `refac(git): simplify commit logic`       |
| `docs`   | Documentation only                                     | `docs: update configuration guide`        |
| `test`   | Adding or updating tests                               | `test(prepare): add edge case coverage`   |
| `chore`  | Maintenance tasks (deps, tooling, config)              | `chore: upgrade vitest to v5`             |
| `perf`   | Performance improvement with no behavior change        | `perf: cache parsed changenotes`          |
| `style`  | Formatting, whitespace, or cosmetic changes (no logic) | `style: fix indentation in saver.ts`      |
| `ci`     | CI/CD configuration changes                            | `ci: add Node 24 to test matrix`          |
| `build`  | Build system or external dependency changes            | `build: switch bundler to tsdown`         |
| `revert` | Reverts a previous change                              | `revert: undo feat(cli): add preview`     |
| `meta`   | Repo metadata                                          | `meta: update sponsors`                   |

#### Tips

- Use **imperative mood** in the description: "add" not "added" or "adds".
- Keep the description under ~70 characters when possible.
- The scope is optional — omit it when the change is broad or the context is obvious.
- Add a `!` to the title if the change is a **breaking change**.

### 3. Create the changenote

Run the CLI to generate the changenote markdown file:

```sh
pnpm exec cngpac change <bump> "<title>"
```

Replace `<bump>` with `patch`, `minor`, or `major`, and `<title>` with the change description.

This creates a file at `.changenotes/<random-name>.md` with this structure:

```markdown
---
bump: <bump>
---

# <title>
```

### 4. Add a description body

Create a body summarizing what the staged changes do - derived from the diff in step 2(Review staged changes).

- Keep it concise but informative: what changed, why, and any notable details.
- Don't write sentences in a single paragraph. Break it up into paragraphs for readability.
- Add small code snippets to illustrate the new behavior or API changes, if applicable.
- No need to mention about /website/docs/ changes in the changenote body.

Then append the body below the title heading of the newly created changenote file.

### 5. Stage

Stage the changenote after editing it every time:

```sh
git add .changenotes/<changenote-filename>
```

### 6. Create a branch

> **Skip this step** if `$ARGUMENTS` contains `--no-branch`.

1. **Classify the branch type** by using the `<type>` from the changenote title directly (e.g. a title of `feat(cli): add preview command` → branch type `feat`).

2. **Determine the work description** based on the changenote title:
   - If `$ARGUMENTS` is present, use it
     Keep `<short-description>` kebab-case, ASCII-only, and ideally 3 to 6 words.

3. **Generate branch name** `<type>/<short-description>`.

4. **Choose the base** without prompting:
   1. Run `git branch --show-current` — if the output is a non-default branch name, branch from it. If it's empty (detached HEAD), branch from the current commit.
   2. Run `git remote` — use `origin` if present, otherwise the first listed remote. If no remotes exist, skip remote checks.
   3. The default branch is `main`. Fall back to `master` if `main` doesn't exist on the remote.

5. **Avoid collisions** by appending `-2`, `-3`, and so on until the name is unused locally and remotely.

6. **Create the branch:**
   ```bash
   git checkout -b <branch-name>
   ```
   Report the final branch name, but do not stop for confirmation.

## Completion Criteria

- [ ] Changenote file exists in `.changenotes/` with correct bump type and title
- [ ] Body describes the staged changes accurately
- [ ] Changenote is staged
- [ ] Branch created (unless `--no-branch` was passed or already on a non-default branch)