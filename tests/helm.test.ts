import { expect, test, describe, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { HelmResponseSchema } from "../src/models/helm-models.js";
import * as fs from "fs";

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper function to wait for cluster readiness
async function waitForClusterReadiness(
  client: Client,
  namespace: string
): Promise<void> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    try {
      await client.request(
        {
          method: "tools/call",
          params: {
            name: "list_services",
            arguments: {
              namespace: namespace,
            },
          },
        },
        HelmResponseSchema
      );
      return;
    } catch (e) {
      attempts++;
      if (attempts === maxAttempts) {
        throw new Error("Cluster not ready after maximum attempts");
      }
      await sleep(2000);
    }
  }
}

describe("helm operations", () => {
  let transport: StdioClientTransport;
  let client: Client;
  const testReleaseName = "test-nginx";
  const testNamespace = "default";

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
      // Cleanup: Uninstall the test release if it exists
      await client
        .request(
          {
            method: "tools/call",
            params: {
              name: "uninstall_helm_chart",
              arguments: {
                name: testReleaseName,
                namespace: testNamespace,
              },
            },
          },
          HelmResponseSchema
        )
        .catch(() => {}); // Ignore errors if release doesn't exist

      await transport.close();
      await sleep(1000);

      // Cleanup generated values files
      if (fs.existsSync("test-nginx-values.yaml")) {
        fs.unlinkSync("test-nginx-values.yaml");
      }
    } catch (e) {
      console.error("Error during cleanup:", e);
    }
  });

  test("install helm chart", async () => {
    const installResult = await client.request(
      {
        method: "tools/call",
        params: {
          name: "install_helm_chart",
          arguments: {
            name: testReleaseName,
            chart: "bitnami/nginx",
            repo: "https://charts.bitnami.com/bitnami",
            namespace: testNamespace,
            values: {
              service: {
                type: "ClusterIP",
              },
              resources: {
                limits: {
                  cpu: "100m",
                  memory: "128Mi",
                },
                requests: {
                  cpu: "50m",
                  memory: "64Mi",
                },
              },
            },
          },
        },
      },
      HelmResponseSchema
    );

    expect(installResult.content[0].type).toBe("text");
    const result = JSON.parse(installResult.content[0].text);
    expect(result.status).toBe("installed");

    // Wait for the deployment to be ready
    await sleep(5000);

    // Verify the deployment exists
    const deploymentResult = await client.request(
      {
        method: "tools/call",
        params: {
          name: "list_deployments",
          arguments: {
            namespace: testNamespace,
          },
        },
      },
      HelmResponseSchema
    );

    const deployments = JSON.parse(deploymentResult.content[0].text);
    expect(
      deployments.deployments.some((d: any) =>
        d.name.startsWith(testReleaseName)
      )
    ).toBe(true);
  }, 30000); // Increase timeout to 30s for chart installation

  test("upgrade helm chart values", async () => {
    // Ensure cluster is ready before starting
    await waitForClusterReadiness(client, testNamespace);

    // First install the chart
    const installResult = await client.request(
      {
        method: "tools/call",
        params: {
          name: "install_helm_chart",
          arguments: {
            name: testReleaseName,
            chart: "bitnami/nginx",
            repo: "https://charts.bitnami.com/bitnami",
            namespace: testNamespace,
            values: {
              service: {
                type: "ClusterIP",
              },
              resources: {
                limits: {
                  cpu: "100m",
                  memory: "128Mi",
                },
                requests: {
                  cpu: "50m",
                  memory: "64Mi",
                },
              },
            },
          },
        },
      },
      HelmResponseSchema
    );

    expect(installResult.content[0].type).toBe("text");
    const installResponse = JSON.parse(installResult.content[0].text);
    expect(installResponse.status).toBe("installed");

    // Wait for initial deployment to be ready
    await sleep(10000);

    // Verify initial deployment
    const initialDeploymentResult = await client.request(
      {
        method: "tools/call",
        params: {
          name: "list_deployments",
          arguments: {
            namespace: testNamespace,
          },
        },
      },
      HelmResponseSchema
    );

    const initialDeployments = JSON.parse(
      initialDeploymentResult.content[0].text
    );
    expect(
      initialDeployments.deployments.some((d: any) =>
        d.name.startsWith(testReleaseName)
      )
    ).toBe(true);

    // Ensure cluster is ready before upgrade
    await waitForClusterReadiness(client, testNamespace);

    // Then upgrade it with new values
    const upgradeResult = await client.request(
      {
        method: "tools/call",
        params: {
          name: "upgrade_helm_chart",
          arguments: {
            name: testReleaseName,
            chart: "bitnami/nginx",
            repo: "https://charts.bitnami.com/bitnami",
            namespace: testNamespace,
            values: {
              replicaCount: 2,
              service: {
                type: "ClusterIP",
              },
            },
          },
        },
      },
      HelmResponseSchema
    );

    expect(upgradeResult.content[0].type).toBe("text");
    const result = JSON.parse(upgradeResult.content[0].text);
    expect(result.status).toBe("upgraded");

    // Wait longer for the upgrade to take effect
    await sleep(5000);

    // Verify the deployment was updated
    const deploymentResult = await client.request(
      {
        method: "tools/call",
        params: {
          name: "list_deployments",
          arguments: {
            namespace: testNamespace,
          },
        },
      },
      HelmResponseSchema
    );

    const deployments = JSON.parse(deploymentResult.content[0].text);
    const nginxDeployment = deployments.deployments.find((d: any) =>
      d.name.startsWith(testReleaseName)
    );

    expect(nginxDeployment).toBeDefined();
    expect(nginxDeployment.replicas).toBe(2);
  }, 90000); // Increase timeout to 90s for the entire test

  test("uninstall helm chart", async () => {
    // First install the chart
    await client.request(
      {
        method: "tools/call",
        params: {
          name: "install_helm_chart",
          arguments: {
            name: testReleaseName,
            chart: "bitnami/nginx",
            repo: "https://charts.bitnami.com/bitnami",
            namespace: testNamespace,
            values: {
              service: {
                type: "ClusterIP",
              },
              resources: {
                limits: {
                  cpu: "100m",
                  memory: "128Mi",
                },
                requests: {
                  cpu: "50m",
                  memory: "64Mi",
                },
              },
            },
          },
        },
      },
      HelmResponseSchema
    );

    await sleep(5000);

    // Then uninstall it
    const uninstallResult = await client.request(
      {
        method: "tools/call",
        params: {
          name: "uninstall_helm_chart",
          arguments: {
            name: testReleaseName,
            namespace: testNamespace,
          },
        },
      },
      HelmResponseSchema
    );

    expect(uninstallResult.content[0].type).toBe("text");
    const result = JSON.parse(uninstallResult.content[0].text);
    expect(result.status).toBe("uninstalled");

    // Wait for resources to be cleaned up
    await sleep(5000);

    // Verify the deployment is gone
    const deploymentResult = await client.request(
      {
        method: "tools/call",
        params: {
          name: "list_deployments",
          arguments: {
            namespace: testNamespace,
          },
        },
      },
      HelmResponseSchema
    );

    const deployments = JSON.parse(deploymentResult.content[0].text);
    expect(
      deployments.deployments.every(
        (d: any) => !d.name.startsWith(testReleaseName)
      )
    ).toBe(true);
  }, 60000); // Increase timeout to 60s for install + uninstall
});
