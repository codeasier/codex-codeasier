import { lstat, readFile, readdir, realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const marketplaceName = "codex-codeasier";
const pluginSchema = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
const mcpSchema = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json";
const expectedSkills = [
  "docs-governance",
  "handoff",
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

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWithin(base, target) {
  const path = relative(base, target);
  return path !== "" && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

export async function validateRepository(rootDirectory = repositoryRoot) {
  const root = resolve(rootDirectory);
  const errors = [];
  let pluginCount = 0;
  const fail = (message) => errors.push(message);

  function expectFields(subject, actual, expected) {
    for (const [field, value] of Object.entries(expected)) {
      if (actual?.[field] !== value) {
        fail(`${subject} ${field} must equal ${JSON.stringify(value)}`);
      }
    }
  }

  async function readObject(path, subject) {
    try {
      const value = JSON.parse(await readFile(path, "utf8"));
      if (!isObject(value)) {
        fail(`${subject} must be an object`);
        return undefined;
      }
      return value;
    } catch (error) {
      fail(`cannot parse ${subject}: ${error.message}`);
      return undefined;
    }
  }

  async function exists(path) {
    try {
      await lstat(path);
      return true;
    } catch (error) {
      if (error.code !== "ENOENT") fail(`cannot inspect ${path}: ${error.message}`);
      return false;
    }
  }

  // Check both lexical paths and symlink targets before reading plugin content.
  async function containedPath(base, path, subject, kind) {
    if (
      typeof path !== "string" ||
      !path.startsWith("./") ||
      path.includes("\\") ||
      path.includes("\0") ||
      path.slice(2).split("/").filter(Boolean).some((part) => part === "." || part === "..")
    ) {
      fail(`${subject} must be a relative ./ path without traversal`);
      return undefined;
    }
    const target = resolve(base, path);
    if (!isWithin(base, target)) {
      fail(`${subject} must stay within its parent directory`);
      return undefined;
    }
    try {
      const [realBase, realTarget, info] = await Promise.all([
        realpath(base), realpath(target), stat(target),
      ]);
      if (!isWithin(realBase, realTarget)) {
        fail(`${subject} must not resolve outside its parent directory`);
        return undefined;
      }
      if (kind === "directory" ? !info.isDirectory() : !info.isFile()) {
        fail(`${subject} must be a ${kind}`);
        return undefined;
      }
      return realTarget;
    } catch (error) {
      fail(`cannot read ${subject}: ${error.message}`);
      return undefined;
    }
  }

  async function validateSkills(pluginRoot, pluginName, skillNames, forbiddenText = []) {
    const skillsRoot = await containedPath(pluginRoot, "./skills", `${pluginName} skills`, "directory");
    if (!skillsRoot) return;
    const actualSkills = (await readdir(skillsRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .map((entry) => entry.name)
      .sort();
    if (JSON.stringify(actualSkills) !== JSON.stringify(skillNames)) {
      fail(`${pluginName} skill directories must be exactly: ${skillNames.join(", ")}; found: ${actualSkills.join(", ")}`);
    }
    for (const skill of skillNames) {
      const displayPath = `plugins/${pluginName}/skills/${skill}/SKILL.md`;
      const skillPath = await containedPath(pluginRoot, `./skills/${skill}/SKILL.md`, displayPath, "file");
      if (!skillPath) continue;
      const contents = await readFile(skillPath, "utf8");
      const frontmatter = contents.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
      if (!frontmatter) {
        fail(`${displayPath} has no opening YAML frontmatter`);
        continue;
      }
      const fields = Object.fromEntries(
        frontmatter[1].split("\n")
          .map((line) => line.match(/^([a-z_]+):\s*(.+)$/))
          .filter(Boolean)
          .map((match) => [match[1], match[2].trim()]),
      );
      if (fields.name !== skill) fail(`${displayPath} name must equal ${skill}`);
      if (!fields.description || ["''", '""'].includes(fields.description)) {
        fail(`${displayPath} requires a non-empty description`);
      }
      for (const value of forbiddenText) {
        if (contents.toLowerCase().includes(value)) fail(`${displayPath} contains forbidden text: ${value}`);
      }
    }
  }

  function validatePrompts(subject, prompts) {
    if (
      !Array.isArray(prompts) || prompts.length < 1 || prompts.length > 3 ||
      prompts.some((prompt) => typeof prompt !== "string" || !prompt.trim() || prompt.length > 128)
    ) {
      fail(`${subject} defaultPrompt must contain 1-3 non-empty strings of at most 128 characters`);
    }
  }

  // Preserve the pinned workflow source and all original generated-skill gates.
  const workflowSourceLock = await readObject(join(root, "workflow-source.lock.json"), "workflow source lock");
  if (workflowSourceLock) {
    expectFields("workflow source lock", workflowSourceLock, {
      repository: "codeasier/open-codeasier",
      generator: "scripts/generate-workflows.mjs",
    });
    if (!/^[0-9a-f]{40}$/.test(workflowSourceLock.commit ?? "")) {
      fail("workflow source lock commit must be a full lowercase commit SHA");
    }
    const expectedLockFields = ["commit", "generator", "repository"];
    if (JSON.stringify(Object.keys(workflowSourceLock).sort()) !== JSON.stringify(expectedLockFields)) {
      fail(`workflow source lock fields must be exactly: ${expectedLockFields.join(", ")}`);
    }
  }

  const marketplace = await readObject(join(root, ".agents", "plugins", "marketplace.json"), "marketplace manifest");
  const entries = new Map();
  const sources = new Set();
  if (marketplace) {
    expectFields("marketplace", marketplace, { name: marketplaceName });
    expectFields("marketplace interface", marketplace.interface, { displayName: "Codeasier" });
    if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) {
      fail("marketplace plugins must be a non-empty array");
    } else {
      pluginCount = marketplace.plugins.length;
      for (const [index, entry] of marketplace.plugins.entries()) {
        const subject = `marketplace plugin ${index + 1}`;
        if (!isObject(entry) || typeof entry.name !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name)) {
          fail(`${subject} must be an object with a lowercase kebab-case name`);
          continue;
        }
        if (entries.has(entry.name)) {
          fail(`duplicate marketplace plugin name: ${entry.name}`);
          continue;
        }
        entries.set(entry.name, entry);
        if (!isObject(entry.source) || entry.source.source !== "local") {
          fail(`${subject} source must be a local source object`);
          continue;
        }
        const pluginRoot = await containedPath(root, entry.source.path, `${subject} source`, "directory");
        if (!pluginRoot) continue;
        if (sources.has(pluginRoot)) {
          fail(`duplicate marketplace plugin source: ${entry.source.path}`);
          continue;
        }
        sources.add(pluginRoot);

        const candidates = ["./.codex-plugin/plugin.json", "./plugin.json"];
        const manifests = [];
        for (const candidate of candidates) {
          if (await exists(resolve(pluginRoot, candidate))) manifests.push(candidate);
        }
        if (manifests.length !== 1) {
          fail(`${entry.name} must have exactly one legacy or portable plugin manifest`);
          continue;
        }
        const manifestPath = await containedPath(pluginRoot, manifests[0], `${entry.name} manifest`, "file");
        if (!manifestPath) continue;
        const manifest = await readObject(manifestPath, `${entry.name} plugin manifest`);
        if (!manifest) continue;
        expectFields(`${entry.name} plugin manifest`, manifest, { name: entry.name });
        if (typeof manifest.version !== "string" || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(manifest.version)) {
          fail(`${entry.name} plugin manifest version must be a semantic version`);
        }
        if (typeof manifest.description !== "string" || !manifest.description.trim()) {
          fail(`${entry.name} plugin manifest requires a non-empty description`);
        }
        if (manifests[0] === "./plugin.json") {
          expectFields(`${entry.name} plugin manifest`, manifest, { $schema: pluginSchema });
        }

        if (entry.name === "codex-codeasier") {
          if (manifests[0] !== "./.codex-plugin/plugin.json") fail("codex-codeasier must retain its legacy manifest path");
          expectFields("plugin manifest", manifest, {
            name: "codex-codeasier",
            version: "0.2.0",
            description: "Evidence-driven repository workflows for OpenAI Codex",
            homepage: "https://github.com/codeasier/codex-codeasier#readme",
            repository: "https://github.com/codeasier/codex-codeasier",
            license: "MIT",
            skills: "./skills/",
          });
          expectFields("plugin author", manifest.author, { name: "Codeasier", url: "https://github.com/codeasier" });
          if (JSON.stringify(manifest.keywords) !== JSON.stringify(expectedKeywords)) {
            fail(`plugin keywords must be exactly: ${expectedKeywords.join(", ")}`);
          }
          const pluginInterface = manifest.interface;
          expectFields("plugin interface", pluginInterface, {
            displayName: "Codeasier",
            shortDescription: "Evidence-driven repository workflows",
            longDescription: "Review and resolve issues, follow up on pull requests, govern documentation, prepare releases, execute specification-driven repository work, and transfer active tasks between sessions.",
            developerName: "Codeasier",
            category: "Developer Tools",
            websiteURL: "https://github.com/codeasier/codex-codeasier",
          });
          if (JSON.stringify(pluginInterface?.capabilities) !== JSON.stringify(["Interactive", "Write"])) {
            fail("plugin interface capabilities must be exactly: Interactive, Write");
          }
          validatePrompts("plugin interface", pluginInterface?.defaultPrompt);
          await validateSkills(pluginRoot, entry.name, expectedSkills, forbidden);
        } else if (entry.name === "gitcode") {
          if (manifests[0] !== "./plugin.json") fail("gitcode must use its portable root plugin manifest");
          expectFields("gitcode plugin manifest", manifest, { $schema: pluginSchema, version: "0.1.0" });
          const openai = manifest.extensions?.["com.openai"];
          expectFields("gitcode OpenAI extension", openai, { requires_local_executor: true });
          expectFields("gitcode interface", openai?.interface, { displayName: "GitCode", category: "Developer Tools" });
          if (JSON.stringify(openai?.interface?.capabilities) !== JSON.stringify(["Read", "Write"])) {
            fail("gitcode interface capabilities must be exactly: Read, Write");
          }
          const mcpPath = await containedPath(pluginRoot, "./mcp.json", "gitcode MCP manifest", "file");
          const mcp = mcpPath ? await readObject(mcpPath, "gitcode MCP manifest") : undefined;
          if (mcp) {
            expectFields("gitcode MCP manifest", mcp, { $schema: mcpSchema });
            if (JSON.stringify(Object.keys(mcp).sort()) !== JSON.stringify(["$schema", "mcpServers"])) {
              fail("gitcode MCP manifest may only declare $schema and mcpServers");
            }
            if (!isObject(mcp.mcpServers) || JSON.stringify(Object.keys(mcp.mcpServers)) !== JSON.stringify(["gitcode"])) {
              fail("gitcode MCP manifest must contain exactly the gitcode server");
            } else {
              const server = mcp.mcpServers.gitcode;
              expectFields("gitcode MCP server", server, { type: "stdio", command: "gitcode-mcp" });
              if (!isObject(server) || JSON.stringify(Object.keys(server).sort()) !== JSON.stringify(["command", "type"])) {
                fail("gitcode MCP server may only declare type and command; configure credentials in the executor environment");
              }
            }
          }
          await validateSkills(pluginRoot, entry.name, ["gitcode-workflow"]);
        }
      }
    }
  }

  for (const name of ["codex-codeasier", "gitcode"]) {
    const entry = entries.get(name);
    if (!entry) {
      fail(`marketplace must include plugin ${name}`);
      continue;
    }
    expectFields(`marketplace ${name} plugin`, entry, { name, category: "Developer Tools" });
    expectFields(`marketplace ${name} source`, entry.source, { source: "local", path: `./plugins/${name}` });
    expectFields(`marketplace ${name} policy`, entry.policy, { installation: "AVAILABLE", authentication: "ON_INSTALL" });
  }

  return { errors, pluginCount, generatedSkillCount: expectedSkills.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await validateRepository();
  if (result.errors.length) {
    for (const error of result.errors) console.error(`error: ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`Validation passed: marketplace ${marketplaceName}, ${result.pluginCount} plugins, ${result.generatedSkillCount} generated skills`);
  }
}
