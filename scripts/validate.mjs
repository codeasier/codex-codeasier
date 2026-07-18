import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const marketplaceName = "codex-codeasier";
const pluginName = "codex-codeasier";
const expectedSource = "./plugins/codex-codeasier";
const expectedSkills = [
  "docs-governance",
  "issue-resolve",
  "issue-review",
  "issue-submit",
  "pr-followup",
  "release-prep",
  "spec-run",
  "spec-write",
  "understand-me",
  "worktree-clean",
];
const expectedKeywords = [
  "codex",
  "github",
  "issues",
  "pull-requests",
  "specifications",
  "worktrees",
];
const forbidden = [
  "@opencode-ai",
  "opencode",
  "session-review",
  "session_review",
  "question tool",
];
const errors = [];

function fail(message) {
  errors.push(message);
}

function expectFields(subject, actual, expected) {
  for (const [field, value] of Object.entries(expected)) {
    if (actual?.[field] !== value) {
      fail(`${subject} ${field} must equal ${JSON.stringify(value)}`);
    }
  }
}

let pluginRoot = resolve(root, expectedSource);
let marketplace;
try {
  marketplace = JSON.parse(
    await readFile(
      join(root, ".agents", "plugins", "marketplace.json"),
      "utf8",
    ),
  );
} catch (error) {
  fail(`cannot parse marketplace manifest: ${error.message}`);
}

if (marketplace) {
  expectFields("marketplace", marketplace, { name: marketplaceName });
  expectFields("marketplace interface", marketplace.interface, {
    displayName: "Codeasier",
  });

  if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length !== 1) {
    fail("marketplace plugins must contain exactly one entry");
  } else {
    const pluginEntry = marketplace.plugins[0];
    expectFields("marketplace plugin", pluginEntry, {
      name: pluginName,
      category: "Developer Tools",
    });
    expectFields("marketplace plugin source", pluginEntry.source, {
      source: "local",
      path: expectedSource,
    });
    expectFields("marketplace plugin policy", pluginEntry.policy, {
      installation: "AVAILABLE",
      authentication: "ON_INSTALL",
    });

    if (pluginEntry.source?.path) {
      pluginRoot = resolve(root, pluginEntry.source.path);
      const relativePluginRoot = relative(root, pluginRoot);
      if (
        relativePluginRoot === ".." ||
        relativePluginRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
        resolve(pluginRoot) === resolve(root)
      ) {
        fail("marketplace plugin source must stay within the repository root");
        pluginRoot = resolve(root, expectedSource);
      }
    }
  }
}

let manifest;
try {
  manifest = JSON.parse(
    await readFile(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"),
  );
} catch (error) {
  fail(`cannot parse plugin manifest: ${error.message}`);
}

if (manifest) {
  expectFields("plugin manifest", manifest, {
    name: pluginName,
    version: "0.1.1",
    description: "Evidence-driven repository workflows for OpenAI Codex",
    homepage: "https://github.com/codeasier/codex-codeasier#readme",
    repository: "https://github.com/codeasier/codex-codeasier",
    license: "MIT",
    skills: "./skills/",
  });
  expectFields("plugin author", manifest.author, {
    name: "Codeasier",
    url: "https://github.com/codeasier",
  });
  if (JSON.stringify(manifest.keywords) !== JSON.stringify(expectedKeywords)) {
    fail(`plugin keywords must be exactly: ${expectedKeywords.join(", ")}`);
  }

  const pluginInterface = manifest.interface;
  expectFields("plugin interface", pluginInterface, {
    displayName: "Codeasier",
    shortDescription: "Evidence-driven repository workflows",
    longDescription:
      "Review and resolve issues, follow up on pull requests, govern documentation, prepare releases, and execute specification-driven repository work.",
    developerName: "Codeasier",
    category: "Developer Tools",
    websiteURL: "https://github.com/codeasier/codex-codeasier",
  });
  if (
    JSON.stringify(pluginInterface?.capabilities) !==
    JSON.stringify(["Interactive", "Write"])
  ) {
    fail("plugin interface capabilities must be exactly: Interactive, Write");
  }
  if (
    !Array.isArray(pluginInterface?.defaultPrompt) ||
    pluginInterface.defaultPrompt.length < 1 ||
    pluginInterface.defaultPrompt.length > 3 ||
    pluginInterface.defaultPrompt.some(
      (prompt) => typeof prompt !== "string" || !prompt.trim() || prompt.length > 128,
    )
  ) {
    fail("plugin interface defaultPrompt must contain 1-3 non-empty strings of at most 128 characters");
  }
}

const skillsRoot = join(pluginRoot, "skills");
let actualSkills = [];
try {
  actualSkills = (await readdir(skillsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
} catch (error) {
  fail(`cannot read plugin skills directory: ${error.message}`);
}

if (JSON.stringify(actualSkills) !== JSON.stringify(expectedSkills)) {
  fail(
    `skill directories must be exactly: ${expectedSkills.join(", ")}; found: ${actualSkills.join(", ")}`,
  );
}

for (const skill of expectedSkills) {
  const skillPath = join(skillsRoot, skill, "SKILL.md");
  const displayPath = `plugins/${pluginName}/skills/${skill}/SKILL.md`;
  let contents;
  try {
    contents = await readFile(skillPath, "utf8");
  } catch (error) {
    fail(`cannot read ${displayPath}: ${error.message}`);
    continue;
  }

  const frontmatter = contents.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!frontmatter) {
    fail(`${displayPath} has no opening YAML frontmatter`);
    continue;
  }
  const fields = Object.fromEntries(
    frontmatter[1]
      .split("\n")
      .map((line) => line.match(/^([a-z_]+):\s*(.+)$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2].trim()]),
  );
  if (fields.name !== skill) fail(`${displayPath} name must equal ${skill}`);
  if (!fields.description) fail(`${displayPath} requires a non-empty description`);

  const lower = contents.toLowerCase();
  for (const value of forbidden) {
    if (lower.includes(value)) {
      fail(`${displayPath} contains forbidden text: ${value}`);
    }
  }
}

if (errors.length) {
  for (const error of errors) console.error(`error: ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Validation passed: marketplace ${marketplaceName}, plugin ${pluginName}, ${expectedSkills.length} skills`,
  );
}
