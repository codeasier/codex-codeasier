# Deploy GitCode MCP

The source can run as a local stdio process, behind Secure MCP Tunnel, or as a controlled Streamable HTTP service. Deployment is separate from installing the marketplace package.

The GitCode HTTP adapter connects directly to the fixed `https://api.gitcode.com/api/v5/` origin and does not follow redirects or read environment proxy settings. Provide direct network egress from the host. Proxy settings for OpenAI's separate tunnel client do not configure the GitCode adapter.

## Private stdio service for dot

Use [Connect dot](connect-dot.md). Run the installed `gitcode-mcp` as the child command of `tunnel-client` on a persistent host. Supply `GITCODE_TOKEN`/`GC_TOKEN` and the OpenAI tunnel runtime key through your service manager's secret delivery. Keep the service's profile and working directory accessible to its service account.

This is the default recommendation for private dot use: it needs no public listener and keeps upstream credentials on the host. A service restart must stop the previous stdio tunnel instance before starting another instance for the same tunnel ID.

## Streamable HTTP on the host

After [installing the runtime](setup.md), start an HTTP MCP endpoint bound to loopback:

```bash
gitcode-mcp --transport streamable-http --host 127.0.0.1 --port 8765
```

The endpoint is `http://127.0.0.1:8765/mcp`. Use MCP Inspector with Streamable HTTP to inspect it. This is an MCP endpoint, not a REST health page; opening it in a browser is not a meaningful tool-call check.

Set a separate `GITCODE_MCP_HTTP_TOKEN` to require `Authorization: Bearer ...` for HTTP access. It must contain at least 32 characters and differ from the GitCode token. Binding to a non-loopback address requires this token. The GitCode API token and HTTP bearer token serve different purposes.

HTTP Host validation defaults to `127.0.0.1:*`, `localhost:*`, and `[::1]:*`. If an approved gateway forwards a different Host, configure `GITCODE_MCP_ALLOWED_HOSTS` for that deployment's exact hosts instead of disabling validation.

For a network-facing deployment, terminate TLS at a trusted gateway and enforce that deployment's access policy. If using mTLS, configure certificates and verification at the gateway or tunnel. This repository does not implement OAuth discovery, an OAuth authorization server, or client-certificate verification in the Python HTTP listener. Do not describe a bearer-protected endpoint as a working ChatGPT OAuth integration.

## Docker

The Compose configuration builds the package from this checkout. It runs as an unprivileged user, publishes only a loopback host port, and requires an HTTP bearer token because the process binds to the container's network interface.

Supply credentials in the environment without literal secrets in command arguments:

```bash
read -r -s -p 'GitCode token: ' GITCODE_TOKEN
export GITCODE_TOKEN
read -r -s -p 'HTTP MCP bearer token (32+ characters): ' GITCODE_MCP_HTTP_TOKEN
export GITCODE_MCP_HTTP_TOKEN
export GITCODE_MCP_ALLOWED_REPOS='owner/repository'
export GITCODE_MCP_READ_ONLY=true
docker compose -f deploy/gitcode-mcp/compose.yaml up --build -d
```

The host endpoint remains `http://127.0.0.1:8765/mcp`. Configure its bearer token in the inspecting client's secure authentication settings. Avoid commands that dump the resolved Compose environment into logs.

Inspect startup and stop the service with:

```bash
docker compose -f deploy/gitcode-mcp/compose.yaml logs --tail=50
docker compose -f deploy/gitcode-mcp/compose.yaml down
```

Changing a shell environment variable does not change a running container. Recreate it with the intended configuration. Enabling writes requires `GITCODE_MCP_READ_ONLY=false` and sufficient upstream permissions; it does not remove the client's approval controls.

## Verify a deployment

1. Confirm that the process starts and the MCP client can list tools.
2. Call `gitcode_get_repository` on an allowed repository and verify the identity of the returned repository.
3. Call `gitcode_get_clone_info`; verify that neither clone URL contains a credential.
4. Confirm an out-of-allowlist repository is rejected before it reaches GitCode.
5. Confirm read-only mode denies a write without changing remote state.
6. For dot, repeat the read through the installed custom MCP connection. Local tests and a successful container start do not establish that step.

Use a dedicated test repository for any explicitly authorized write verification. Check remote state before retrying a write after a timeout.

## Upgrades and scope

Install or rebuild the updated package, restart the process, and refresh tool metadata in the relevant ChatGPT connection. Existing client sessions may retain old schemas until refreshed or reopened.

This service is configured for one upstream GitCode credential per process. Repository restrictions reduce its accessible scope, but do not create per-user GitCode identities. For a shared multi-user deployment, implement per-user credential binding and an appropriate MCP OAuth layer before exposing a shared service. A private single-account tunnel should remain limited to its intended account/workspace.

## Official references

- [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)
- [Add custom MCP server](https://developers.openai.com/api/docs/guides/custom-mcp-server)
- [Plugin authentication](https://developers.openai.com/plugins/build/auth)
- [Package your plugin](https://developers.openai.com/plugins/build/plugins)
- [GitCode personal access tokens](https://docs.gitcode.com/docs/help/home/user_center/security_management/user_pat/)
- [GitCode OAuth](https://docs.gitcode.com/docs/apis/oauth/)
