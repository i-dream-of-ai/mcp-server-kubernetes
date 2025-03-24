# Advanced README for mcp-server-kubernetes

To enable [SSE transport]() for mcp-server-kubernetes, use the ENABLE_UNSAFE_SSE_TRANSPORT environment variable.

```bash
ENABLE_UNSAFE_SSE_TRANSPORT=1 npx flux159/mcp-server-kubernetes
```

This will start an http server with the `/sse` endpoint for server-sent events. Use the `PORT` env var to configure the server port.

```bash
ENABLE_UNSAFE_SSE_TRANSPORT=1 PORT=3001 npx flux159/mcp-server-kubernetes
```
