import { z } from "zod";

// Common response structure for tool operations
const ToolResponseContent = z.object({
  type: z.literal("text"),
  text: z.string(),
});

export const CreateNamespaceResponseSchema = z.object({
  content: z.array(ToolResponseContent),
});

export const CreatePodResponseSchema = z.object({
  content: z.array(ToolResponseContent),
});

export const CreateDeploymentResponseSchema = z.object({
  content: z.array(ToolResponseContent),
});

export const DeletePodResponseSchema = z.object({
  content: z.array(ToolResponseContent),
});

export const CleanupResponseSchema = z.object({
  content: z.array(ToolResponseContent),
});

export const ListPodsResponseSchema = z.object({
  content: z.array(ToolResponseContent),
});

export const ListDeploymentsResponseSchema = z.object({
  content: z.array(ToolResponseContent),
});

export const ListServicesResponseSchema = z.object({
  content: z.array(ToolResponseContent),
});

export const ListNamespacesResponseSchema = z.object({
  content: z.array(ToolResponseContent),
});

export const ListNodesResponseSchema = z.object({
  content: z.array(ToolResponseContent),
});

export const GetLogsResponseSchema = z.object({
  content: z.array(ToolResponseContent),
});

export const GetEventsResponseSchema = z.object({
  content: z.array(ToolResponseContent),
});
