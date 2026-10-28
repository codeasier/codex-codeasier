# Install and verify the Codex bridge

Install the runtime in the environment that launches MCP, not merely in a different terminal, cloud worker or remote service. A Codex marketplace installation supplies the bridge, not its Python runtime.

## Pinned upstream runtime

Requires Python 3.11+, Git, and a Codex release with plugin support. The lock-reading helper in the commands below uses Node.js 22+; Node is not a Python runtime dependency. From a checkout of this repository, install the exact source recorded in [gitcode-runtime.lock.json](../../gitcode-runtime.lock.json):

```bash
python3 -m venv .venv-gitcode
. .venv-gitcode/bin/activate
python -m pip install "$(node scripts/gitcode-runtime.mjs)"
gitcode-mcp --help
gitcode-clone --help
```

Use the corresponding activation command on Windows. Keep this environment's scripts directory on the MCP host's `PATH`; GUI applications and services might not inherit your shell's environment.

For an existing uv tool installation, the equivalent replacement is:

```bash
uv tool install --reinstall "$(node scripts/gitcode-runtime.mjs)"
```

The helper prints one PEP 508 Git requirement pinned to a full upstream commit. It neither installs anything nor reads credentials. Do not substitute floating `main`, assume a same-numbered PyPI package has the same source, or install from this repository's removed `packages/gitcode-mcp` path. See [compatibility and rollback](migration.md).

## Credentials and permissions

Follow the upstream [local PAT configuration](https://github.com/codeasier/gitcode-cli/blob/main/docs/gitcode/setup.md) in the actual MCP execution environment. Start with read-only mode and the intended repository allowlist. No secrets are stored in this plugin or its manifests.

Public OAuth servers are a separate installation using per-connection credentials; they must not use a process-wide PAT fallback. See upstream [OAuth setup](https://github.com/codeasier/gitcode-cli/blob/main/docs/gitcode/oauth.md) and [deployment](https://github.com/codeasier/gitcode-cli/blob/main/docs/gitcode/deployment.md).

## Install the Codex plugin

```bash
codex plugin marketplace add codeasier/codex-codeasier
codex plugin add gitcode@codex-codeasier
```

Reuse an existing marketplace registration. For development, register the checkout's absolute path instead of its GitHub source. Start a new Codex thread after installation, then invoke `$gitcode-workflow`.

To refresh an existing marketplace:

```bash
codex plugin marketplace upgrade codex-codeasier
codex plugin add gitcode@codex-codeasier
```

Refresh the runtime from the updated lock separately. The plugin still launches `gitcode-mcp` over stdio; neither command names nor marketplace/install names changed.

## Smoke checks

From the dedicated Python environment installed above, with its scripts directory on `PATH`:

```bash
python -I scripts/smoke-gitcode-bridge.py
```

The bridge smoke checks installed Git provenance and exact package version, both command entries, the actual `mcp.json` command, all 31 writable and 19 read-only tool names, and read-only/allowlist/input rejection. It removes GitCode credentials and configuration, uses an empty temporary home, and performs no live GitCode operation. It rejects a same-version package from an unverified source or a `PATH` that selects a different Python environment.

This does not validate real OAuth linking, a public server's tool catalog or live API acceptance. Follow upstream [connection verification](https://github.com/codeasier/gitcode-cli/blob/main/docs/gitcode/connect-dot.md) for those checks. A local bridge result is not deployment evidence.

## Updates and removal

Plugin and runtime upgrades are independent. Review the compatibility record and lock changes before reinstalling the runtime. Preserve the previous exact requirement or isolated environment for rollback; do not infer the server needs upgrading merely because the plugin was refreshed.

```bash
codex plugin remove gitcode@codex-codeasier
```

Removing the plugin does not uninstall the Python package, revoke an account or stop a public service. Clone/pull/push and tests still require an actual coding environment and its own Git authentication; see the upstream [clone instructions](https://github.com/codeasier/gitcode-cli/blob/main/docs/gitcode/setup.md#clone-in-the-coding-environment).
