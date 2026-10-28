# GitCode plugin

The `gitcode` plugin adds GitCode repository, issue, and pull-request tools to this marketplace. Its MCP server is a separate Python package in [`packages/gitcode-mcp`](../../packages/gitcode-mcp). The existing `codex-codeasier` workflow plugin remains independently installable.

The server supports stdio and Streamable HTTP. Public HTTPS deployments can use the GitCode OAuth broker so each ChatGPT connection authorizes its own GitCode account. The marketplace package uses stdio and starts an already-installed `gitcode-mcp` executable in the client's execution environment. It does not download an unpublished PyPI package, install Python dependencies, deploy a service, or connect an account by itself.

## Choose a setup

| Goal | Start here |
| --- | --- |
| Use the plugin from a local Codex environment | [Install and verify](setup.md) |
| Connect ChatGPT/dot directly to a public HTTPS server | [Connect ChatGPT with GitCode OAuth](connect-dot.md) |
| Configure GitCode login, callbacks and persistent credentials | [OAuth configuration](oauth.md) |
| Run a service on a persistent host or in Docker | [Deployment](deployment.md) |
| Explicitly use a private stdio tunnel | [Optional Secure MCP Tunnel](connect-tunnel.md) |
| Inspect the tool surface and write operations | [Tools](tools.md) |

## Code execution is separate from API access

`gitcode_get_clone_info` returns clone URLs without credentials and repository metadata. It does **not** clone a repository or create a directory in dot's workspace.

For code changes, dot must choose a coding environment that has Git, a checkout, and its own GitCode authentication. The workflow is:

1. Read the issue and repository through MCP.
2. Obtain clone metadata with `gitcode_get_clone_info`.
3. Clone in the actual coding environment, edit, and run checks there.
4. Commit and push from that environment.
5. Create the PR through MCP using the verified remote branch.

The package also installs `gitcode-clone` for step 3. It supports existing Git credential helpers or SSH, and can use a token through temporary askpass for HTTPS cloning. It does not save that token for future pushes. See [setup](setup.md#clone-in-the-coding-environment).

A dot's cloud computer, a connected computer, a delegated Codex cloud task, and the MCP host can be different machines. Installing a CLI or setting a token on one does not install or authorize it on the others. OpenAI documents these task boundaries in [Tasks and memory](https://learn.chatgpt.com/docs/dots/tasks-and-memory) and [Computers and apps](https://learn.chatgpt.com/docs/dots/computers-and-apps).

## Runtime requirements

- Python 3.11 or newer.
- The package's pinned MCP SDK and GitCode client dependencies, installed with the package.
- Git for `gitcode-clone` and code modification workflows; API tools do not require Git.
- For local stdio/static-bearer mode: an authorized GitCode token on the MCP host.
- For public OAuth mode: a registered GitCode OAuth application, distinct MCP client credentials, a public HTTPS origin and persistent encrypted state.
- Separate Git credentials in any coding environment.

## Release boundary

This repository supplies source, local plugin packaging, a runtime, tests and deployment instructions. A Git commit or marketplace installation does not deploy HTTPS, register a GitCode OAuth application, configure user credentials or prove a live dot connection. Automated OAuth tests use mocked upstream endpoints. Complete the actual public HTTP authorization and a read through your ChatGPT connection before enabling the intended write workflow; a stdio smoke check does not verify that route.
