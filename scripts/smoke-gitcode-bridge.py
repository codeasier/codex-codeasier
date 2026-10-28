"""Verify the installed, pinned GitCode runtime through the plugin's real command.

Offline only: strip GitCode credentials and configuration before starting stdio.
This is bridge acceptance, not an OAuth deployment or live GitCode API test.
"""

from __future__ import annotations

import argparse
import importlib.metadata
import json
import os
from pathlib import Path
import shutil
import subprocess
import sysconfig
import tempfile

import anyio
from mcp.client import Client
from mcp.client.stdio import StdioServerParameters

READ_TOOLS = {
    "get_repository", "get_clone_info", "list_branches", "get_branch",
    "get_file_contents", "get_repository_tree", "list_commits", "get_commit",
    "list_issues", "get_issue", "list_issue_comments", "list_labels", "list_milestones",
    "list_pull_requests", "get_pull_request", "list_pull_request_files",
    "get_pull_request_diff", "list_pull_request_comments", "list_pull_request_commits",
}
WRITE_ARGUMENTS = {
    "create_branch": {"branch_name": "bridge-smoke", "refs": "main"},
    "create_file": {"path": "example.txt", "branch": "bridge-smoke", "message": "Smoke", "content": ""},
    "update_file": {"path": "example.txt", "branch": "bridge-smoke", "message": "Smoke", "content": "", "sha": "a" * 40},
    "delete_file": {"path": "example.txt", "branch": "bridge-smoke", "message": "Smoke", "sha": "a" * 40},
    "create_issue": {"title": "Smoke"},
    "update_issue": {"issue_number": 1, "title": "Smoke"},
    "add_issue_comment": {"issue_number": 1, "body": "Smoke"},
    "create_pull_request": {"title": "Smoke", "head": "bridge-smoke", "base": "main"},
    "update_pull_request": {"pull_number": 1, "title": "Smoke"},
    "add_pull_request_comment": {"pull_number": 1, "body": "Smoke"},
    "approve_pull_request": {"pull_number": 1},
    "merge_pull_request": {"pull_number": 1},
}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def installed_entrypoint(name: str) -> str:
    resolved = shutil.which(name)
    own = shutil.which(name, path=sysconfig.get_path("scripts"))
    require(bool(resolved and own), f"Install {name} in this Python environment and expose it on PATH.")
    require(Path(resolved).resolve() == Path(own).resolve(), f"PATH selects a different environment's {name}.")
    # PATH can contain relative entries. Freeze the verified executable before
    # the subprocess changes its cwd, rather than resolving the bare name again.
    return str(Path(resolved).resolve())


def verify_source(root: Path) -> tuple[str, str, str, str]:
    lock = json.loads((root / "gitcode-runtime.lock.json").read_text(encoding="utf-8"))
    require(set(lock) == {"repository", "commit", "subdirectory", "distribution", "version"}, "Unexpected runtime lock fields.")
    require(lock["repository"] == "codeasier/gitcode-cli", "Unexpected runtime repository.")
    require(lock["subdirectory"] == "packages/gitcode-mcp", "Unexpected runtime subdirectory.")
    require(lock["distribution"] == "codeasier-gitcode-mcp", "Unexpected runtime distribution.")
    commit = lock["commit"]
    require(isinstance(commit, str) and len(commit) == 40 and all(c in "0123456789abcdef" for c in commit), "Runtime source must use a full commit SHA.")
    distribution = importlib.metadata.distribution(lock["distribution"])
    require(distribution.version == lock["version"], "Installed runtime version differs from the lock.")
    direct_url_text = distribution.read_text("direct_url.json")
    require(bool(direct_url_text), "Install the exact Git requirement from scripts/gitcode-runtime.mjs; package version alone is not source proof.")
    direct_url = json.loads(direct_url_text)
    require(direct_url.get("url", "").removesuffix(".git") == "https://github.com/codeasier/gitcode-cli", "Installed runtime came from a different repository.")
    require(direct_url.get("subdirectory") == lock["subdirectory"], "Installed runtime came from a different subdirectory.")
    vcs = direct_url.get("vcs_info", {})
    require(vcs.get("vcs") == "git" and vcs.get("commit_id") == commit, "Installed runtime commit differs from the lock.")
    entrypoints = {entry.name: entry.value for entry in distribution.entry_points if entry.group == "console_scripts"}
    require(entrypoints.get("gitcode-mcp") == "gitcode_mcp.__main__:main", "Unexpected MCP entry point.")
    require(entrypoints.get("gitcode-clone") == "gitcode_mcp.clone:main", "Unexpected clone helper entry point.")
    manifest = json.loads((root / "plugins/gitcode/mcp.json").read_text(encoding="utf-8"))
    server = manifest["mcpServers"]["gitcode"]
    require(server == {"type": "stdio", "command": "gitcode-mcp"}, "Unexpected plugin MCP declaration.")
    command = installed_entrypoint(server["command"])
    clone_command = installed_entrypoint("gitcode-clone")
    return command, clone_command, lock["version"], commit


def clean_environment(home: str, read_only: bool) -> dict[str, str]:
    environment = {
        key: value for key, value in os.environ.items()
        if not key.startswith("GITCODE_") and key not in {"GC_TOKEN", "PYTHONPATH", "PYTHONHOME"}
    }
    environment.update({
        "HOME": home,
        "USERPROFILE": home,
        "XDG_CONFIG_HOME": home,
        "GITCODE_MCP_AUTH_MODE": "bearer",
        "GITCODE_MCP_READ_ONLY": "true" if read_only else "false",
        "GITCODE_MCP_ALLOWED_REPOS": "bridge-smoke/allowed",
    })
    return environment


def require_error(response, code: str) -> None:
    require(bool(response.is_error), f"Expected the {code} execution guard to reject the call.")
    payload = response.structured_content or {}
    require(payload.get("error", {}).get("code") == code, f"The call did not reach the expected {code} execution guard.")


async def check_view(command: str, home: str, read_only: bool) -> None:
    parameters = StdioServerParameters(command=command, env=clean_environment(home, read_only), cwd=home)
    with anyio.fail_after(45):
        async with Client(parameters) as client:
            tools = (await client.list_tools()).tools
            expected = {f"gitcode_{name}" for name in READ_TOOLS | (set() if read_only else set(WRITE_ARGUMENTS))}
            require(len(tools) == (19 if read_only else 31), "Unexpected tool count.")
            require({tool.name for tool in tools} == expected, "Tool names differ from the migration baseline.")
            for tool in tools:
                require(tool.annotations is not None, "Tool annotations are missing.")
                is_read = tool.name.removeprefix("gitcode_") in READ_TOOLS
                require(tool.annotations.read_only_hint == is_read, "Tool permission annotation differs from the contract.")
                require(tool.annotations.idempotent_hint == is_read, "Tool retry annotation differs from the contract.")
            require_error(await client.call_tool("gitcode_get_repository", {"owner": "outside", "repo": "repo"}), "repository_not_allowed")
            require_error(await client.call_tool("gitcode_get_repository", {"owner": "../escape", "repo": "repo"}), "invalid_arguments")
            if read_only:
                for name, arguments in WRITE_ARGUMENTS.items():
                    response = await client.call_tool(f"gitcode_{name}", {"owner": "bridge-smoke", "repo": "allowed", **arguments})
                    require_error(response, "read_only")
            else:
                for name in ("create_file", "update_file", "delete_file"):
                    response = await client.call_tool(f"gitcode_{name}", {"owner": "outside", "repo": "repo", **WRITE_ARGUMENTS[name]})
                    require_error(response, "repository_not_allowed")
            # With all credentials removed this must fail locally, not contact GitCode.
            require_error(await client.call_tool("gitcode_get_repository", {"owner": "bridge-smoke", "repo": "allowed"}), "configuration_error")


async def check(root: Path) -> None:
    command, clone_command, version, commit = verify_source(root)
    with tempfile.TemporaryDirectory(prefix="gitcode-bridge-") as home:
        for entrypoint in (command, clone_command):
            result = subprocess.run([entrypoint, "--help"], env=clean_environment(home, True), cwd=home, capture_output=True, timeout=15, check=False)
            require(result.returncode == 0, f"{entrypoint} --help failed.")
        await check_view(command, home, False)
        await check_view(command, home, True)
    print(f"GitCode bridge passed: codeasier/gitcode-cli@{commit}, runtime {version}; real plugin command; 31/19 tools; read-only/allowlist/input guards; no GitCode credentials or live API calls.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    args = parser.parse_args()
    anyio.run(check, args.root.resolve())


if __name__ == "__main__":
    main()
