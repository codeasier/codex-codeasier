# AGENTS.md — codex-codeasier

Single-plugin Codex marketplace repository. There is no runtime code, no build step, and no dependency: the entire product is (1) a Codex marketplace manifest, (2) one installable plugin made of a JSON manifest plus ten Markdown skill definitions, and (3) one dependency-free Node validator that pins the exact expected content of both packaging layers. Adapted from `codeasier/claude-codeasier` via `codeasier/open-codeasier`.

## Component map

| Path | Role |
| --- | --- |
| `.agents/plugins/marketplace.json` | Marketplace entry point. Codex reads this when the repo is added with `codex plugin marketplace add` (GitHub `owner/repo` or a local absolute path). Declares exactly one plugin with a local relative source `./plugins/codex-codeasier`, policy `installation: AVAILABLE` / `authentication: ON_INSTALL`. |
| `plugins/codex-codeasier/` | The installable plugin — the only unit users install or copy. Has its own manifest and skill protocol; see [plugins/codex-codeasier/AGENTS.md](plugins/codex-codeasier/AGENTS.md). |
| `scripts/validate.mjs` | The single repository check. Validates both manifests, resolves the marketplace source path, verifies the exact skill set, checks `SKILL.md` frontmatter, and enforces the platform boundary by pinning expected values (names, version, keywords, paths) for exact equality. |
| `.github/workflows/ci.yml` | Generated artifact — do not hand-edit. Verified in CI against a pinned upstream source (see "Generated CI workflow" below). |
| `workflow-source.lock.json` | Pins the upstream `codeasier/open-codeasier` commit (full lowercase 40-char SHA) and generator (`scripts/generate-workflows.mjs`) that produced `.github/workflows/ci.yml`. |
| `docs/superpowers/` | Historical design spec and implementation plan for the marketplace migration. Reference only; not part of the installed plugin. |

## Data flow

Installation/discovery chain (what Codex follows at runtime):

1. `codex plugin marketplace add codeasier/codex-codeasier` (or a local absolute path) snapshots this repository root.
2. Codex reads `.agents/plugins/marketplace.json` and resolves the plugin entry's local source `./plugins/codex-codeasier` relative to the repo root.
3. Codex reads `plugins/codex-codeasier/.codex-plugin/plugin.json`, whose `"skills": "./skills/"` points at the skill definitions.
4. `codex plugin add codex-codeasier@codex-codeasier` installs the plugin; its skills are discovered only after starting a new Codex thread.

`scripts/validate.mjs` mirrors this exact resolution chain statically: marketplace manifest → resolve the source path (rejecting any path that escapes the repository root) → plugin manifest → `skills/` directory listing → per-skill `SKILL.md` frontmatter and forbidden-text scan. Error messages use paths starting with `plugins/codex-codeasier/skills/`.

## Build / run / test boundaries

- No build, no runtime dependencies, no package-manager manifest: Node.js 22+ standard library only (`node:fs/promises`, `node:path`, `node:url`).
- The only repository check, run from the repo root:

  ```bash
  node scripts/validate.mjs
  ```

  Expected output on success: `Validation passed: marketplace codex-codeasier, plugin codex-codeasier, 10 skills`. The script accumulates all errors before exiting non-zero — there are no filters or per-file modes, so any change must keep the whole validation green.
- CI (`.github/workflows/ci.yml`, single `validate` job on Node 22) runs `node scripts/validate.mjs` twice, around one extra step: it checks out the pinned `codeasier/open-codeasier` commit from `workflow-source.lock.json` and runs that repository's `scripts/check-workflows.mjs --platform codex --source .workflow-source/open-codeasier --target .` to prove `ci.yml` matches generated output.

## What must change together

| Change | Files that must move in lockstep |
| --- | --- |
| Add / rename / remove a skill | `plugins/codex-codeasier/skills/<name>/SKILL.md`, the `expectedSkills` array in `scripts/validate.mjs`, and the skill table in `README.md`. The validator compares the sorted set of skill directories against `expectedSkills` for exact equality — no extra directories, no missing ones. |
| Bump the plugin version or edit manifest text | `plugins/codex-codeasier/.codex-plugin/plugin.json` and the pinned expectations in `scripts/validate.mjs` (version `0.1.1`, description, six keywords, author, interface strings, capabilities `["Interactive", "Write"]`, and 1–3 `defaultPrompt` entries of at most 128 characters are all enforced). |
| Edit the marketplace manifest | `.agents/plugins/marketplace.json` and the pinned expectations in `scripts/validate.mjs` (marketplace name, display name `Codeasier`, exactly one plugin entry, source `local` + `./plugins/codex-codeasier`, policy, category `Developer Tools`). |
| Change CI behavior | Do not edit `.github/workflows/ci.yml` directly. Regenerate from the upstream `codeasier/open-codeasier` generator and update `workflow-source.lock.json`, whose fields must be exactly `commit`, `generator`, `repository`. |

## Invariants

- Platform boundary: this is a Codex-only plugin. The validator fails any `SKILL.md` containing (case-insensitive) `@opencode-ai`, `opencode`, `session-review`, `session_review`, or `question tool`. Session-oriented workflows are intentionally excluded (README, "Unsupported Workflows").
- The manual-install fallback copies `plugins/codex-codeasier` only, never the repository root; the repo root is a marketplace, not a plugin.
- Local development loop: edit the plugin → `node scripts/validate.mjs` → re-register/reinstall (`codex plugin marketplace add /absolute/path/to/codex-codeasier && codex plugin add codex-codeasier@codex-codeasier`) → start a new Codex thread.
- `AGENTS.md` files at the repo root or plugin root are not read by the validator and do not affect installation; only `skills/*/SKILL.md` are scanned.

## Navigation

| Document | Scope |
| --- | --- |
| [plugins/codex-codeasier/AGENTS.md](plugins/codex-codeasier/AGENTS.md) | The installable plugin: manifest rules, the skill contract, recipes for adding a skill and bumping the version. |
