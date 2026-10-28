import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const fields = ["commit", "distribution", "repository", "subdirectory", "version"];

export function validateRuntimeLock(lock) {
  const errors = [];
  if (!lock || typeof lock !== "object" || Array.isArray(lock)) {
    return ["GitCode runtime lock must be an object"];
  }
  if (JSON.stringify(Object.keys(lock).sort()) !== JSON.stringify(fields)) {
    errors.push(`GitCode runtime lock fields must be exactly: ${fields.join(", ")}`);
  }
  for (const [field, value] of Object.entries({
    repository: "codeasier/gitcode-cli",
    subdirectory: "packages/gitcode-mcp",
    distribution: "codeasier-gitcode-mcp",
  })) {
    if (lock[field] !== value) errors.push(`GitCode runtime lock ${field} must equal ${JSON.stringify(value)}`);
  }
  if (typeof lock.commit !== "string" || !/^[0-9a-f]{40}$/.test(lock.commit)) {
    errors.push("GitCode runtime lock commit must be a full lowercase commit SHA, never a branch or tag");
  }
  if (typeof lock.version !== "string" || !/^\d+\.\d+\.\d+$/.test(lock.version)) {
    errors.push("GitCode runtime lock version must be an exact stable package version");
  }
  return errors;
}

export async function readRuntimeLock(root = repositoryRoot) {
  const lock = JSON.parse(await readFile(join(root, "gitcode-runtime.lock.json"), "utf8"));
  const errors = validateRuntimeLock(lock);
  if (errors.length) throw new Error(errors.join("; "));
  return lock;
}

export function runtimeRequirement(lock) {
  const errors = validateRuntimeLock(lock);
  if (errors.length) throw new Error(errors.join("; "));
  return `${lock.distribution} @ git+https://github.com/${lock.repository}@${lock.commit}#subdirectory=${lock.subdirectory}`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) {
    console.error("Usage: node scripts/gitcode-runtime.mjs");
    process.exitCode = 1;
  } else {
    try {
      console.log(runtimeRequirement(await readRuntimeLock()));
    } catch (error) {
      console.error(`error: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
