# AGENTS.md — plugins/codex-codeasier (the installable plugin)

Parent scope: this directory is the single plugin published by the marketplace repository root — see [../../AGENTS.md](../../AGENTS.md) for the marketplace manifest, validator, and generated-CI boundaries. Everything here ships to users: `codex plugin add codex-codeasier@codex-codeasier` installs exactly this directory's content, and the manual-install fallback documented in the README copies this directory (never the repo root).

## Layout

| Path | Role |
| --- | --- |
| `.codex-plugin/plugin.json` | Plugin manifest: name `codex-codeasier`, version `0.1.1`, `"skills": "./skills/"`, author/interface metadata, capabilities `["Interactive", "Write"]`, and 1–3 `defaultPrompt` strings. Most values are pinned for exact equality by [../../scripts/validate.mjs](../../scripts/validate.mjs). |
| `skills/<name>/SKILL.md` | The plugin's entire behavior surface: ten skill definitions, one directory per skill. |

The skill set is exactly these ten (validator-compared, sorted): `docs-governance`, `issue-resolve`, `issue-review`, `issue-submit`, `pr-followup`, `release-prep`, `spec-run`, `spec-write`, `understand-me`, `worktree-clean`.

## Skill contract (enforced by ../../scripts/validate.mjs)

- YAML frontmatter is required; `name` must equal the directory name and `description` must be non-empty.
- The set of skill directories must exactly equal the validator's `expectedSkills` array — an added, renamed, or removed skill directory without a matching validator and README update fails `node scripts/validate.mjs`.
- Forbidden anywhere in a `SKILL.md` (case-insensitive): `@opencode-ai`, `opencode`, `session-review`, `session_review`, `question tool`. This is the Codex-only platform boundary; do not weaken it.
- Format: each `SKILL.md` is a title, frontmatter, and a single paragraph of behavioral instructions (8 lines total per file today). Keep new skills in that shape.
- Behavioral invariant across skills: they operate on the user's other repositories with evidence-first steps, and several require explicit user confirmation before posting comments (`issue-review`, `issue-submit`), destructive git operations (`release-prep`, `worktree-clean`, `pr-followup`), or pushing (`issue-resolve`). Preserve those confirmation gates when editing.

## Recipe: add a skill

1. Create `skills/<kebab-name>/SKILL.md` with frontmatter (`name` matching the directory, one-line `description`) and a single-paragraph body.
2. Insert the name in sorted position in the `expectedSkills` array in [../../scripts/validate.mjs](../../scripts/validate.mjs).
3. Add a matching row to the skill table in [../../README.md](../../README.md).
4. Run `node scripts/validate.mjs` from the repo root; it must report the new skill count.

## Recipe: bump the version

`version` in `.codex-plugin/plugin.json` is compared for exact equality (currently `0.1.1`) by the root validator, and manifest text such as the description and interface strings is pinned the same way — always change the manifest and the corresponding expectations in `scripts/validate.mjs` in the same commit. After publishing, users refresh via `codex plugin marketplace upgrade codex-codeasier` plus re-install, then start a new Codex thread.
