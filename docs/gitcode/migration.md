# GitCode bridge compatibility and migration

The cross-repository work is tracked in [codex-codeasier #9](https://github.com/codeasier/codex-codeasier/issues/9) and [gitcode-cli #155](https://github.com/codeasier/gitcode-cli/issues/155). GitCode runtime implementation and operations now belong to `gitcode-cli`; this repository owns the Codex bridge.

## Compatibility record

| GitCode plugin | Runtime | Source and capability baseline |
| --- | --- | --- |
| 0.2.0 (legacy) | 0.2.0 | Former in-repository package after OAuth PR #7; 28 tools, including 19 reads |
| 0.3.0 (legacy) | 0.3.0 | File publishing PR #8; 31 tools, including 19 reads |
| 0.4.0 | 0.3.0 | Upstream `codeasier/gitcode-cli` commit and package directory in [`gitcode-runtime.lock.json`](../../gitcode-runtime.lock.json); 31 / 19 tool views |

The fixed upstream delivery is [gitcode-cli PR #157](https://github.com/codeasier/gitcode-cli/pull/157), merged at [`68f9265d0755222d3ffc33ae6926f1e69e223c2f`](https://github.com/codeasier/gitcode-cli/commit/68f9265d0755222d3ffc33ae6926f1e69e223c2f). The lock uses that permanent commit, not the former migration branch.

The runtime remains `codeasier-gitcode-mcp`, imports as `gitcode_mcp`, and provides `gitcode-mcp` and `gitcode-clone`. It requires Python 3.11+. The separate CLI package remains `pygitcode` with its own version and Python support policy. Neither the original `codex-codeasier` workflow plugin nor its 11 generated skills is part of this version change.

The migration source is the complete [PR #8 head](https://github.com/codeasier/codex-codeasier/commit/f93b67bb7048e556b44322d48664522f32651920), also contained in [the merged baseline](https://github.com/codeasier/codex-codeasier/commit/27b542521c8483b5cf051ae001e791e08e92bb40). Upstream preserves the tool, authorization and single-file publication contracts; the bridge does not reimplement them.

## Upgrade a local Codex installation

1. Record the installed plugin version and exact runtime source. Keep the previous checkout, package or isolated environment until verification succeeds.
2. Read the new lock and [installation steps](setup.md). Install the pinned upstream runtime in the environment that launches MCP. Do not use `pip install ./packages/gitcode-mcp` from this repository: that implementation has moved.
3. Refresh the marketplace and reinstall `gitcode@codex-codeasier`. Its install name and stdio command are unchanged; restart the relevant Codex thread to rediscover the skill and tools.
4. Run the bridge smoke from the same Python environment and check the installed plugin's tool discovery. A writable runtime has 31 tools, a read-only runtime 19. Keep actual account checks read-only unless a particular mutation is authorized.
5. Preserve repository allowlists, credential delivery and read-only policy. The bridge never adds a credential fallback or broadens an OAuth grant.

The lock-reading helper emits an exact Git requirement, not a release request. This migration does not assume a PyPI publication, create a tag or deploy a server. Bridge CI verifies that the installed distribution's Git provenance matches the lock; the runtime version number alone is insufficient.

## Public OAuth services are a separate upgrade

Installing or refreshing the Codex bridge does not upgrade an existing HTTP service. Follow the upstream [state handover and rollback runbook](https://github.com/codeasier/gitcode-cli/blob/main/docs/gitcode/migration.md) and [deployment guide](https://github.com/codeasier/gitcode-cli/blob/main/docs/gitcode/deployment.md).

The required operator checks include the existing public URL, `/mcp`, issuer/resource, callback, client configuration, encrypted SQLite state, encryption key and actual Docker volume. A Compose logical name alone is not proof of the same volume. Stop the old instance before the new instance takes ownership; never run both against the authorization store. Do not use `down -v` or rotate the encryption key as part of a repository move.

Cross-version synthetic state tests and CI do not replace deployment-time verification of a real account's still-valid access/refresh tokens. Production cutover, live GitCode writes, new credentials and real authorization data are not actions performed by this repository change.

## Rollback

For the local bridge, return to the recorded previous plugin snapshot and runtime environment, or use the [pre-migration 0.3.0 baseline](https://github.com/codeasier/codex-codeasier/tree/27b542521c8483b5cf051ae001e791e08e92bb40). That historical revision retains the old package path. Reinstall the plugin from the chosen local marketplace snapshot and start a new thread; rerun its documented verification. Do not reset a shared branch or force-push to achieve rollback.

For a public service, stop the new instance and restore the previous image/commit with the same compatible state and key. Follow the upstream runbook before restoring a database snapshot: blindly restoring an older snapshot can discard refresh-token rotations or authorizations created after the backup. Keep a consistent offline backup for disaster recovery. No rollback step should expose a token or credential in a command argument or log.

## Maintenance boundaries

- Change the runtime lock only after verifying the target source, independently installable package and upstream checks. Re-run bridge CI for that exact commit.
- Keep plugin and runtime versions independent; update the compatibility record when either changes.
- Maintain only marketplace/manifest validation, source validation, workflow-generation checks and bridge smoke here. Runtime regression tests, wheel/sdist builds, OAuth compatibility and deployment validation are upstream responsibilities.
- Preserve `workflow-source.lock.json` and all generated workflow skills. Their upstream is `codeasier/open-codeasier`, not `gitcode-cli`.
- Existing runtime documentation URLs in this repository remain short navigation pages; do not recreate a second evolving runtime manual here.
