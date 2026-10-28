import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateRepository } from "./validate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const marketplacePath = ".agents/plugins/marketplace.json";
const legacyPath = "plugins/codex-codeasier/.codex-plugin/plugin.json";
const gitcodePath = "plugins/gitcode/plugin.json";
const mcpPath = "plugins/gitcode/mcp.json";
const pluginSchema = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function editJson(directory, path, edit) {
  const target = join(directory, path);
  const value = JSON.parse(await readFile(target, "utf8"));
  await writeJson(target, edit(value) ?? value);
}

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "codeasier-validator-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await cp(join(root, "plugins/codex-codeasier"), join(directory, "plugins/codex-codeasier"), { recursive: true });
  await cp(join(root, "workflow-source.lock.json"), join(directory, "workflow-source.lock.json"));
  await writeJson(join(directory, marketplacePath), {
    name: "codex-codeasier",
    interface: { displayName: "Codeasier" },
    plugins: ["codex-codeasier", "gitcode"].map((name) => ({
      name,
      source: { source: "local", path: `./plugins/${name}` },
      policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
      category: "Developer Tools",
    })),
  });
  await writeJson(join(directory, gitcodePath), {
    $schema: pluginSchema,
    name: "gitcode",
    version: "0.1.0",
    description: "GitCode repository workflows",
    extensions: {
      "com.openai": {
        requires_local_executor: true,
        interface: { displayName: "GitCode", category: "Developer Tools", capabilities: ["Read", "Write"] },
      },
    },
  });
  await writeJson(join(directory, mcpPath), {
    $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
    mcpServers: { gitcode: { type: "stdio", command: "gitcode-mcp" } },
  });
  const skillPath = join(directory, "plugins/gitcode/skills/gitcode-workflow/SKILL.md");
  await mkdir(dirname(skillPath), { recursive: true });
  await writeFile(skillPath, "---\nname: gitcode-workflow\ndescription: Work with GitCode repositories.\n---\n\nUse GitCode tools.\n");
  return directory;
}

async function expectFailure(directory, pattern) {
  const { errors } = await validateRepository(directory);
  assert.ok(errors.some((message) => pattern.test(message)), `Expected ${pattern}; received ${JSON.stringify(errors)}`);
}

test("accepts the legacy workflow plugin alongside a portable GitCode plugin", async (t) => {
  const directory = await fixture(t);
  assert.deepEqual(await validateRepository(directory), { errors: [], pluginCount: 2, generatedSkillCount: 11 });
});

test("supports additional plugins without relaxing existing plugin gates", async (t) => {
  const directory = await fixture(t);
  await writeJson(join(directory, "plugins/notes/plugin.json"), {
    $schema: pluginSchema,
    name: "notes",
    version: "1.0.0",
    description: "A future plugin",
  });
  await editJson(directory, marketplacePath, (value) => {
    value.plugins.push({ name: "notes", source: { source: "local", path: "./plugins/notes" } });
  });
  assert.deepEqual((await validateRepository(directory)).errors, []);
});

test("rejects duplicate plugin names and aliased source directories", async (t) => {
  await t.test("names", async (t) => {
    const directory = await fixture(t);
    await editJson(directory, marketplacePath, (value) => { value.plugins.push(value.plugins[1]); });
    await expectFailure(directory, /duplicate marketplace plugin name/);
  });
  await t.test("symlink aliases", async (t) => {
    const directory = await fixture(t);
    await symlink(join(directory, "plugins/gitcode"), join(directory, "plugins/alias"), "dir");
    await editJson(directory, marketplacePath, (value) => {
      value.plugins.push({ name: "alias", source: { source: "local", path: "./plugins/alias" } });
    });
    await expectFailure(directory, /duplicate marketplace plugin source/);
  });
});

test("rejects source traversal, absolute paths, and escaping symlinks", async (t) => {
  for (const path of ["../outside", "./plugins/../../outside", "/tmp/outside", ".\\plugins\\gitcode", "./"]) {
    await t.test(path, async (t) => {
      const directory = await fixture(t);
      await editJson(directory, marketplacePath, (value) => { value.plugins[1].source.path = path; });
      await expectFailure(directory, /relative \.\/ path|within its parent directory/);
    });
  }
  await t.test("source symlink", async (t) => {
    const directory = await fixture(t);
    const outside = await mkdtemp(join(tmpdir(), "codeasier-outside-"));
    t.after(() => rm(outside, { recursive: true, force: true }));
    await rm(join(directory, "plugins/gitcode"), { recursive: true });
    await symlink(outside, join(directory, "plugins/gitcode"), "dir");
    await expectFailure(directory, /source must not resolve outside/);
  });
  for (const path of [gitcodePath, "plugins/gitcode/skills/gitcode-workflow/SKILL.md", mcpPath]) {
    await t.test(`file symlink: ${path}`, async (t) => {
      const directory = await fixture(t);
      const target = join(directory, path);
      const outside = join(directory, "outside-plugin-file");
      await cp(target, outside);
      await rm(target);
      await symlink(outside, target);
      await expectFailure(directory, /must not resolve outside/);
    });
  }
});

test("rejects invalid manifest types, schemas, and ambiguous manifest locations", async (t) => {
  for (const path of [marketplacePath, legacyPath, gitcodePath, mcpPath, "workflow-source.lock.json"]) {
    await t.test(`non-object: ${path}`, async (t) => {
      const directory = await fixture(t);
      await writeJson(join(directory, path), []);
      await expectFailure(directory, /must be an object/);
    });
  }
  await t.test("portable schema", async (t) => {
    const directory = await fixture(t);
    await editJson(directory, gitcodePath, (value) => { value.$schema = "https://example.com/plugin.json"; });
    await expectFailure(directory, /gitcode plugin manifest \$schema/);
  });
  await t.test("two manifests", async (t) => {
    const directory = await fixture(t);
    const value = JSON.parse(await readFile(join(directory, gitcodePath), "utf8"));
    await writeJson(join(directory, "plugins/gitcode/.codex-plugin/plugin.json"), value);
    await expectFailure(directory, /exactly one legacy or portable/);
  });
});

test("keeps GitCode local-only and credentials outside the published plugin", async (t) => {
  await t.test("local executor declaration", async (t) => {
    const directory = await fixture(t);
    await editJson(directory, gitcodePath, (value) => { value.extensions["com.openai"].requires_local_executor = false; });
    await expectFailure(directory, /requires_local_executor must equal true/);
  });
  for (const [field, value] of [["env", { GITCODE_TOKEN: "dummy-token" }], ["url", "https://example.com/mcp"]]) {
    await t.test(field, async (t) => {
      const directory = await fixture(t);
      await editJson(directory, mcpPath, (manifest) => { manifest.mcpServers.gitcode[field] = value; });
      await expectFailure(directory, /may only declare type and command/);
    });
  }
  await t.test("runtime command", async (t) => {
    const directory = await fixture(t);
    await editJson(directory, mcpPath, (value) => { value.mcpServers.gitcode.command = "curl"; });
    await expectFailure(directory, /command must equal "gitcode-mcp"/);
  });
  await t.test("unexpected top-level credential", async (t) => {
    const directory = await fixture(t);
    await editJson(directory, mcpPath, (value) => { value.token = "dummy-token"; });
    await expectFailure(directory, /manifest may only declare \$schema and mcpServers/);
  });
});

test("retains legacy manifest, marketplace policy, lock, and eleven-skill checks", async (t) => {
  await t.test("legacy exact version", async (t) => {
    const directory = await fixture(t);
    await editJson(directory, legacyPath, (value) => { value.version = "0.3.0"; });
    await expectFailure(directory, /plugin manifest version must equal "0.2.0"/);
  });
  await t.test("legacy policy", async (t) => {
    const directory = await fixture(t);
    await editJson(directory, marketplacePath, (value) => { value.plugins[0].policy.authentication = "NONE"; });
    await expectFailure(directory, /codex-codeasier policy authentication must equal "ON_INSTALL"/);
  });
  await t.test("pinned full commit", async (t) => {
    const directory = await fixture(t);
    await editJson(directory, "workflow-source.lock.json", (value) => { value.commit = "main"; });
    await expectFailure(directory, /full lowercase commit SHA/);
  });
  await t.test("missing generated skill", async (t) => {
    const directory = await fixture(t);
    await rm(join(directory, "plugins/codex-codeasier/skills/handoff"), { recursive: true });
    await expectFailure(directory, /skill directories must be exactly/);
  });
  await t.test("forbidden upstream vocabulary", async (t) => {
    const directory = await fixture(t);
    await writeFile(join(directory, "plugins/codex-codeasier/skills/handoff/SKILL.md"), "---\nname: handoff\ndescription: Handoff work.\n---\nUse the question tool.\n");
    await expectFailure(directory, /contains forbidden text: question tool/);
  });
});
