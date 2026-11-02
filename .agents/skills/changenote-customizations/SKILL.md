---
name: changenote-customizations
description: "Durcno-specific changenote workflow customizations. Use when: creating or editing a changenote in durcno."
---

# Durcno Changenote Customizations

> Apply these overrides only in the durcno repository.

Project-specific overrides for the `changenote` skill. Load this alongside `changenote` and `commit-message`.

For title format, types, and scopes, follow the `commit-message` skill.

The generic `changenote` skill covers editing, staging, and branch creation; this skill only overrides the body rule.

## Body

- Omit `/website/docs/` changes from the body; describe the source, API, or behavior change instead.
- Break the description into paragraphs.
- Add small code snippets when they clarify new behavior or an API change.
