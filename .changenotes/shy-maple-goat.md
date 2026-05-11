---
bump: patch
---

# fix(cli): disable query logging via connector options

CLI commands (`migrate`, `down`, `status`, `shell`) were silencing query logging by setting `connector.pool` and `connector.logger` directly — redundant properties that were synced from `connector.options` in the constructor but not actually read back.

These properties have been removed from the `Connector` base class. The commands now correctly mutate `connector.options.pool` and `connector.options.logger` so the logger suppression takes effect.