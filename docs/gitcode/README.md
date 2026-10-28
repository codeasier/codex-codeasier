# GitCode Codex bridge

This repository maintains the Codex marketplace entry, GitCode plugin manifest, stdio MCP declaration and workflow skill. The GitCode implementation, Python packages, tests and deployment materials are maintained in [codeasier/gitcode-cli](https://github.com/codeasier/gitcode-cli).

- [Install and verify the Codex bridge](setup.md)
- [Compatibility and migration](migration.md)
- [Pinned runtime source](../../gitcode-runtime.lock.json)
- [Upstream runtime documentation](https://github.com/codeasier/gitcode-cli/tree/main/docs/gitcode)

## Responsibility boundary

| Maintained here | Maintained in gitcode-cli |
| --- | --- |
| Marketplace and `plugins/gitcode/` | GitCode client/services and CLI |
| `gitcode-runtime.lock.json`, bridge CI and installation guidance | `codeasier-gitcode-mcp`, OAuth, clone helper and runtime tests |
| Codex workflow guidance and compatibility record | Tool contracts, file publishing, Docker/Compose/Nginx and server operations |

Plugin and runtime versions are independent. A package version alone does not identify its source: the lock fixes the upstream repository, full commit and package directory. Bridge CI installs that exact source, starts the plugin's actual command and checks the 31-tool writable / 19-tool read-only catalogs and local rejection guards.

The original `codex-codeasier` workflow plugin, its 11 generated skills and `workflow-source.lock.json` are separate and unchanged by this migration.

## Runtime documentation

| Topic | Authoritative upstream page |
| --- | --- |
| Runtime installation and local Git/clone credentials | [Setup](https://github.com/codeasier/gitcode-cli/blob/main/docs/gitcode/setup.md) |
| Tool names, parameters and permissions | [Tools](https://github.com/codeasier/gitcode-cli/blob/main/docs/gitcode/tools.md) |
| Individual file commits and uncertain-write recovery | [Code publishing](https://github.com/codeasier/gitcode-cli/blob/main/docs/gitcode/code-publishing.md) |
| Public HTTPS OAuth configuration | [OAuth](https://github.com/codeasier/gitcode-cli/blob/main/docs/gitcode/oauth.md) |
| Server operation and proxy configuration | [Deployment](https://github.com/codeasier/gitcode-cli/blob/main/docs/gitcode/deployment.md) |
| Existing authorization state and Docker volume handover | [Migration](https://github.com/codeasier/gitcode-cli/blob/main/docs/gitcode/migration.md) |
| ChatGPT connection / optional private tunnel | [Direct connection](https://github.com/codeasier/gitcode-cli/blob/main/docs/gitcode/connect-dot.md), [tunnel](https://github.com/codeasier/gitcode-cli/blob/main/docs/gitcode/connect-tunnel.md) |

A local plugin update is not a public server deployment, account reconnection or grant of local Git credentials. Public production upgrades remain an operator-controlled action.
