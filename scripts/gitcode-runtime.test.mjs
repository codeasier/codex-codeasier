import assert from "node:assert/strict";
import test from "node:test";
import { runtimeRequirement, validateRuntimeLock } from "./gitcode-runtime.mjs";

// Synthetic data tests syntax only. The committed operational lock uses a verified upstream SHA.
const fixture = () => ({
  repository: "codeasier/gitcode-cli",
  commit: "a".repeat(40),
  subdirectory: "packages/gitcode-mcp",
  distribution: "codeasier-gitcode-mcp",
  version: "0.3.0",
});

test("renders one exact upstream Git requirement without shell interpretation", () => {
  const lock = fixture();
  assert.deepEqual(validateRuntimeLock(lock), []);
  assert.equal(runtimeRequirement(lock), `codeasier-gitcode-mcp @ git+https://github.com/codeasier/gitcode-cli@${lock.commit}#subdirectory=packages/gitcode-mcp`);
});

test("rejects floating refs, short SHAs, and missing or additional fields", () => {
  for (const commit of ["main", "mcp-v0.3.0", "f93b67b", "A".repeat(40), "a".repeat(39)]) {
    assert.throws(() => runtimeRequirement({ ...fixture(), commit }), /full lowercase commit SHA/);
  }
  for (const value of [null, [], "package"]) assert.ok(validateRuntimeLock(value).length);
  const missing = fixture();
  delete missing.version;
  assert.throws(() => runtimeRequirement(missing), /fields must be exactly/);
  assert.throws(() => runtimeRequirement({ ...fixture(), token: "not-a-credential" }), /fields must be exactly/);
});

test("rejects a different repository, distribution, directory or nonexact version", () => {
  for (const [field, value] of [
    ["repository", "example/unreviewed"],
    ["subdirectory", "../outside"],
    ["distribution", "other-package"],
    ["version", ">=0.3.0"],
    ["version", "0.3.0; echo unsafe"],
  ]) assert.throws(() => runtimeRequirement({ ...fixture(), [field]: value }));
});
