#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import * as k8s from "@kubernetes/client-node";
import { ResourceTracker, PortForwardTracker, WatchTracker } from "./types.js";
import { statSync } from "fs";

class KubernetesManager {
  private resources: ResourceTracker[] = [];
  private portForwards: PortForwardTracker[] = [];
  private watches: WatchTracker[] = [];
  private kc: k8s.KubeConfig;
  private k8sApi: k8s.CoreV1Api;
  private k8sAppsApi: k8s.AppsV1Api;

  constructor() {
    this.kc = new k8s.KubeConfig();
    this.kc.loadFromDefault();
    this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.k8sAppsApi = this.kc.makeApiClient(k8s.AppsV1Api);

    // process.on("SIGINT", () => this.cleanup());
    // process.on("SIGTERM", () => this.cleanup());
  }

  async cleanup() {
    // Stop watches
    for (const watch of this.watches) {
      watch.abort.abort();
    }

    // Delete tracked resources in reverse order
    for (const resource of [...this.resources].reverse()) {
      try {
        await this.deleteResource(
          resource.kind,
          resource.name,
          resource.namespace
        );
      } catch (error) {
        console.error(
          `Failed to delete ${resource.kind} ${resource.name}:`,
          error
        );
      }
    }

    // TODO: Cleanup port forwards when implemented
  }

  trackResource(kind: string, name: string, namespace: string) {
    this.resources.push({ kind, name, namespace, createdAt: new Date() });
  }

  async deleteResource(kind: string, name: string, namespace: string) {
    switch (kind.toLowerCase()) {
      case "pod":
        await this.k8sApi.deleteNamespacedPod(name, namespace);
        break;
      case "deployment":
        await this.k8sAppsApi.deleteNamespacedDeployment(name, namespace);
        break;
      case "service":
        await this.k8sApi.deleteNamespacedService(name, namespace);
        break;
    }
    this.resources = this.resources.filter(
      (r) => !(r.kind === kind && r.name === name && r.namespace === namespace)
    );
  }

  trackPortForward(pf: PortForwardTracker) {
    this.portForwards.push(pf);
  }

  getPortForward(id: string) {
    return this.portForwards.find((p) => p.id === id);
  }

  removePortForward(id: string) {
    this.portForwards = this.portForwards.filter((p) => p.id !== id);
  }

  trackWatch(watch: WatchTracker) {
    this.watches.push(watch);
  }

  getKubeConfig() {
    return this.kc;
  }
  getCoreApi() {
    return this.k8sApi;
  }
  getAppsApi() {
    return this.k8sAppsApi;
  }
}

const k8sManager = new KubernetesManager();

// Template configurations with health checks and resource limits
// TODO: Update create_pod to accept custom images and custom template files
const containerTemplates: Record<string, k8s.V1Container> = {
  ubuntu: {
    name: "main",
    image: "ubuntu:latest",
    command: ["/bin/bash"],
    args: ["-c", "sleep infinity"],
    resources: {
      limits: {
        cpu: "200m",
        memory: "256Mi",
      },
      requests: {
        cpu: "100m",
        memory: "128Mi",
      },
    },
    livenessProbe: {
      exec: {
        command: ["cat", "/proc/1/status"],
      },
      initialDelaySeconds: 5,
      periodSeconds: 10,
    },
  },
  nginx: {
    name: "main",
    image: "nginx:latest",
    ports: [{ containerPort: 80 }],
    resources: {
      limits: {
        cpu: "200m",
        memory: "256Mi",
      },
      requests: {
        cpu: "100m",
        memory: "128Mi",
      },
    },
    livenessProbe: {
      httpGet: {
        path: "/",
        port: 80,
      },
      initialDelaySeconds: 5,
      periodSeconds: 10,
    },
    readinessProbe: {
      httpGet: {
        path: "/",
        port: 80,
      },
      initialDelaySeconds: 2,
      periodSeconds: 5,
    },
  },
  busybox: {
    name: "main",
    image: "busybox:latest",
    command: ["sh"],
    args: ["-c", "sleep infinity"],
    resources: {
      limits: {
        cpu: "100m",
        memory: "64Mi",
      },
      requests: {
        cpu: "50m",
        memory: "32Mi",
      },
    },
    livenessProbe: {
      exec: {
        command: ["true"],
      },
      periodSeconds: 10,
    },
  },
  alpine: {
    name: "main",
    image: "alpine:latest",
    command: ["sh"],
    args: ["-c", "sleep infinity"],
    resources: {
      limits: {
        cpu: "100m",
        memory: "64Mi",
      },
      requests: {
        cpu: "50m",
        memory: "32Mi",
      },
    },
    livenessProbe: {
      exec: {
        command: ["true"],
      },
      periodSeconds: 10,
    },
  },
};

const server = new Server(
  {
    name: "kubernetes",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// Tools handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_pods",
        description: "List pods in a namespace",
        inputSchema: {
          type: "object",
          properties: {
            namespace: { type: "string", default: "default" },
          },
          required: ["namespace"],
        },
      },
      {
        name: "list_deployments",
        description: "List deployments in a namespace",
        inputSchema: {
          type: "object",
          properties: {
            namespace: { type: "string", default: "default" },
          },
          required: ["namespace"],
        },
      },
      {
        name: "list_services",
        description: "List services in a namespace",
        inputSchema: {
          type: "object",
          properties: {
            namespace: { type: "string", default: "default" },
          },
          required: ["namespace"],
        },
      },
      {
        name: "list_namespaces",
        description: "List all namespaces",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        // TODO: Add support for custom images and templates (see above in containerTemplates definition)
        name: "create_pod",
        description: "Create a new Kubernetes pod",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            namespace: { type: "string" },
            template: {
              type: "string",
              enum: ["ubuntu", "nginx", "busybox", "alpine"],
            },
            command: {
              type: "array",
              items: { type: "string" },
              optional: true,
            },
          },
          required: ["name", "namespace", "template"],
        },
      },
      {
        // TODO: Support for custom deployments (see above)
        name: "create_deployment",
        description: "Create a new Kubernetes deployment",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            namespace: { type: "string" },
            template: {
              type: "string",
              enum: ["ubuntu", "nginx", "busybox", "alpine"],
            },
            replicas: { type: "number", default: 1 },
            ports: {
              type: "array",
              items: { type: "number" },
              optional: true,
            },
          },
          required: ["name", "namespace", "template"],
        },
      },
      {
        name: "delete_pod",
        description: "Delete a Kubernetes pod",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            namespace: { type: "string" },
            ignoreNotFound: { type: "boolean", default: false },
          },
          required: ["name", "namespace"],
        },
      },
      {
        name: "describe_pod",
        description:
          "Describe a Kubernetes pod (read details like status, containers, etc.)",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            namespace: { type: "string" },
          },
          required: ["name", "namespace"],
        },
      },
      {
        name: "cleanup",
        description: "Cleanup all managed resources",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "list_nodes",
        description: "List all nodes in the cluster",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name } = request.params;
    const input = request.params.arguments;

    switch (name) {
      case "list_pods": {
        const listPodsInput = input as { namespace?: string };
        const namespace = listPodsInput.namespace || "default";
        const { body } = await k8sManager
          .getCoreApi()
          .listNamespacedPod(namespace);

        const pods = body.items.map((pod) => ({
          name: pod.metadata?.name || "",
          namespace: pod.metadata?.namespace || "",
          status: pod.status?.phase,
          createdAt: pod.metadata?.creationTimestamp,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ pods }, null, 2),
            },
          ],
        };
      }

      case "list_deployments": {
        const listDeploymentsInput = input as { namespace?: string };
        const namespace = listDeploymentsInput.namespace || "default";
        const { body } = await k8sManager
          .getAppsApi()
          .listNamespacedDeployment(namespace);

        const deployments = body.items.map((deployment) => ({
          name: deployment.metadata?.name || "",
          namespace: deployment.metadata?.namespace || "",
          replicas: deployment.spec?.replicas || 0,
          availableReplicas: deployment.status?.availableReplicas || 0,
          createdAt: deployment.metadata?.creationTimestamp,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ deployments }, null, 2),
            },
          ],
        };
      }

      case "list_services": {
        const listServicesInput = input as { namespace?: string };
        const namespace = listServicesInput.namespace || "default";
        const { body } = await k8sManager
          .getCoreApi()
          .listNamespacedService(namespace);

        const services = body.items.map((service) => ({
          name: service.metadata?.name || "",
          namespace: service.metadata?.namespace || "",
          type: service.spec?.type,
          clusterIP: service.spec?.clusterIP,
          ports: service.spec?.ports || [],
          createdAt: service.metadata?.creationTimestamp,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ services }, null, 2),
            },
          ],
        };
      }

      case "list_namespaces": {
        const { body } = await k8sManager.getCoreApi().listNamespace();

        const namespaces = body.items.map((ns) => ({
          name: ns.metadata?.name || "",
          status: ns.status?.phase || "",
          createdAt: ns.metadata?.creationTimestamp,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ namespaces }, null, 2),
            },
          ],
        };
      }

      case "create_pod": {
        const createPodInput = input as {
          name: string;
          namespace: string;
          template: string;
          command?: string[];
        };
        const templateConfig = containerTemplates[createPodInput.template];
        const pod: k8s.V1Pod = {
          apiVersion: "v1",
          kind: "Pod",
          metadata: {
            name: createPodInput.name,
            namespace: createPodInput.namespace,
            labels: {
              "mcp-managed": "true",
              app: createPodInput.name,
            },
          },
          spec: {
            containers: [
              {
                ...templateConfig,
                ...(createPodInput.command && {
                  command: createPodInput.command,
                }),
              },
            ],
          },
        };

        const { body } = await k8sManager
          .getCoreApi()
          .createNamespacedPod(createPodInput.namespace, pod);
        k8sManager.trackResource(
          "Pod",
          createPodInput.name,
          createPodInput.namespace
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  podName: body.metadata!.name!,
                  status: "created",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "delete_pod": {
        const deletePodInput = input as {
          name: string;
          namespace: string;
          ignoreNotFound?: boolean;
        };
        try {
          await k8sManager
            .getCoreApi()
            .deleteNamespacedPod(deletePodInput.name, deletePodInput.namespace);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    status: "deleted",
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error: any) {
          if (
            deletePodInput.ignoreNotFound &&
            error.response?.statusCode === 404
          ) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      status: "not_found",
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }
          throw error;
        }
      }

      case "describe_pod": {
        const describePodInput = input as {
          name: string;
          namespace: string;
        };
        try {
          const { body } = await k8sManager
            .getCoreApi()
            .readNamespacedPod(
              describePodInput.name,
              describePodInput.namespace
            );

          if (!body) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      error: "Pod not found",
                      status: "not_found",
                    },
                    null,
                    2
                  ),
                },
              ],
              isError: true,
            };
          }

          // Format the pod details for better readability
          const podDetails = {
            kind: body.kind,
            metadata: {
              name: body.metadata?.name,
              namespace: body.metadata?.namespace,
              creationTimestamp: body.metadata?.creationTimestamp,
              labels: body.metadata?.labels,
            },
            spec: {
              containers: body.spec?.containers.map((container) => ({
                name: container.name,
                image: container.image,
                ports: container.ports,
                resources: container.resources,
              })),
              nodeName: body.spec?.nodeName,
            },
            status: {
              phase: body.status?.phase,
              conditions: body.status?.conditions,
              containerStatuses: body.status?.containerStatuses,
            },
          };

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(podDetails, null, 2),
              },
            ],
          };
        } catch (error: any) {
          if (error.response?.statusCode === 404) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      error: "Pod not found",
                      status: "not_found",
                    },
                    null,
                    2
                  ),
                },
              ],
              isError: true,
            };
          }
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to describe pod: ${
              error.response?.body?.message || error.message
            }`
          );
        }
      }

      case "cleanup": {
        await k8sManager.cleanup();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "list_nodes": {
        const { body } = await k8sManager.getCoreApi().listNode();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  nodes: body.items,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        throw new McpError(ErrorCode.InvalidRequest, `Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed: ${error}`
    );
  }
});

// Resources handlers
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "k8s://default/pods",
        name: "Kubernetes Pods",
        mimeType: "application/json",
        description: "List of pods in the default namespace",
      },
      {
        uri: "k8s://default/deployments",
        name: "Kubernetes Deployments",
        mimeType: "application/json",
        description: "List of deployments in the default namespace",
      },
      {
        uri: "k8s://default/services",
        name: "Kubernetes Services",
        mimeType: "application/json",
        description: "List of services in the default namespace",
      },
      {
        uri: "k8s://namespaces",
        name: "Kubernetes Namespaces",
        mimeType: "application/json",
        description: "List of all namespaces",
      },
      {
        uri: "k8s://nodes",
        name: "Kubernetes Nodes",
        mimeType: "application/json",
        description: "List of all nodes in the cluster",
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  try {
    const uri = request.params.uri;
    const parts = uri.replace("k8s://", "").split("/");

    const isNamespaces = parts[0] === "namespaces";
    const isNodes = parts[0] === "nodes";
    if ((isNamespaces || isNodes) && parts.length === 1) {
      const fn = isNodes ? "listNode" : "listNamespace";
      const { body } = await k8sManager.getCoreApi()[fn]();
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: "application/json",
            text: JSON.stringify(body.items, null, 2),
          },
        ],
      };
    }

    const [namespace, resourceType] = parts;

    switch (resourceType) {
      case "pods": {
        const { body } = await k8sManager
          .getCoreApi()
          .listNamespacedPod(namespace);
        return {
          contents: [
            {
              uri: request.params.uri,
              mimeType: "application/json",
              text: JSON.stringify(body.items, null, 2),
            },
          ],
        };
      }
      case "deployments": {
        const { body } = await k8sManager
          .getAppsApi()
          .listNamespacedDeployment(namespace);
        return {
          contents: [
            {
              uri: request.params.uri,
              mimeType: "application/json",
              text: JSON.stringify(body.items, null, 2),
            },
          ],
        };
      }
      case "services": {
        const { body } = await k8sManager
          .getCoreApi()
          .listNamespacedService(namespace);
        return {
          contents: [
            {
              uri: request.params.uri,
              mimeType: "application/json",
              text: JSON.stringify(body.items, null, 2),
            },
          ],
        };
      }
      default:
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Unsupported resource type: ${resourceType}`
        );
    }
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to read resource: ${error}`
    );
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);

["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, async () => {
    console.log(`Received ${signal}, shutting down...`);
    await server.close();
    process.exit(0);
  });
});

function isDocker() {
  try {
    statSync("/.dockerenv");
    return true;
  } catch (err) {
    return false;
  }
}

// Heartbeat to keep process running in docker
// Note that this is technically a hack - in docker, if you run via -it /bin/bash, no issue
// Issue is if you run via docker run <imagename>, then the process will exit immediately
isDocker() && setInterval(() => {}, 60000);
