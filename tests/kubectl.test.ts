import { expect, test, describe, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { KubectlResponseSchema } from "../src/models/kubectl-models.js";
import * as fs from "fs";

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("kubectl operations", () => {
  let transport: StdioClientTransport;
  let client: Client;

  beforeEach(async () => {
    try {
      transport = new StdioClientTransport({
        command: "bun",
        args: ["src/index.ts"],
        stderr: "pipe",
      });

      client = new Client(
        {
          name: "test-client",
          version: "1.0.0",
        },
        {
          capabilities: {},
        }
      );
      await client.connect(transport);
      await sleep(1000);
    } catch (e) {
      console.error("Error in beforeEach:", e);
      throw e;
    }
  });

  afterEach(async () => {
    try {
      await transport.close();
      await sleep(1000);
    } catch (e) {
      console.error("Error during cleanup:", e);
    }
  });

  test("explain resource", async () => {
    const result = await client.request(
      {
        method: "tools/call",
        params: {
          name: "explain_resource",
          arguments: {
            resource: "pods",
            recursive: true,
          },
        },
      },
      KubectlResponseSchema
    );

    expect(result.content[0].type).toBe("text");
    const text = result.content[0].text;
    expect(text).toContain("KIND:       Pod");
    expect(text).toContain("VERSION:    v1");
    expect(text).toContain("DESCRIPTION:");
    expect(text).toContain("FIELDS:");
  });

  test("explain resource with api version", async () => {
    const result = await client.request(
      {
        method: "tools/call",
        params: {
          name: "explain_resource",
          arguments: {
            resource: "deployments",
            apiVersion: "apps/v1",
            recursive: true,
          },
        },
      },
      KubectlResponseSchema
    );

    expect(result.content[0].type).toBe("text");
    const text = result.content[0].text;
    expect(text).toContain("KIND:       Deployment");
    expect(text).toContain("VERSION:    v1");
    expect(text).toContain("DESCRIPTION:");
    expect(text).toContain("FIELDS:");
  });

  test("list api resources", async () => {
    const result = await client.request(
      {
        method: "tools/call",
        params: {
          name: "list_api_resources",
          arguments: {
            output: "wide",
          },
        },
      },
      KubectlResponseSchema
    );

    expect(result.content[0].type).toBe("text");
    const text = result.content[0].text;
    expect(text).toContain("NAME");
    expect(text).toContain("SHORTNAMES");
    expect(text).toContain("APIVERSION");
    expect(text).toContain("NAMESPACED");
    expect(text).toContain("KIND");
  });

  test("list api resources with filters", async () => {
    const result = await client.request(
      {
        method: "tools/call",
        params: {
          name: "list_api_resources",
          arguments: {
            apiGroup: "apps",
            namespaced: true,
            verbs: ["get", "list"],
            output: "name",
          },
        },
      },
      KubectlResponseSchema
    );

    expect(result.content[0].type).toBe("text");
    const text = result.content[0].text;
    expect(text).toContain("deployments");
    expect(text).toContain("statefulsets");
    expect(text).toContain("daemonsets");
  });
});
