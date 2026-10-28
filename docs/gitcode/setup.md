# Install and verify GitCode

Run installation in the environment that will launch the MCP server. A terminal export on your laptop does not configure an already-running desktop app, a remote worker, or a separate cloud task.

## Install the runtime from this repository

With Python 3.11+ and [uv](https://docs.astral.sh/uv/guides/tools/):

```bash
cd /absolute/path/to/codex-codeasier
uv tool install ./packages/gitcode-mcp
gitcode-mcp --help
gitcode-clone --help
```

Alternatively, activate your intended Python virtual environment and install from the checkout:

```bash
python -m pip install ./packages/gitcode-mcp
gitcode-mcp --help
gitcode-clone --help
```

Use `uv tool install --reinstall ./packages/gitcode-mcp` to replace an existing local uv installation after updating this checkout. For a virtual environment, rerun its `python -m pip install ./packages/gitcode-mcp` command.

Make `gitcode-mcp` available on the MCP host's `PATH`. If a GUI or service uses a different `PATH`, configure that host to resolve the installed executable. The plugin's command intentionally does not reach outside its package directory to an adjacent source checkout.

## Configure the service account

Create a token using GitCode's [PAT settings](https://docs.gitcode.com/docs/help/home/user_center/security_management/user_pat/) and supply it through your execution environment's secret mechanism. The server accepts `GITCODE_TOKEN`, with `GC_TOKEN` as an alternative.

For an interactive Bash session, a hidden prompt avoids putting the literal token in command history:

```bash
read -r -s -p 'GitCode token: ' GITCODE_TOKEN
export GITCODE_TOKEN
```

Do not set both token variables to different accounts. Start with the repository scope you intend to use:

```bash
export GITCODE_MCP_ALLOWED_REPOS='owner/repository,owner/another-repository'
export GITCODE_MCP_READ_ONLY=true
```

| Setting | Meaning |
| --- | --- |
| `GITCODE_TOKEN` or `GC_TOKEN` | GitCode API credential, retained by the server process |
| `GITCODE_USERNAME` | Your actual GitCode username; needed when the clone helper uses a token through temporary HTTPS askpass |
| `GITCODE_MCP_ALLOWED_REPOS` | Optional comma-separated `owner/repo` allowlist; unset allows repositories accessible to the token |
| `GITCODE_MCP_READ_ONLY` | Set `true` to reject write operations; default is `false` |
| `GITCODE_MCP_HTTP_TOKEN` | Separate bearer credential protecting HTTP MCP access; at least 32 characters, different from the GitCode token, required for non-loopback binding |
| `GITCODE_MCP_ALLOWED_HOSTS` | Optional HTTP Host allowlist; defaults to loopback hostnames and addresses |
| `GITCODE_MCP_TIMEOUT` | Upstream request timeout in seconds; default 30, range 1–120 |
| `GITCODE_MCP_MAX_RESPONSE_BYTES` | Upstream response size limit; default 2,000,000 bytes, range 1,024–10,000,000 |

The allowlist and read-only mode apply on the server, independently of model instructions and host approval settings. To allow the write workflow already authorized by the user, set `GITCODE_MCP_READ_ONLY=false` in the server's environment and restart that server. GitCode permissions and branch protections still apply.

## Install the Codex plugin

After installing the runtime and configuring the MCP host environment:

```bash
codex plugin marketplace add codeasier/codex-codeasier
codex plugin add gitcode@codex-codeasier
```

For a checkout under development, register its absolute path instead of the GitHub source. If that marketplace name is already registered, use its existing source or update it through your Codex client's supported marketplace commands.

```bash
codex plugin marketplace add /absolute/path/to/codex-codeasier
codex plugin add gitcode@codex-codeasier
```

Start a new Codex thread so the installed skill and MCP declaration are discovered. Use `$gitcode-workflow` to invoke the workflow explicitly. The plugin uses stdio; no HTTP listener or OAuth server is needed for this local installation.

After a Git marketplace update, refresh and reinstall the plugin as well as updating the runtime:

```bash
codex plugin marketplace upgrade codex-codeasier
codex plugin add gitcode@codex-codeasier
```

Removing this plugin does not delete an independently installed Python runtime, revoke a GitCode token, or stop a separately deployed tunnel:

```bash
codex plugin remove gitcode@codex-codeasier
```

## Smoke checks

From the Python environment containing the package, run:

```bash
python -m gitcode_mcp.smoke
```

The default check starts a subprocess, initializes MCP, lists tools, and exercises local input validation without calling GitCode. To explicitly verify a real repository with your configured token, run the optional read-only account check:

```bash
python -m gitcode_mcp.smoke --repo owner/repository
```

Use `python -m gitcode_mcp.smoke --help` for details. A local protocol check is not evidence that your GitCode account or dot connection works.

For an interactive inspection, launch [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector), choose stdio, and use `gitcode-mcp` as the command:

```bash
npx @modelcontextprotocol/inspector@latest
```

Verify that the server lists the [documented tools](tools.md). Call `gitcode_get_repository` and `gitcode_get_clone_info` for an allowed repository. Confirm that the returned repository is correct and clone URLs contain no credentials. Keep this first check read-only. In the installed plugin, repeat the repository lookup to confirm the client's process has the same configuration.

## Clone in the coding environment

Install the runtime and Git in the environment where editing and tests will run. Choose a new destination whose parent directory already exists. For HTTPS with this environment's token, set your actual GitCode username:

```bash
export GITCODE_USERNAME='your-gitcode-username'
gitcode-clone owner/repository /absolute/path/to/work/repository
```

Optional arguments select a branch, limit clone depth, or use SSH:

```bash
gitcode-clone owner/repository /absolute/path/to/work/repository --branch main --depth 1
gitcode-clone owner/repository /absolute/path/to/work/repository --ssh
```

Use a full clone if history or later branch operations need it. `--timeout SECONDS` sets the Git operation timeout, with a default of 300. Temporary HTTPS askpass requires a POSIX shell and the actual `GITCODE_USERNAME`; the helper does not guess a generic username. When `GITCODE_TOKEN` or `GC_TOKEN` is present, HTTPS selects that temporary PAT mode. To use an existing credential helper instead, leave those two token variables out of this clone subprocess:

```bash
env -u GITCODE_TOKEN -u GC_TOKEN gitcode-clone owner/repository /absolute/path/to/work/repository
```

SSH uses this environment's existing SSH setup. The helper does not obtain a token from the remote MCP service, embed one in the remote URL, or persist one in Git config.

Commit and push with your environment's configured Git credential helper or SSH identity. A token used only for the helper's temporary clone authentication will not automatically authenticate a subsequent native `git push`. Confirm authentication before relying on unattended code work.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `gitcode-mcp` cannot be found | Install it in the actual MCP execution environment and check that host's `PATH` |
| Local shell works, plugin fails authentication | The client may not inherit that shell's environment; configure its own secret delivery |
| A repository is rejected | Check owner/repo spelling, token access, and `GITCODE_MCP_ALLOWED_REPOS` |
| A write is rejected | Check server read-only mode, GitCode permissions, and the host's action policy |
| Clone succeeds, push fails | Configure a persistent credential helper or SSH for the coding environment |
| dot cannot see a cloned directory | Inspect which environment ran the clone; remote server paths are not dot paths |
