---
bump: patch
---

# fix(cli): suppress cli log output

CLI commands that apply or roll back migrations now disable the connector logger and use a single connection pool slot during their work. This prevents noisy SQL and transaction logs from leaking into normal command output while keeping the migration flow intact.