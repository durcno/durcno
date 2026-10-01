---
bump: patch
---

# fix(cli): fix cli version lagging one release behind

Fix an issue where the CLI version reported by the published package was always one version behind the release.

Previously, the CI workflow built the package before running the versioning step. Because the build script inlines the `version` field from `package.json` into the bundled CLI via `process.env.VERSION`, the distributed CLI binary retained the pre-bump version rather than the newly published release version.

The build step is now configured via `cngpac.config.ts` (`build.script: "build"`), ensuring the package is built after the version bump and before publishing. In addition, the unbundled fallback version in `src/cli/index.ts` was updated from `"1.0.0"` to `"0.0.0"`.
