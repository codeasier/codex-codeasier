"""Focused bridge-helper regressions; runtime business tests remain upstream."""

import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "gitcode_bridge_smoke", Path(__file__).with_name("smoke-gitcode-bridge.py")
)
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class BridgeHelpers(unittest.TestCase):
    def test_relative_path_resolution_is_frozen_before_cwd_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            scripts = base / "bin"
            scripts.mkdir()
            command = scripts / "gitcode-mcp"
            command.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
            command.chmod(0o700)
            previous = Path.cwd()
            try:
                os.chdir(base)
                with patch.dict(os.environ, {"PATH": "bin"}), patch.object(
                    bridge.sysconfig, "get_path", return_value=str(scripts)
                ):
                    resolved = bridge.installed_entrypoint("gitcode-mcp")
                os.chdir(previous)
                self.assertEqual(resolved, str(command.resolve()))
                self.assertTrue(Path(resolved).is_absolute())
            finally:
                os.chdir(previous)

    def test_other_python_environment_is_rejected(self):
        with patch.object(bridge.shutil, "which", side_effect=["/other/gitcode-mcp", "/expected/gitcode-mcp"]):
            with self.assertRaisesRegex(RuntimeError, "different environment"):
                bridge.installed_entrypoint("gitcode-mcp")

    def test_child_environment_never_inherits_gitcode_credentials_or_config(self):
        with patch.dict(os.environ, {
            "GC_TOKEN": "synthetic-never-used",
            "GITCODE_TOKEN": "synthetic-never-used",
            "GITCODE_MCP_AUTH_MODE": "oauth",
            "GITCODE_MCP_OAUTH_DATABASE": "/must-not-open",
            "PYTHONPATH": "/must-not-import",
        }):
            environment = bridge.clean_environment("/empty-home", True)
        self.assertNotIn("GC_TOKEN", environment)
        self.assertNotIn("GITCODE_TOKEN", environment)
        self.assertNotIn("GITCODE_MCP_OAUTH_DATABASE", environment)
        self.assertNotIn("PYTHONPATH", environment)
        self.assertEqual(environment["GITCODE_MCP_AUTH_MODE"], "bearer")
        self.assertEqual(environment["GITCODE_MCP_READ_ONLY"], "true")
        self.assertEqual(environment["HOME"], "/empty-home")


if __name__ == "__main__":
    unittest.main()
