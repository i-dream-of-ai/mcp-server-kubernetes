import { expect, test, describe, beforeAll, afterAll } from "vitest";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { startStreamableHTTPServer } from "../src/utils/streamable-http.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import net from "net";
import http from "http";
import { pingSchema } from "../src/tools/ping.js";

// Simple type guard for ListToolsResponse
function isListToolsResponse(data: any): boolean {
  return (
    data &&
    data.jsonrpc === "2.0" &&
    data.result &&
    Array.isArray(data.result.tools)
  );
}

// Helper function to find an available port
async function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => {
      findAvailablePort(startPort + 1)
        .then(resolve)
        .catch(reject);
    });
    server.listen(startPort, () => {
      const port = (server.address() as net.AddressInfo)?.port;
      server.close(() => {
        resolve(port);
      });
    });
  });
}

describe("Streamable HTTP Server", () => {
  let server: Server;
  let httpServer: http.Server;
  let port: number;
  let url: string;

  beforeAll(async () => {
    port = await findAvailablePort(3001);
    url = `http://localhost:${port}/mcp`;

    // Create a server and register a handler for list_tools
    server = new Server(
      { name: "test-stream-server", version: "1.0.0" },
      { capabilities: { tools: {} } } // Enable the tools capability
    );
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [pingSchema], // Return a simple tool schema
      };
    });

    process.env.PORT = port.toString();
    httpServer = startStreamableHTTPServer(server);
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });

  test("should handle a full MCP session lifecycle", async () => {
    try {
      // 1. Initialize session
      const initResponse = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "example-client",
              version: "1.0.0",
            },
          },
          id: 1,
        }),
      });
      console.log(
        "Initialization response:",
        initResponse.status,
        initResponse.statusText
      );
      expect(initResponse.status).toBe(200);
      const sessionId = initResponse.headers.get("mcp-session-id");
      expect(sessionId).toBeTypeOf("string");

      // 2. Send a request and verify the response on the same channel
      const listToolsRequest = {
        jsonrpc: "2.0" as const,
        method: "tools/list" as const,
        params: {},
        id: 2,
      };
      const postResponse = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-session-id": sessionId!,
        },
        body: JSON.stringify(listToolsRequest),
      });
      expect(postResponse.status).toBe(200);

      // The response is expected directly on the POST request for this transport implementation
      const postResponseText = await postResponse.text();
      const messageLine = postResponseText
        .split("\n")
        .find((line) => line.startsWith("data:"));

      expect(messageLine).toBeDefined();
      const postResponseJson = JSON.parse(messageLine!.replace(/^data: /, ""));
      expect(isListToolsResponse(postResponseJson)).toBe(true);
      expect(postResponseJson.result.tools[0].name).toBe("ping");

      // 3. Terminate session
      const deleteResponse = await fetch(url, {
        method: "DELETE",
        headers: {
          "mcp-session-id": sessionId!,
          accept: "application/json, text/event-stream",
        },
      });
      expect(deleteResponse.status).toBe(200);
    } finally {
      // No controller to abort here, timeout handles it
    }
  });
});
