import { expect, test } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  ListToolsResponseSchema,
  ListPodsResponseSchema,
  ListDeploymentsResponseSchema,
  ListNamespacesResponseSchema,
  CreatePodResponseSchema,
  DeletePodResponseSchema,
  CleanupResponseSchema,
} from "./types.js";

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("kubernetes server operations", async () => {
  const transport = new StdioClientTransport({
    command: "bun",
    args: ["src/index.ts"],
    stderr: "pipe",
  });

  const client = new Client(
    {
      name: "test-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );
  await client.connect(transport);

  try {
    // List available tools stays the same
    console.log("Listing available tools...");
    const toolsList = await client.request(
      {
        method: "tools/list",
      },
      ListToolsResponseSchema
    );
    expect(toolsList.tools).toBeDefined();
    expect(toolsList.tools.length).toBeGreaterThan(0);

    // List namespaces
    console.log("Listing namespaces...");
    const namespacesResult = await client.request(
      {
        method: "tools/call",
        params: {
          name: "list_namespaces",
          arguments: {}, // Changed from input to arguments
        },
      },
      ListNamespacesResponseSchema
    );
    expect(namespacesResult.content[0].type).toBe("text");
    const namespaces = JSON.parse(namespacesResult.content[0].text);
    expect(namespaces.namespaces).toBeDefined();

    // Delete test pod if it exists
    console.log("Deleting test pod if exists...");
    const deletePodResult = await client.request(
      {
        method: "tools/call",
        params: {
          name: "delete_pod",
          arguments: {
            // Changed from input to arguments
            name: "test-pod",
            namespace: "default",
            ignoreNotFound: true,
          },
        },
      },
      DeletePodResponseSchema
    );
    expect(deletePodResult.content[0].type).toBe("text");
    const deleteResult = JSON.parse(deletePodResult.content[0].text);
    expect(deleteResult.success).toBe(true);
    await sleep(2000);

    // Create a pod
    console.log("Creating test pod...");
    const createPodResult = await client.request(
      {
        method: "tools/call",
        params: {
          name: "create_pod",
          arguments: {
            // Changed from input to arguments
            name: "test-pod",
            namespace: "default",
            template: "nginx",
          },
        },
      },
      CreatePodResponseSchema
    );
    expect(createPodResult.content[0].type).toBe("text");
    const createResult = JSON.parse(createPodResult.content[0].text);
    expect(createResult.podName).toBe("test-pod");
    expect(createResult.status).toBe("created");

    // List pods to verify creation
    console.log("Listing pods...");
    const listPodsResult = await client.request(
      {
        method: "tools/call",
        params: {
          name: "list_pods",
          arguments: {
            // Changed from input to arguments
            namespace: "default",
          },
        },
      },
      ListPodsResponseSchema
    );
    expect(listPodsResult.content[0].type).toBe("text");
    const pods = JSON.parse(listPodsResult.content[0].text);
    expect(pods.pods).toBeDefined();
    expect(pods.pods.some((pod: any) => pod.name === "test-pod")).toBe(true);

    // List deployments
    console.log("Listing deployments...");
    const listDeploymentsResult = await client.request(
      {
        method: "tools/call",
        params: {
          name: "list_deployments",
          arguments: {
            // Changed from input to arguments
            namespace: "default",
          },
        },
      },
      ListDeploymentsResponseSchema
    );
    expect(listDeploymentsResult.content[0].type).toBe("text");
    const deployments = JSON.parse(listDeploymentsResult.content[0].text);
    expect(deployments.deployments).toBeDefined();

    // Cleanup
    console.log("Cleaning up...");
    const cleanupResult = await client.request(
      {
        method: "tools/call",
        params: {
          name: "cleanup",
          arguments: {}, // Changed from input to arguments
        },
      },
      CleanupResponseSchema
    );
    expect(cleanupResult.content[0].type).toBe("text");
    const cleanupData = JSON.parse(cleanupResult.content[0].text);
    expect(cleanupData.success).toBe(true);

    // Verify cleanup by listing pods again
    console.log("Verifying cleanup...");
    const finalPodsResult = await client.request(
      {
        method: "tools/call",
        params: {
          name: "list_pods",
          arguments: {
            // Changed from input to arguments
            namespace: "default",
          },
        },
      },
      ListPodsResponseSchema
    );
    const finalPods = JSON.parse(finalPodsResult.content[0].text);
    console.log(finalPods);
    // expect(finalPods.pods.some((pod: any) => pod.name === "test-pod")).toBe(
    //   false
    // );
  } finally {
    // await client.disconnect();  // Re-enabled client disconnect
  }
});
