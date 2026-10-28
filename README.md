# codex-codeasier

Repository workflows and service integrations distributed through a Codex marketplace. The original `codex-codeasier` workflow plugin is adapted from [codeasier/claude-codeasier](https://github.com/codeasier/claude-codeasier) through [open-codeasier](https://github.com/codeasier/open-codeasier).

| Plugin | Purpose | Runtime |
| --- | --- | --- |
| `codex-codeasier` | Evidence-driven issue, PR, specification, and worktree workflows | Git and authenticated GitHub CLI |
| `gitcode` | GitCode repository, issue, and PR tools plus a coding workflow | Python 3.11+ and the separately installed GitCode MCP package |

## Workflow Plugin Requirements

- A Codex release with `codex plugin` support
- Git
- An authenticated [GitHub CLI](https://cli.github.com/) session for issue and pull-request workflows

Check GitHub CLI authentication with:

```bash
gh auth status
```

## Install From GitHub

Add this repository as a Codex marketplace, then install the plugin:

```bash
codex plugin marketplace add codeasier/codex-codeasier
codex plugin add codex-codeasier@codex-codeasier
```

Start a new Codex thread after installation so Codex discovers the plugin's skills.

Inspect the configured marketplace and plugin with:

```bash
codex plugin marketplace list
codex plugin list --marketplace codex-codeasier
```

## Update

Refresh the Git marketplace snapshot and reinstall the plugin from it:

```bash
codex plugin marketplace upgrade codex-codeasier
codex plugin add codex-codeasier@codex-codeasier
```

Start a new Codex thread after reinstalling to pick up updated skills.

## Uninstall

Remove the installed workflow plugin. Remove the marketplace only when none of its plugins are needed:

```bash
codex plugin remove codex-codeasier@codex-codeasier
codex plugin marketplace remove codex-codeasier
```

## Local Development

Register a local checkout as the marketplace source:

```bash
codex plugin marketplace add /absolute/path/to/codex-codeasier
codex plugin add codex-codeasier@codex-codeasier
```

After changing the local plugin, run the validation command, reinstall it, and start a new Codex thread.

For Codex versions where local marketplace registration is unavailable, copy only the plugin directory, not the repository root:

```bash
mkdir -p ~/.codex/plugins
cp -R /absolute/path/to/codex-codeasier/plugins/codex-codeasier \
  ~/.codex/plugins/codex-codeasier
```

## Use

Open Codex in the repository you want to operate on and invoke a skill explicitly with its `$` marker:

```text
$issue-review Review issue 42.
$issue-resolve Resolve issue 42.
$spec-write Specify a batch export feature.
```

Natural-language requests such as `Use issue-review for issue 42` also work, but an explicit marker avoids skill-discovery ambiguity.

| Skill | Purpose |
| --- | --- |
| `docs-governance` | Audit or fix documentation structure, links, localization, and repository consistency. |
| `handoff` | Create or load a project handoff for transferring an active agent task between sessions. |
| `issue-resolve` | Resolve one repository issue safely in an isolated Git worktree. |
| `issue-review` | Analyze whether one issue is real and reasonable, then post an evidence-based review comment. |
| `issue-submit` | Discover a remote repository's issue templates and submit a confirmed issue. |
| `pr-followup` | Evaluate and address pull-request review feedback with evidence and minimal scope. |
| `release-prep` | Prepare a repository release through its discovered workflow and changelog conventions. |
| `spec-run` | Execute an approved spec package and maintain verified task and checklist progress. |
| `spec-write` | Create an implementation-ready spec package without changing product code. |
| `understand-me` | Challenge and refine an idea through an explicit decision tree and one question at a time. |
| `worktree-clean` | Inspect Git worktrees and remove only those proven safe to delete. |

## GitCode Plugin

Install the runtime in the same environment that launches the MCP server, then install the separate plugin:

```bash
cd /absolute/path/to/codex-codeasier
uv tool install ./packages/gitcode-mcp
codex plugin marketplace add codeasier/codex-codeasier
codex plugin add gitcode@codex-codeasier
```

If this marketplace is already registered, reuse it. Configure `GITCODE_TOKEN` or `GC_TOKEN` through the host's secret mechanism before starting the plugin. Use `GITCODE_MCP_ALLOWED_REPOS` to restrict repositories and `GITCODE_MCP_READ_ONLY=true` for read-only operation. See the [GitCode setup guide](docs/gitcode/setup.md) for a pip alternative, credentials, smoke checks, and updates.

Invoke `$gitcode-workflow` for GitCode tasks. Its MCP tools read repository data and manage issues and PRs; `gitcode_get_clone_info` returns credential-free URLs. Clone, edit, test, commit, and push in an actual coding environment with its own Git authentication. A remote MCP server does not share its filesystem or credentials with dot.

For a cloud dot, use the [Secure MCP Tunnel setup](docs/gitcode/connect-dot.md) with the stdio server. A local marketplace installation does not deploy the server or register a cloud connection. The [GitCode guide](docs/gitcode/README.md) also covers the tool catalog and optional HTTP/Docker deployment.

## Unsupported Workflow Plugin Features

Session review and all other session-oriented workflows are intentionally excluded from `codex-codeasier`. That plugin does not read, normalize, inspect, or manage Codex or OpenCode sessions.

## Validate

The workflow plugin has no runtime dependencies. Validate the marketplace manifests, plugin metadata, skill frontmatter, and platform boundaries with Node.js 22 or newer:

```bash
node scripts/validate.mjs
```

The GitCode runtime has its own Python dependencies and checks. See [GitCode setup](docs/gitcode/setup.md#smoke-checks) and the package's development instructions.

MIT licensed.
