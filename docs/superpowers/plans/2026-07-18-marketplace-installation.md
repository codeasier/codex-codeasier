# Codex Marketplace Installation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `codeasier/codex-codeasier` installable as a Git-backed Codex marketplace containing the `codex-codeasier` plugin.

**Architecture:** The repository becomes a marketplace root with `.agents/plugins/marketplace.json`; the canonical plugin moves to `plugins/codex-codeasier`. A dependency-free Node validator follows the marketplace source path and validates both packaging layers, while README commands cover remote installation and local development.

**Tech Stack:** JSON manifests, Markdown Skill definitions, Node.js 22 standard library, Codex CLI 0.141 or newer, Git.

---

## File Map

- Create `.agents/plugins/marketplace.json`: Codex marketplace catalog and relative plugin source.
- Move `.codex-plugin/plugin.json` to `plugins/codex-codeasier/.codex-plugin/plugin.json`: canonical plugin metadata.
- Move `skills/` to `plugins/codex-codeasier/skills/`: canonical Skill definitions.
- Modify `scripts/validate.mjs`: validate marketplace metadata, plugin metadata, source resolution, and Skills.
- Modify `README.md`: document GitHub Marketplace installation, updates, removal, invocation, and local development.
- Preserve `.github/workflows/ci.yml`: it already runs the repository validator and needs no command change.

### Task 1: Add Marketplace Packaging

**Files:**
- Create: `.agents/plugins/marketplace.json`
- Move: `.codex-plugin/plugin.json` to `plugins/codex-codeasier/.codex-plugin/plugin.json`
- Move: `skills/` to `plugins/codex-codeasier/skills/`
- Modify: `plugins/codex-codeasier/.codex-plugin/plugin.json`

- [ ] **Step 1: Create the marketplace manifest**

Create `.agents/plugins/marketplace.json` with one local relative source:

```json
{
  "name": "codex-codeasier",
  "interface": {
    "displayName": "Codeasier"
  },
  "plugins": [
    {
      "name": "codex-codeasier",
      "source": {
        "source": "local",
        "path": "./plugins/codex-codeasier"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Developer Tools"
    }
  ]
}
```

- [ ] **Step 2: Move the plugin into the marketplace plugin directory**

Move the existing manifest and all ten Skill directories without keeping duplicate root copies. The resulting canonical paths must be:

```text
plugins/codex-codeasier/.codex-plugin/plugin.json
plugins/codex-codeasier/skills/<skill-name>/SKILL.md
```

- [ ] **Step 3: Add publication metadata to the plugin manifest**

Replace the moved manifest with:

```json
{
  "name": "codex-codeasier",
  "version": "0.1.1",
  "description": "Evidence-driven repository workflows for OpenAI Codex",
  "author": {
    "name": "Codeasier",
    "url": "https://github.com/codeasier"
  },
  "homepage": "https://github.com/codeasier/codex-codeasier#readme",
  "repository": "https://github.com/codeasier/codex-codeasier",
  "license": "MIT",
  "keywords": ["codex", "github", "issues", "pull-requests", "specifications", "worktrees"],
  "skills": "./skills/",
  "interface": {
    "displayName": "Codeasier",
    "shortDescription": "Evidence-driven repository workflows",
    "longDescription": "Review and resolve issues, follow up on pull requests, govern documentation, prepare releases, and execute specification-driven repository work.",
    "developerName": "Codeasier",
    "category": "Developer Tools",
    "capabilities": ["Interactive", "Write"],
    "websiteURL": "https://github.com/codeasier/codex-codeasier",
    "defaultPrompt": [
      "Review a GitHub issue and verify whether it is valid.",
      "Resolve one repository issue in an isolated worktree.",
      "Create an implementation-ready specification package."
    ]
  }
}
```

- [ ] **Step 4: Confirm there is one canonical plugin copy**

Run:

```bash
test ! -e .codex-plugin && test ! -e skills
test -f plugins/codex-codeasier/.codex-plugin/plugin.json
test -f plugins/codex-codeasier/skills/issue-review/SKILL.md
```

Expected: exit code `0` and no output.

### Task 2: Validate The Marketplace And Plugin

**Files:**
- Modify: `scripts/validate.mjs`

- [ ] **Step 1: Point validation at the not-yet-created marketplace to establish failure**

Before Task 1 is complete, change the validator's first read to `.agents/plugins/marketplace.json` and run:

```bash
node scripts/validate.mjs
```

Expected: non-zero exit with `cannot parse marketplace manifest` because the manifest does not exist. If Task 1 is already complete, temporarily set the source path expectation to `./plugins/missing` and confirm the validator reports that mismatch, then restore the intended expectation.

- [ ] **Step 2: Implement marketplace validation and source resolution**

Update `scripts/validate.mjs` to:

```js
const marketplacePath = join(root, ".agents", "plugins", "marketplace.json");
const expectedSource = "./plugins/codex-codeasier";

const marketplace = JSON.parse(await readFile(marketplacePath, "utf8"));
// Require name, displayName, exactly one plugin, source, policy, and category.
const pluginEntry = marketplace.plugins[0];
const pluginRoot = resolve(root, pluginEntry.source.path);
const manifestPath = join(pluginRoot, ".codex-plugin", "plugin.json");
const skillsRoot = join(pluginRoot, "skills");
```

Use `resolve` and `relative` from `node:path` to reject a source that escapes the repository root. Accumulate readable errors rather than throwing after the first invalid field.

- [ ] **Step 3: Validate plugin publication metadata**

Require these exact stable values:

```js
{
  name: "codex-codeasier",
  version: "0.1.1",
  description: "Evidence-driven repository workflows for OpenAI Codex",
  homepage: "https://github.com/codeasier/codex-codeasier#readme",
  repository: "https://github.com/codeasier/codex-codeasier",
  license: "MIT",
  skills: "./skills/",
}
```

Also require `author.name`, six exact keywords, interface display/developer/category values, `Interactive` and `Write` capabilities, the HTTPS website URL, and one to three non-empty default prompts no longer than 128 characters.

- [ ] **Step 4: Reuse strict Skill validation under the resolved plugin root**

Read directories from `skillsRoot`, preserve the exact ten-Skill comparison, frontmatter checks, and forbidden platform/session text checks. Update error paths to start with `plugins/codex-codeasier/skills/`.

- [ ] **Step 5: Run validation**

Run:

```bash
node scripts/validate.mjs
```

Expected:

```text
Validation passed: marketplace codex-codeasier, plugin codex-codeasier, 10 skills
```

### Task 3: Document Installation And Maintenance

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace direct-copy installation with the GitHub Marketplace flow**

Document:

```bash
codex plugin marketplace add codeasier/codex-codeasier
codex plugin add codex-codeasier@codex-codeasier
```

Tell users to start a new Codex thread after installation so Skills are rediscovered.

- [ ] **Step 2: Add inspection, update, and uninstall commands**

Document:

```bash
codex plugin marketplace list
codex plugin list --marketplace codex-codeasier
codex plugin marketplace upgrade codex-codeasier
codex plugin add codex-codeasier@codex-codeasier
codex plugin remove codex-codeasier@codex-codeasier
codex plugin marketplace remove codex-codeasier
```

Explain that reinstalling after an upgrade refreshes the installed plugin snapshot.

- [ ] **Step 3: Add local development installation**

Document the repository-root command:

```bash
codex plugin marketplace add /absolute/path/to/codex-codeasier
codex plugin add codex-codeasier@codex-codeasier
```

Also document direct plugin copying only as a fallback from `plugins/codex-codeasier`, not from the repository root.

- [ ] **Step 4: Update Skill invocation syntax**

Use explicit Codex Skill markers, for example:

```text
$issue-review Review issue 42.
$issue-resolve Resolve issue 42.
$spec-write Specify a batch export feature.
```

- [ ] **Step 5: Check documentation for stale paths and commands**

Run:

```bash
rg '~/.codex/plugins|cp -R /absolute/path/to/codex-codeasier|owner/repository' README.md
```

Expected: no stale root-copy or placeholder repository instructions. A fallback copy command is acceptable only when its source ends in `plugins/codex-codeasier`.

### Task 4: Verify Packaging And Local CLI Installation

**Files:**
- Verify: `.agents/plugins/marketplace.json`
- Verify: `plugins/codex-codeasier/.codex-plugin/plugin.json`
- Verify: `scripts/validate.mjs`
- Verify: `.github/workflows/ci.yml`

- [ ] **Step 1: Run static repository validation**

Run:

```bash
node scripts/validate.mjs
```

Expected: `Validation passed: marketplace codex-codeasier, plugin codex-codeasier, 10 skills`.

- [ ] **Step 2: Confirm CI uses the same validation entry point**

Run:

```bash
rg 'node scripts/validate.mjs' .github/workflows/ci.yml
```

Expected: one matching validation command.

- [ ] **Step 3: Register the repository as a local marketplace**

Use an isolated `CODEX_HOME` under the approved temporary directory so the user's real Codex configuration is untouched:

```bash
CODEX_HOME=/var/folders/44/mmqfw4_j1mq02hggc798tfy80000gn/T/opencode/codex-marketplace-test \
  codex plugin marketplace add /absolute/path/to/codex-codeasier --json
```

Expected: successful JSON naming marketplace `codex-codeasier`.

- [ ] **Step 4: Confirm the plugin is available and install it**

Run:

```bash
CODEX_HOME=/var/folders/44/mmqfw4_j1mq02hggc798tfy80000gn/T/opencode/codex-marketplace-test \
  codex plugin list --marketplace codex-codeasier --available --json
CODEX_HOME=/var/folders/44/mmqfw4_j1mq02hggc798tfy80000gn/T/opencode/codex-marketplace-test \
  codex plugin add codex-codeasier@codex-codeasier --json
```

Expected: the list contains `codex-codeasier`; installation succeeds.

- [ ] **Step 5: Inspect the isolated installed snapshot**

Locate the installed plugin path from JSON output or the isolated Codex home and verify:

```bash
test -f <installed-plugin-root>/.codex-plugin/plugin.json
test "$(find <installed-plugin-root>/skills -name SKILL.md | wc -l | tr -d ' ')" = 10
```

Expected: exit code `0`.

- [ ] **Step 6: Remove the isolated installation**

Run:

```bash
CODEX_HOME=/var/folders/44/mmqfw4_j1mq02hggc798tfy80000gn/T/opencode/codex-marketplace-test \
  codex plugin remove codex-codeasier@codex-codeasier
CODEX_HOME=/var/folders/44/mmqfw4_j1mq02hggc798tfy80000gn/T/opencode/codex-marketplace-test \
  codex plugin marketplace remove codex-codeasier
```

Expected: both commands succeed. Remove the temporary test directory after confirming no user configuration points into it.

- [ ] **Step 7: Record the remote verification boundary**

Do not claim remote installation passed until the repository exists at GitHub. After publication, run:

```bash
codex plugin marketplace add codeasier/codex-codeasier
codex plugin add codex-codeasier@codex-codeasier
```

Expected: both commands succeed, then a new Codex thread can invoke `$issue-review`.

### Task 5: Final Review

**Files:**
- Review all changed files.

- [ ] **Step 1: Inspect status and diff**

Run:

```bash
git status --short
git diff --check
git diff -- README.md scripts/validate.mjs .agents/plugins/marketplace.json plugins/codex-codeasier/.codex-plugin/plugin.json
```

Expected: only intended Marketplace migration changes and documentation artifacts; `git diff --check` produces no output.

- [ ] **Step 2: Run final validation**

Run:

```bash
node scripts/validate.mjs
```

Expected: all checks pass.

- [ ] **Step 3: Commit only if explicitly requested**

If the user requests a commit, inspect `git status`, `git diff`, and recent history, then stage only intended files and create a new commit such as:

```bash
git add .agents README.md scripts plugins docs .github .gitignore LICENSE
git commit -m "feat: add Codex marketplace installation"
```

Do not commit or push without explicit user authorization.
