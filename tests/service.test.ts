// This test file is used to test Kubernetes Service functionalities
import { expect, test, describe, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CreateNamespaceResponseSchema } from "../src/types";
import { KubernetesManager } from "../src/types";
import { z } from "zod";

// Define the schema for the Service response
const ServiceResponseSchema = z.any();

// Interface for service response type
interface ServiceResponse {
  serviceName: string;
  namespace: string;
  type: string;
  clusterIP: string;
  ports: Array<{
    port: number;
    targetPort: number | string;
    protocol: string;
    name: string;
    nodePort?: number;
  }>;
  status: string;
}

// Utility function: Sleep for a specified number of milliseconds
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Utility function: Generate a random ID string
function generateRandomId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// Utility function: Generate a random SHA string for resource naming in tests
function generateRandomSHA(): string {
  return Math.random().toString(36).substring(2, 15);
}

// Utility function: Parse JSON response
function parseServiceResponse(responseText: string): ServiceResponse | null {
  try {
    return JSON.parse(responseText);
  } catch (error) {
    console.error("Failed to parse service response:", error);
    return null;
  }
}

// Test suite: Testing Service functionality
describe("test kubernetes service", () => {
  let transport: StdioClientTransport;
  let client: Client;
  const NAMESPACE_PREFIX = "test-service";
  let testNamespace: string;

  const testServiceName = `test-service-${generateRandomSHA()}`;

  // Setup before each test
  beforeEach(async () => {
    try {
      // Initialize client transport layer, communicating with the service process via stdio
      transport = new StdioClientTransport({
        command: "bun",
        args: ["src/index.ts"],
        stderr: "pipe",
      });

      // Create an instance of the MCP client
      client = new Client(
        {
          name: "test-client",
          version: "1.0.0",
        },
        {
          capabilities: {},
        }
      );

      // Connect to the service
      await client.connect(transport);
      // Wait for the connection to be established
      await sleep(1000);

      // Create a unique test namespace to isolate the test environment
      testNamespace = `${NAMESPACE_PREFIX}-${generateRandomId()}`;
      console.log(`Creating test namespace: ${testNamespace}`);

      // Call API to create the namespace
      await client.request<any>(
        {
          method: "tools/call",
          params: {
            name: "create_namespace",
            arguments: {
              name: testNamespace,
            },
          },
        },
        CreateNamespaceResponseSchema,
      );

      // Wait for the namespace to be fully created
      await sleep(2000);
    } catch (error: any) {
      console.error("Error in beforeEach:", error);
      throw error;
    }
  });

  // Cleanup after each test
  afterEach(async () => {
    try {
      // Clean up the test namespace by directly calling the API
      console.log(`Cleaning up test namespace: ${testNamespace}`);
      const k8sManager = new KubernetesManager();

      // @ts-ignore
      await k8sManager.getCoreApi().deleteNamespace(testNamespace);

      // Close the client connection
      await transport.close();
      await sleep(1000);
    } catch (e) {
      console.error("Error during cleanup:", e);
    }
  });

  // Test case: Verify creation of ClusterIP service
  test("verify creation of ClusterIP service", async () => {
    // Define test port configuration
    const testPorts = [
      {
        port: 80,
        targetPort: 8080,
        protocol: "TCP",
        name: "http"
      }
    ];

    // Define test selector
    const testSelector = {
      app: "test-app",
      tier: "backend"
    };

    // Send request to create the service
    const serviceResponse = await client.request<any>(
      {
        method: "tools/call",
        params: {
          name: "create_service",
          arguments: {
            name: testServiceName,
            namespace: testNamespace,
            type: "ClusterIP",
            selector: testSelector,
            ports: testPorts,
          },
        },
      },
      ServiceResponseSchema,
    );

    // Wait for the request to be processed
    await sleep(2000);

    // Parse the service response
    const responseText = serviceResponse.content[0].text;
    const parsedResponse = parseServiceResponse(responseText);

    console.log("Service creation response:", parsedResponse);

    // Verify that the response contains the expected data
    expect(parsedResponse).not.toBeNull();
    expect(parsedResponse?.serviceName).toBe(testServiceName);
    expect(parsedResponse?.namespace).toBe(testNamespace);
    expect(parsedResponse?.type).toBe("ClusterIP");
    expect(parsedResponse?.status).toBe("created");

    // Verify port configuration
    expect(parsedResponse?.ports).toHaveLength(1);
    expect(parsedResponse?.ports[0].port).toBe(80);
    expect(parsedResponse?.ports[0].targetPort).toBe(8080);
  });

  // Test case: Verify creation of NodePort service
  test("verify creation of NodePort service", async () => {
    // Define test port configuration that includes nodePort
    const testPorts = [
      {
        port: 80,
        targetPort: 8080,
        protocol: "TCP",
        name: "http",
        nodePort: 30080
      }
    ];

    // Send request to create a NodePort service
    const serviceResponse = await client.request<any>(
      {
        method: "tools/call",
        params: {
          name: "create_service",
          arguments: {
            name: `${testServiceName}-nodeport`,
            namespace: testNamespace,
            type: "NodePort",
            ports: testPorts,
          },
        },
      },
      ServiceResponseSchema,
    );

    // Wait for the request to be processed
    await sleep(2000);

    // Parse the service response
    const responseText = serviceResponse.content[0].text;
    const parsedResponse = parseServiceResponse(responseText);

    console.log("NodePort service creation response:", parsedResponse);

    // Verify that the response contains the expected data
    expect(parsedResponse).not.toBeNull();
    expect(parsedResponse?.type).toBe("NodePort");
    expect(parsedResponse?.status).toBe("created");

    // Verify port configuration, including NodePort
    expect(parsedResponse?.ports).toHaveLength(1);
    expect(parsedResponse?.ports[0].nodePort).toBeDefined();
    expect(parsedResponse?.ports[0].port).toBe(80);
  });
});