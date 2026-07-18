# Codex Marketplace Installation Design

## Goal

Publish `codeasier/codex-codeasier` as a Git-backed Codex plugin marketplace so users can discover and install `codex-codeasier` with the Codex plugin CLI.

The supported installation flow is:

```bash
codex plugin marketplace add codeasier/codex-codeasier
codex plugin add codex-codeasier@codex-codeasier
```

## Repository Layout

Convert the repository from a plugin rooted at the repository root into a single-plugin marketplace:

```text
codex-codeasier/
├── .agents/plugins/marketplace.json
├── plugins/codex-codeasier/
│   ├── .codex-plugin/plugin.json
│   └── skills/*/SKILL.md
├── scripts/validate.mjs
└── README.md
```

The repository remains capable of hosting additional plugins later, but this change adds only `codex-codeasier`.

## Marketplace Manifest

Create `.agents/plugins/marketplace.json` with:

- Marketplace identifier `codex-codeasier`.
- Display name `Codeasier`.
- One plugin entry named `codex-codeasier`.
- A local source path of `./plugins/codex-codeasier`, resolved relative to the marketplace root.
- Installation policy `AVAILABLE`.
- Authentication policy `ON_INSTALL`, the schema default for a plugin with no authentication integration.
- Category `Developer Tools`.

Using a local relative source lets a Git-backed marketplace snapshot install the plugin from the same checked-out repository without a self-referential Git source or pinned commit SHA.

## Plugin Manifest

Move the existing plugin manifest to `plugins/codex-codeasier/.codex-plugin/plugin.json` and preserve its name, version, description, and skills path. Add publication metadata supported by Codex:

- Author: `Codeasier`.
- Homepage and repository: `https://github.com/codeasier/codex-codeasier`.
- License: `MIT`.
- Relevant discovery keywords.
- Interface display name, descriptions, developer, category, capabilities, and up to three starter prompts.

Do not add icons, screenshots, MCP servers, apps, hooks, privacy URLs, or terms URLs because the repository does not provide those resources or integrations.

## Source Migration

Move the canonical `skills/` directory under `plugins/codex-codeasier/`. Do not retain a duplicate root-level copy. This keeps one source of truth and avoids divergence between manually installed and marketplace-installed variants.

The previous manual installation method changes from copying the repository root to copying or linking `plugins/codex-codeasier`.

## Validation

Update `scripts/validate.mjs` to validate the complete marketplace package:

- Parse `.agents/plugins/marketplace.json`.
- Require the expected marketplace name and display name.
- Require exactly one plugin entry.
- Validate the plugin entry name, relative path, policy, and category.
- Resolve the marketplace source path and parse its plugin manifest.
- Require the directory name, marketplace entry name, and plugin manifest name to match.
- Preserve strict validation of plugin version, description, skills path, exact Skill set, and Skill frontmatter.
- Validate the newly added publication and interface metadata.
- Continue rejecting unsupported session-oriented workflows.

Validation remains dependency-free and runs with Node.js 22 or newer:

```bash
node scripts/validate.mjs
```

## Documentation

Make GitHub Marketplace installation the primary README flow:

```bash
codex plugin marketplace add codeasier/codex-codeasier
codex plugin add codex-codeasier@codex-codeasier
```

Document discovery and maintenance commands:

```bash
codex plugin marketplace list
codex plugin list --marketplace codex-codeasier
codex plugin marketplace upgrade codex-codeasier
codex plugin remove codex-codeasier@codex-codeasier
```

Keep a local-development section that registers the repository as a local marketplace and installs from it. Explain that plugin updates require reinstalling or updating the marketplace snapshot and starting a new Codex thread.

## Verification

Before publication:

1. Run repository validation.
2. Register the repository path as a local marketplace in an isolated Codex home or configuration.
3. Confirm the marketplace appears under the expected name.
4. Confirm `codex-codeasier` appears as available.
5. Install it and confirm all ten Skills are present in the installed plugin snapshot.
6. Remove the test plugin and marketplace registration.

After the repository is pushed to GitHub:

1. Add `codeasier/codex-codeasier` as a Git marketplace.
2. Install `codex-codeasier@codex-codeasier`.
3. Start a new Codex thread and invoke one Skill explicitly.

The local test proves manifest and CLI compatibility. The final GitHub test additionally proves repository accessibility and remote snapshot behavior.

## Compatibility And Scope

- The target is a Codex release that supports `codex plugin` and `.agents/plugins/marketplace.json`.
- Existing direct copies of the old repository-root plugin are not automatically migrated.
- No runtime code, network service, authentication integration, or package dependency is introduced.
- No session-oriented workflows are added.
- Publishing, pushing, release tagging, and GitHub repository configuration are outside this implementation unless separately requested.
