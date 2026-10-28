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

## Real Codex client acceptance in CI

The `codex-plugin-client` job uses the official [Codex CLI 0.165.0 release](https://github.com/openai/codex/releases/tag/rust-v0.165.0), pinned by release URL and SHA256. It installs the locked runtime in a fresh Python environment and uses a separate temporary `HOME` / `CODEX_HOME`, with an allowlisted environment and no account credentials.

The job runs the real [`codex plugin marketplace add`, `plugin add` and `plugin list` commands](https://learn.chatgpt.com/docs/cli/reference#codex-plugin) against the checked-out marketplace. It verifies the cached installation matches the plugin files, then uses the official [app-server discovery API](https://learn.chatgpt.com/docs/app-server) from an unrelated directory to find the enabled `gitcode-workflow` skill and the plugin's 31 MCP tools. No model turn, login, OAuth flow or live GitCode operation is requested.

The installed cache's unchanged `mcp.json` command is also checked through the bridge protocol smoke for 31 / 19 tool views and all 12 read-only write denials. **The 19-tool view is an installed-command check, not a Codex-client view check:** Codex does not forward arbitrary `GITCODE_*` environment variables by default, and this job does not change the plugin or add MCP configuration overrides to make it do so.

The job preserves JSON installation/discovery evidence. Missing commands, required authentication, interaction, discovery errors or timeouts fail the job explicitly; there is no skip or synthetic login fallback. It does not validate the desktop UI, a real account connection or production OAuth deployment.

## Updates and removal

Plugin and runtime upgrades are independent. Review the compatibility record and lock changes before reinstalling the runtime. Preserve the previous exact requirement or isolated environment for rollback; do not infer the server needs upgrading merely because the plugin was refreshed.

```bash
codex plugin remove gitcode@codex-codeasier
```

Removing the plugin does not uninstall the Python package, revoke an account or stop a public service. Clone/pull/push and tests still require an actual coding environment and its own Git authentication; see the upstream [clone instructions](https://github.com/codeasier/gitcode-cli/blob/main/docs/gitcode/setup.md#clone-in-the-coding-environment).
