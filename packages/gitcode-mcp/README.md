# Codeasier GitCode MCP

An independently installable MCP server for GitCode repositories, issues and pull
requests. It reuses `pygitcode` services and supports stdio and Streamable HTTP.

Requires Python 3.11 or later. From a checkout of `codeasier/codex-codeasier`:

```sh
python -m pip install ./packages/gitcode-mcp
gitcode-mcp --help
python -m gitcode_mcp.smoke
```

Supply `GITCODE_TOKEN` (or `GC_TOKEN`) through the process environment or your secret
manager. Set `GITCODE_MCP_READ_ONLY=true` to expose only read tools and
`GITCODE_MCP_ALLOWED_REPOS=owner/repository,owner/other` to constrain repository
access. Tokens are never MCP tool arguments.

The separate `gitcode-clone OWNER/REPO DESTINATION` command clones into the machine
where it is executed. A remote MCP connection does not share its filesystem with
dot or Codex. Run this helper in the actual coding environment, using an existing
Git credential helper, SSH, or the documented temporary PAT authentication.

See the repository's [setup and operation guide](https://github.com/codeasier/codex-codeasier/tree/main/docs/gitcode)
for plugin installation, dot's Secure MCP Tunnel setup, HTTP configuration and the
Issue-to-PR workflow. This source package is not assumed to be published on PyPI.
