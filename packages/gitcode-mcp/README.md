# Codeasier GitCode MCP

An independently installable MCP server for GitCode repositories, file publishing,
issues and pull requests. It reuses `pygitcode` services and supports stdio and Streamable HTTP.
Public HTTPS deployments include a GitCode OAuth broker for connecting ChatGPT
directly by Server URL.

Requires Python 3.11 or later. From a checkout of `codeasier/codex-codeasier`:

```sh
python -m pip install ./packages/gitcode-mcp
gitcode-mcp --help
python -m gitcode_mcp.smoke
```

For local stdio or controlled static-bearer HTTP clients, supply `GITCODE_TOKEN`
(or `GC_TOKEN`) through the process environment or your secret manager. This is the
default `GITCODE_MCP_AUTH_MODE=bearer`. Set `GITCODE_MCP_READ_ONLY=true` to expose only read tools and
`GITCODE_MCP_ALLOWED_REPOS=owner/repository,owner/other` to constrain repository
access. Tokens are never MCP tool arguments.

For public HTTP, set `GITCODE_MCP_AUTH_MODE=oauth` and follow the
[OAuth setup guide](https://github.com/codeasier/codex-codeasier/blob/main/docs/gitcode/oauth.md).
Configure a GitCode OAuth application, a separate preregistered MCP client, exact
HTTPS callbacks, and persistent encrypted SQLite state. OAuth mode rejects PAT
and static HTTP bearer configuration; each authorized connection uses its own
GitCode identity and receives separate MCP access tokens. It supports PKCE,
explicit consent, refresh and revocation, with a fixed authorization lifetime.
The environment-file and Compose examples are in `deploy/gitcode-mcp`.

The server exposes 31 tools: 19 reads and 12 writes. `gitcode_create_file`,
`gitcode_update_file` and `gitcode_delete_file` publish a single file change to an
explicit remote branch using GitCode's Contents API. Updates and deletions require
the current file Blob SHA. Each call creates a separate commit; there is no atomic
multi-file commit or force-ref operation. See the
[code publishing guide](https://github.com/codeasier/codex-codeasier/blob/main/docs/gitcode/code-publishing.md)
for limits, verification and the Issue-to-PR workflow.

These API writes use the connection's GitCode authorization. OAuth connections
with `gitcode:write` and the required upstream permissions need no additional Git
credentials for file publishing. The server's read-only mode and repository
allowlist still apply. After upgrading the runtime, restart it and refresh the
client's tool metadata. Existing write grants cover these tools; an existing
read-only grant needs a new authorization to obtain write scope.

The built-in smoke command checks stdio. Automated OAuth tests use mocked GitCode
responses; verify the final HTTPS authorization flow and a real ChatGPT read before
considering a deployment connected.

The separate `gitcode-clone OWNER/REPO DESTINATION` command clones into the machine
where it is executed. A remote MCP connection does not share its filesystem with
dot or Codex. Run this helper in the actual coding environment, using an existing
Git credential helper, SSH, or the documented temporary PAT authentication.
The MCP server does not execute a shell or run project tests. Native Git operations
and test execution remain tasks for an actual coding environment.

See the repository's [setup and operation guide](https://github.com/codeasier/codex-codeasier/tree/main/docs/gitcode)
for local plugin installation, direct HTTPS/OAuth connection, the optional private
tunnel route and the Issue-to-PR workflow. This source package is not assumed to
be published on PyPI.
