# codex-codeasier

Evidence-driven repository workflows packaged as a native OpenAI Codex plugin and distributed through a Codex marketplace. Adapted from [codeasier/claude-codeasier](https://github.com/codeasier/claude-codeasier) through [open-codeasier](https://github.com/codeasier/open-codeasier).

## Requirements

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

Remove the installed plugin. Remove the marketplace too if no longer needed:

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

## Unsupported Workflows

Session review and all other session-oriented workflows are intentionally excluded. This plugin does not read, normalize, inspect, or manage Codex or OpenCode sessions.

## Validate

The repository has no runtime dependencies. Validate the marketplace manifest, plugin manifest, exact skill set, frontmatter, and platform boundaries with Node.js 22 or newer:

```bash
node scripts/validate.mjs
```

MIT licensed.
