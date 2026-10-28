# GitCode plugin

The `gitcode` plugin adds GitCode repository, issue, and pull-request tools to this marketplace. Its MCP server is a separate Python package in [`packages/gitcode-mcp`](../../packages/gitcode-mcp). The existing `codex-codeasier` workflow plugin remains independently installable.

The server supports stdio and Streamable HTTP. The marketplace package uses stdio and starts an already-installed `gitcode-mcp` executable in the client's execution environment. It does not download an unpublished PyPI package, install Python dependencies, deploy a service, or connect an account by itself.

## Choose a setup

| Goal | Start here |
| --- | --- |
| Use the plugin from a local Codex environment | [Install and verify](setup.md) |
| Let a cloud dot call the GitCode tools | [Connect dot through Secure MCP Tunnel](connect-dot.md) |
| Run a service on a persistent host or in Docker | [Deployment](deployment.md) |
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
- An authorized GitCode token on the MCP host, and separate Git credentials in any coding environment.

## Release boundary

Version `0.1.0` supplies source, local plugin packaging, a runtime, tests, and deployment instructions. A Git commit or marketplace installation does not provision OpenAI Platform tunnels, configure user credentials, or prove a live dot connection. Complete the read-only smoke checks on your actual account before enabling the intended write workflow.
