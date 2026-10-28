"""Real Codex plugin install/discovery acceptance; no account, turns or OAuth.

Run only in the CI acceptance job with the checksum-pinned official Codex CLI.
The existing bridge smoke is reused against the actual installed plugin copy.
"""

from __future__ import annotations

import argparse
import asyncio
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import tempfile

VERSION = "0.165.0"
PLUGIN = "gitcode@codex-codeasier"
ALLOWED_RPC = {"initialize", "skills/list", "mcpServerStatus/list"}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def isolated_environment(home: Path, runtime_bin: Path) -> dict[str, str]:
    # An allowlist, not removal of a few known secret names: do not inherit
    # GitHub/OpenAI/GitCode credentials, proxy settings or user configuration.
    return {
        "PATH": f"{runtime_bin}:/usr/bin:/bin",
        "HOME": str(home),
        "USERPROFILE": str(home),
        "CODEX_HOME": str(home / ".codex"),
        "XDG_CONFIG_HOME": str(home / ".config"),
        "XDG_CACHE_HOME": str(home / ".cache"),
        "XDG_DATA_HOME": str(home / ".local/share"),
        "TMPDIR": str(home / "tmp"),
        "LANG": "C.UTF-8",
        "TERM": "dumb",
    }


def command(codex: Path, arguments: list[str], environment: dict[str, str], cwd: Path):
    result = subprocess.run(
        [str(codex), *arguments], env=environment, cwd=cwd,
        stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=60,
        check=False,
    )
    require(result.returncode == 0, f"Codex {' '.join(arguments)} failed: {result.stderr.strip()}")
    return result.stdout


def installed_copy(root: Path, home: Path, outcome: dict) -> Path:
    require(outcome.get("pluginId") == PLUGIN, "Codex installed a different plugin.")
    require(outcome.get("version") == "0.4.0", "Unexpected installed bridge version.")
    installed = Path(outcome["installedPath"]).resolve(strict=True)
    require(installed.is_relative_to(home / ".codex/plugins/cache"), "Plugin was not installed into the isolated cache.")
    source = root / "plugins/gitcode"
    for original in source.rglob("*"):
        require(not original.is_symlink(), "Unexpected source plugin symlink.")
        if original.is_file():
            cached = installed / original.relative_to(source)
            require(cached.resolve().is_relative_to(installed), "Installed plugin file escapes its cache.")
            require(cached.read_bytes() == original.read_bytes(), f"Installed plugin differs: {original.relative_to(source)}")
    return installed


async def discover(codex: Path, environment: dict[str, str], cwd: Path, installed: Path, expected: set[str]) -> dict:
    # No thread/start, turn/start, login or OAuth method is allowed here.
    process = await asyncio.create_subprocess_exec(
        str(codex), "app-server", "--listen", "stdio://",
        env=environment, cwd=cwd, stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        start_new_session=True,
    )
    stderr_task = asyncio.create_task(process.stderr.read())
    counter = 0

    async def request(method: str, params: dict) -> dict:
        nonlocal counter
        require(method in ALLOWED_RPC, "Unsafe app-server method requested.")
        counter += 1
        request_id = counter
        process.stdin.write((json.dumps({"id": request_id, "method": method, "params": params}) + "\n").encode())
        await process.stdin.drain()
        async with asyncio.timeout(90):
            while True:
                line = await process.stdout.readline()
                require(bool(line), f"Codex app-server exited during {method}.")
                message = json.loads(line)
                # Never answer an authentication, approval or tool request.
                require(not ("method" in message and "id" in message), f"Blocked: app-server requested client action {message.get('method')}.")
                notification = str(message.get("method", "")).lower()
                require("oauth" not in notification and "login" not in notification, "Blocked: app-server requested authentication.")
                if message.get("id") == request_id:
                    require("error" not in message, f"Codex {method} failed: {message.get('error')}")
                    return message["result"]

    try:
        initialized = await request("initialize", {
            "clientInfo": {"name": "gitcode_plugin_acceptance", "version": "1.0.0"},
            "capabilities": {"explicitGatewayOauth": True},
        })
        process.stdin.write(b'{"method":"initialized"}\n')
        await process.stdin.drain()
        skills = await request("skills/list", {"cwds": [str(cwd)], "forceReload": True})
        entries = skills["data"]
        require(len(entries) == 1 and not entries[0]["errors"], "Codex skill discovery reported errors.")
        matches = [skill for skill in entries[0]["skills"] if skill.get("pluginId") == PLUGIN]
        require(len(matches) == 1, "Codex did not discover the installed GitCode skill.")
        skill = matches[0]
        require(skill["name"] == "gitcode:gitcode-workflow" and skill["enabled"], "Unexpected GitCode skill identity or enabled state.")
        require(Path(skill["path"]).resolve(strict=True) == installed / "skills/gitcode-workflow/SKILL.md", "Codex discovered a source skill instead of the installed copy.")
        servers = await request("mcpServerStatus/list", {"detail": "toolsAndAuthOnly"})
        require(not servers.get("nextCursor"), "Unexpected paginated MCP inventory.")
        matches = [server for server in servers["data"] if server.get("pluginId") == PLUGIN]
        require(len(matches) == 1, "Codex did not discover the installed plugin MCP server.")
        server = matches[0]
        require(server["name"] == "gitcode" and not server.get("toolsError"), "GitCode MCP startup failed in Codex.")
        require(server["authStatus"] not in {"notLoggedIn", "oAuth"}, "Blocked: plugin MCP needs authentication.")
        require(set(server["tools"]) == expected, "Codex MCP inventory differs from the 31-tool baseline.")
        return {"initialize": initialized, "skills": skills, "mcpServers": servers}
    finally:
        # Terminate only this newly created process group, including its MCP child.
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            await asyncio.wait_for(process.wait(), 5)
        except TimeoutError:
            os.killpg(process.pid, signal.SIGKILL)
            await process.wait()
        await stderr_task


async def check(root: Path, codex: Path, evidence: dict) -> None:
    spec = importlib.util.spec_from_file_location("gitcode_bridge", root / "scripts/smoke-gitcode-bridge.py")
    bridge = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bridge)
    runtime, _, runtime_version, commit = bridge.verify_source(root)
    evidence.update({"codexVersion": VERSION, "runtimeVersion": runtime_version, "runtimeCommit": commit})
    with tempfile.TemporaryDirectory(prefix="codex-plugin-acceptance-") as temporary:
        home = Path(temporary)
        cwd = home / "unrelated-workspace"
        for directory in (cwd, home / ".codex", home / "tmp"):
            directory.mkdir()
        environment = isolated_environment(home, Path(runtime).parent)
        # Only newly created CI configuration; no credentials or MCP overrides.
        (home / ".codex/config.toml").write_text("[features]\nplugins = true\n\n[analytics]\nenabled = false\n", encoding="utf-8")
        require(command(codex, ["--version"], environment, cwd).strip() == f"codex-cli {VERSION}", "Codex binary version does not match the pinned release.")
        for name, arguments in (
            ("marketplaceAdd", ["plugin", "marketplace", "add", str(root), "--json"]),
            ("pluginAdd", ["plugin", "add", PLUGIN, "--json"]),
            ("pluginList", ["plugin", "list", "--marketplace", "codex-codeasier", "--json"]),
        ):
            evidence[name] = json.loads(command(codex, arguments, environment, cwd))
        installed = installed_copy(root, home, evidence["pluginAdd"])
        plugins = evidence["pluginList"]["installed"]
        require(len(plugins) == 1 and plugins[0]["pluginId"] == PLUGIN, "Unexpected Codex installed plugin inventory.")
        require(plugins[0]["enabled"] and plugins[0]["installed"] and plugins[0]["version"] == "0.4.0", "GitCode is not installed and enabled.")
        expected = {f"gitcode_{name}" for name in bridge.READ_TOOLS | set(bridge.WRITE_ARGUMENTS)}
        evidence["discovery"] = await discover(codex, environment, cwd, installed, expected)
        # Use the real cached declaration, not a hand-built MCP configuration.
        declaration = json.loads((installed / "mcp.json").read_text())["mcpServers"]["gitcode"]
        require(declaration == {"type": "stdio", "command": "gitcode-mcp"}, "Installed MCP declaration changed.")
        require(bridge.installed_entrypoint(declaration["command"]) == runtime, "Installed plugin resolves a different runtime.")
        # Codex intentionally does not forward arbitrary GITCODE_* variables.
        # The 19-tool view and denial checks use the cached command directly,
        # with explicit safe configuration and the existing bridge protocol test.
        previous = dict(os.environ)
        try:
            os.environ.clear()
            os.environ.update(environment)
            await bridge.check_view(runtime, str(cwd), False)
            await bridge.check_view(runtime, str(cwd), True)
        finally:
            os.environ.clear()
            os.environ.update(previous)
        require(not (home / ".codex/auth.json").exists(), "Unexpected authentication state created.")
        evidence["installedCommandViews"] = {"readWrite": 31, "readOnly": 19, "writeDenials": 12}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--codex", type=Path, required=True)
    parser.add_argument("--evidence", type=Path, required=True)
    args = parser.parse_args()
    evidence = {"status": "blocked", "noModelCalls": True, "noLoginOrOauth": True}
    try:
        asyncio.run(check(args.root.resolve(strict=True), args.codex.resolve(strict=True), evidence))
        evidence["status"] = "passed"
        print("Codex plugin acceptance passed: real marketplace/add/list, cached skill/MCP discovery, 31/19 tools and 12 write denials; no login or model turn.")
    except Exception as error:
        evidence["error"] = str(error)
        raise SystemExit(f"BLOCKED: real Codex plugin acceptance did not pass: {error}") from error
    finally:
        args.evidence.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
