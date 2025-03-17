# mcp-server-kubernetes

MCP Server that can connect to a Kubernetes cluster and manage it.

https://github.com/user-attachments/assets/f25f8f4e-4d04-479b-9ae0-5dac452dd2ed

<a href="https://glama.ai/mcp/servers/w71ieamqrt"><img width="380" height="200" src="https://glama.ai/mcp/servers/w71ieamqrt/badge" /></a>

## Usage with Claude Desktop

```json
{
  "mcpServers": {
    "kubernetes": {
      "command": "npx",
      "args": ["mcp-server-kubernetes"]
    }
  }
}
```

The server will automatically connect to your current kubectl context. Make sure you have:

1. kubectl installed and in your PATH
2. A valid kubeconfig file with contexts configured
3. Access to a Kubernetes cluster configured for kubectl (e.g. minikube, Rancher Desktop, GKE, etc.)
4. Helm v3 installed and in your PATH (no Tiller required). Optional if not using helm charts.

You can verify your connection by asking Claude to list your pods or create a test deployment.

If you have errors open up a standard terminal and run `kubectl get pods` to see if you can connect to your cluster without credentials issues.

## Features

- [x] Connect to a Kubernetes cluster
- [x] List all pods
- [x] List all services
- [x] List all deployments
- [x] List all nodes
- [x] Create a pod
- [x] Delete a pod
- [x] Describe a pod
- [x] List all namespaces
- [x] Get logs from a pod for debugging (supports pods deployments jobs and label selectors)
- [x] Support Helm v3 for installing charts
  - Install charts with custom values
  - Uninstall releases
  - Upgrade existing releases
  - Support for namespaces
  - Support for version specification
  - Support for custom repositories
- [ ] Port forward to a pod
- [ ] Choose namespace for next commands (memory)

## Local Development

```bash
git clone https://github.com/Flux159/mcp-server-kubernetes.git
cd mcp-server-kubernetes
bun install
```

### Development Workflow

1. Start the server in development mode (watches for file changes):

```bash
bun run dev
```

2. Run unit tests:

```bash
bun run test
```

3. Build the project:

```bash
bun run build
```

4. Local Testing with [Inspector](https://github.com/modelcontextprotocol/inspector)

```bash
npx @modelcontextprotocol/inspector node build/index.js
# Follow further instructions on terminal for Inspector link
```

### Project Structure

```
├── src/
│   ├── index.ts              # Main server implementation
│   ├── types.ts              # Type re-exports
│   ├── config/              # Configuration files
│   │   ├── container-templates.ts  # Container configurations
│   │   ├── server-config.ts       # Server settings
│   │   ├── deployment-config.ts    # Deployment schemas
│   │   └── ...
│   ├── models/              # Data models and schemas
│   │   ├── response-schemas.ts    # API response schemas
│   │   ├── resource-models.ts     # Resource models
│   │   └── tool-models.ts         # Tool schemas
│   ├── utils/               # Utility classes
│   │   └── kubernetes-manager.ts  # K8s management
│   ├── resources/           # Resource handlers
│   │   └── handlers.ts      # Resource implementation
│   └── tools/              # Tool implementations
│       ├── list_pods.ts
│       ├── list_services.ts
│       ├── list_deployments.ts
│       └── ...
├── tests/                  # Test files
│   └── unit.test.ts        # Unit tests
│   └── helm.test.ts        # Helm tests
└── ...
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

For bigger changes please open an issue first to discuss the proposed changes.

## Architecture

This section describes the high-level architecture of the MCP Kubernetes server.

### Request Flow

The sequence diagram below illustrates how requests flow through the system:

```mermaid
sequenceDiagram
    participant Client
    participant Transport as StdioTransport
    participant Server as MCP Server
    participant Handler as Request Handler
    participant K8sManager as KubernetesManager
    participant K8s as Kubernetes API

    Client->>Transport: Send Request via STDIO
    Transport->>Server: Forward Request

    alt Tools Request
        Server->>Handler: Route to tools handler
        Handler->>K8sManager: Execute tool operation
        K8sManager->>K8s: Make API call
        K8s-->>K8sManager: Return result
        K8sManager-->>Handler: Process response
        Handler-->>Server: Return tool result
    else Resource Request
        Server->>Handler: Route to resource handler
        Handler->>K8sManager: Get resource data
        K8sManager->>K8s: Query API
        K8s-->>K8sManager: Return data
        K8sManager-->>Handler: Format response
        Handler-->>Server: Return resource data
    end

    Server-->>Transport: Send Response
    Transport-->>Client: Return Final Response
```

## Not planned

Authentication / adding clusters to kubectx.
