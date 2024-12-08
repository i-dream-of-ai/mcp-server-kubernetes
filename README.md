# mcp-server-kubernetes

MCP Server that can connect to a Kubernetes cluster and manage it.

## How to run tests locally

```bash
git clone https://github.com/Flux159/mcp-server-kubernetes.git
cd mcp-server-kubernetes
npm install
npm test
```

## Usage with Claude Desktop

Clone the repo, install the dependencies, and build the dist folder:

```
npm run build
```

To use this server with the Claude Desktop app, add the following configuration to the "mcpServers" section of your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "kubernetes": {
      "command": "node",
      "args": ["/your/path/to/mcp-server-kubernetes/dist/index.js"]
    }
  }
}
```

The server will automatically connect to your current kubectl context. Make sure you have:

1. kubectl installed and in your PATH
2. A valid kubeconfig file
3. Access to a Kubernetes cluster

You can verify your connection by asking Claude to list your pods or create a test deployment.

## Features

- [x] Connect to a Kubernetes cluster
- [x] List all pods
- [x] List all services
- [x] List all deployments
- [x] Create a pod
- [x] Delete a pod
- [x] List all namespaces
- [] Port forward to a pod
- [] Get logs from a pod for debugging
- [] Choose namespace for next commands (memory)
- [] Support Helm for installing charts

## Not planned

Authentication / adding clusters to kubectx.
