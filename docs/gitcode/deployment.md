# GitCode server deployment

Docker, Compose, Nginx and public HTTPS operations are maintained upstream. The old deploy/gitcode-mcp directory has moved; use the upstream source and runbook, not a removed local path.

- [Authoritative upstream guide](https://github.com/codeasier/gitcode-cli/blob/main/docs/gitcode/deployment.md)
- [Existing service state migration and rollback](https://github.com/codeasier/gitcode-cli/blob/main/docs/gitcode/migration.md)
- [Codex bridge installation](setup.md)
- [Bridge compatibility and migration](migration.md)

Runtime source is fixed by [gitcode-runtime.lock.json](../../gitcode-runtime.lock.json). This page is retained for old links; it is not a second runtime implementation or deployment guide.
