import { z } from "zod";

// Kubernetes-specific types
export const ContainerTemplate = z.enum([
  "ubuntu",
  "nginx",
  "busybox",
  "alpine",
]);

// Resource response schemas
export const ResourceSchema = z.object({
  uri: z.string(),
  name: z.string(),
  description: z.string(),
});

// Tool response schemas
export const ToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: z.record(z.any()),
});

export const ListToolsResponseSchema = z.object({
  tools: z.array(ToolSchema),
});

// Tool-specific response schemas
export const CreatePodResponseSchema = z.object({
  content: z.array(
    z.object({
      type: z.literal("text"),
      text: z.string(),
    })
  ),
});

export const CreateDeploymentResponseSchema = z.object({
  content: z.array(
    z.object({
      type: z.literal("text"),
      text: z.string(),
    })
  ),
});

export const DeletePodResponseSchema = z.object({
  content: z.array(
    z.object({
      type: z.literal("text"),
      text: z.string(),
    })
  ),
});

export const CleanupResponseSchema = z.object({
  content: z.array(
    z.object({
      type: z.literal("text"),
      text: z.string(),
    })
  ),
});

export const ListPodsResponseSchema = z.object({
  content: z.array(
    z.object({
      type: z.literal("text"),
      text: z.string(),
    })
  ),
});

export const ListDeploymentsResponseSchema = z.object({
  content: z.array(
    z.object({
      type: z.literal("text"),
      text: z.string(),
    })
  ),
});

export const ListServicesResponseSchema = z.object({
  content: z.array(
    z.object({
      type: z.literal("text"),
      text: z.string(),
    })
  ),
});

export const ListNamespacesResponseSchema = z.object({
  content: z.array(
    z.object({
      type: z.literal("text"),
      text: z.string(),
    })
  ),
});

export const ListNodesResponseSchema = z.object({
  content: z.array(
    z.object({
      type: z.literal("text"),
      text: z.string(),
    })
  ),
});

export const GetLogsResponseSchema = z.object({
  content: z.array(
    z.object({
      type: z.literal("text"),
      text: z.string(),
    })
  ),
});

export const ListResourcesResponseSchema = z.object({
  resources: z.array(ResourceSchema),
});

export const ReadResourceResponseSchema = z.object({
  contents: z.array(
    z.object({
      uri: z.string(),
      mimeType: z.string(),
      text: z.string(),
    })
  ),
});

// Keep existing interface definitions
export type K8sResource = z.infer<typeof ResourceSchema>;
export type K8sTool = z.infer<typeof ToolSchema>;

// Resource tracking interfaces
export interface ResourceTracker {
  kind: string;
  name: string;
  namespace: string;
  createdAt: Date;
}

export interface PortForwardTracker {
  id: string;
  server: { stop: () => Promise<void> };
  resourceType: string;
  name: string;
  namespace: string;
  ports: { local: number; remote: number }[];
}

export interface WatchTracker {
  id: string;
  abort: AbortController;
  resourceType: string;
  namespace: string;
}

// Helm-related types
export const HelmInstallRequestSchema = z.object({
  name: z.string(),
  chart: z.string(),
  namespace: z.string().optional(),
  values: z.record(z.any()).optional(),
  version: z.string().optional(),
  repo: z.string().optional(),
});

export const HelmUninstallRequestSchema = z.object({
  name: z.string(),
  namespace: z.string().optional(),
});

export const HelmUpgradeRequestSchema = z.object({
  name: z.string(),
  chart: z.string(),
  repo: z.string().optional(),
  values: z.record(z.any()),
  namespace: z.string().optional(),
});

export const HelmResponseSchema = z.object({
  content: z.array(
    z.object({
      type: z.literal("text"),
      text: z.string(),
    })
  ),
});

export type HelmInstallRequest = z.infer<typeof HelmInstallRequestSchema>;
export type HelmUninstallRequest = z.infer<typeof HelmUninstallRequestSchema>;
export type HelmUpgradeRequest = z.infer<typeof HelmUpgradeRequestSchema>;
export type HelmResponse = z.infer<typeof HelmResponseSchema>;
