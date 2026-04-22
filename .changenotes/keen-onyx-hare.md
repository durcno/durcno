---
bump: patch
---

# change(cli): remove type:module setup from init

The `init` command no longer sets `"type": "module"` in their `package.json`, and the `setTypeModule()` helper has been removed entirely.

This step was removed because Durcno no longer loads ESModule TypeScript files using `require()`. As a result, `"type": "module"` is no longer a requirement imposed by Durcno, and setting it during `init` is no longer necessary.