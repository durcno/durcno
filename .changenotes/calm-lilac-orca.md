---
bump: major
---

# change!: raise minimum Node.js to 26.13.0

Durcno now requires Node.js 26.13.0 or newer. `engines.node` is raised to `>=26.13.0`, so package managers that honor the field refuse installs on older runtimes.

The same floor is used by the development toolchain and CI: `.nvmrc` pins `v26.13.0`, and the GitHub Actions workflows run on `26.13.0`.

`@types/node` moves to `^26.6.6` to match the supported runtime.
