# GitCode code publishing

The single-file publishing contract, size limits, Blob SHA rules and uncertain-write recovery are maintained upstream. These tools do not provide atomic multi-file commits or native Git push.

- [Authoritative upstream guide](https://github.com/codeasier/gitcode-cli/blob/main/docs/gitcode/code-publishing.md)
- [Existing service state migration and rollback](https://github.com/codeasier/gitcode-cli/blob/main/docs/gitcode/migration.md)
- [Codex bridge installation](setup.md)
- [Bridge compatibility and migration](migration.md)

Runtime source is fixed by [gitcode-runtime.lock.json](../../gitcode-runtime.lock.json). This page is retained for old links; it is not a second runtime implementation or deployment guide.
