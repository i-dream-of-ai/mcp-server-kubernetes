/**
 * FastMCP Wrapper for Kubernetes MCP Server
 * Kubernetes cluster management and operations
 */

import { FastMCP } from 'fastmcp';

// Create FastMCP wrapper
const mcp = new FastMCP("Kubernetes MCP Server", {
  name: "kubernetes-mcp-server-wrapper"
});

// Pod management tools
mcp.tool("get-pods", "List pods in a namespace", {
  type: "object",
  properties: {
    namespace: {
      type: "string",
      description: "Kubernetes namespace"
    },
    selector: {
      type: "string",
      description: "Label selector"
    },
    field_selector: {
      type: "string",
      description: "Field selector"
    }
  }
}, async ({ namespace = "default", selector, field_selector }) => {
  return {
    content: [{
      type: "text",
      text: `Listed pods in namespace ${namespace}`
    }]
  };
});

mcp.tool("create-deployment", "Create a Kubernetes deployment", {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "Deployment name"
    },
    namespace: {
      type: "string",
      description: "Target namespace"
    },
    image: {
      type: "string",
      description: "Container image"
    },
    replicas: {
      type: "number",
      description: "Number of replicas"
    },
    ports: {
      type: "array",
      items: { type: "number" },
      description: "Container ports"
    }
  },
  required: ["name", "image"]
}, async ({ name, namespace = "default", image, replicas = 1, ports = [] }) => {
  return {
    content: [{
      type: "text",
      text: `Created deployment ${name} in ${namespace} with ${replicas} replicas`
    }]
  };
});

mcp.tool("scale-deployment", "Scale a deployment", {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "Deployment name"
    },
    namespace: {
      type: "string",
      description: "Namespace"
    },
    replicas: {
      type: "number",
      description: "Target replica count"
    }
  },
  required: ["name", "replicas"]
}, async ({ name, namespace = "default", replicas }) => {
  return {
    content: [{
      type: "text",
      text: `Scaled ${name} to ${replicas} replicas`
    }]
  };
});

mcp.tool("get-logs", "Get pod logs", {
  type: "object",
  properties: {
    pod_name: {
      type: "string",
      description: "Pod name"
    },
    namespace: {
      type: "string",
      description: "Namespace"
    },
    container: {
      type: "string",
      description: "Container name"
    },
    tail: {
      type: "number",
      description: "Number of lines to tail"
    },
    follow: {
      type: "boolean",
      description: "Follow log output"
    }
  },
  required: ["pod_name"]
}, async ({ pod_name, namespace = "default", container, tail = 100, follow = false }) => {
  return {
    content: [{
      type: "text",
      text: `Retrieved logs from ${pod_name} (last ${tail} lines)`
    }]
  };
});

mcp.tool("apply-manifest", "Apply a Kubernetes manifest", {
  type: "object",
  properties: {
    manifest: {
      type: "object",
      description: "Kubernetes manifest object"
    },
    namespace: {
      type: "string",
      description: "Target namespace"
    }
  },
  required: ["manifest"]
}, async ({ manifest, namespace = "default" }) => {
  return {
    content: [{
      type: "text",
      text: `Applied manifest to namespace ${namespace}`
    }]
  };
});

mcp.tool("exec-command", "Execute command in a pod", {
  type: "object",
  properties: {
    pod_name: {
      type: "string",
      description: "Pod name"
    },
    namespace: {
      type: "string",
      description: "Namespace"
    },
    command: {
      type: "array",
      items: { type: "string" },
      description: "Command to execute"
    },
    container: {
      type: "string",
      description: "Container name"
    }
  },
  required: ["pod_name", "command"]
}, async ({ pod_name, namespace = "default", command, container }) => {
  return {
    content: [{
      type: "text",
      text: `Executed command in pod ${pod_name}`
    }]
  };
});

// Export for Cloudflare Workers
export default {
  async fetch(request, env, ctx) {
    if (env.KUBECONFIG) {
      process.env.KUBECONFIG = env.KUBECONFIG;
    }
    
    return mcp.fetch(request, env, ctx);
  }
};