import type { ParsedEndpoint } from "../parser/types.js";

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  readonly endpoint: ParsedEndpoint;
}

export function buildTools(endpoints: readonly ParsedEndpoint[]): readonly ToolDefinition[] {
  return endpoints.map(buildTool);
}

function buildTool(endpoint: ParsedEndpoint): ToolDefinition {
  const name = sanitizeToolName(endpoint.operationId);
  const description = buildDescription(endpoint);
  const inputSchema = buildInputSchema(endpoint);

  return { name, description, inputSchema, endpoint };
}

function sanitizeToolName(operationId: string): string {
  return operationId
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 64);
}

function buildDescription(endpoint: ParsedEndpoint): string {
  const parts: string[] = [];

  if (endpoint.summary) {
    parts.push(endpoint.summary);
  }

  if (endpoint.description && endpoint.description !== endpoint.summary) {
    parts.push(endpoint.description);
  }

  parts.push(`[${endpoint.method} ${endpoint.path}]`);

  return parts.join("\n\n").slice(0, 1024);
}

function buildInputSchema(endpoint: ParsedEndpoint): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const param of endpoint.parameters) {
    properties[param.name] = {
      ...param.schema,
      description: param.description || `${param.in} parameter: ${param.name}`,
    };
    if (param.required) {
      required.push(param.name);
    }
  }

  if (endpoint.requestBody?.schema) {
    const bodySchema = endpoint.requestBody.schema;

    if (bodySchema.properties && typeof bodySchema.properties === "object") {
      const bodyProps = bodySchema.properties as Record<string, unknown>;
      for (const [key, value] of Object.entries(bodyProps)) {
        properties[`body_${key}`] = value;
      }
      if (Array.isArray(bodySchema.required)) {
        for (const req of bodySchema.required as string[]) {
          if (endpoint.requestBody.required) {
            required.push(`body_${req}`);
          }
        }
      }
    } else {
      properties.body = {
        ...bodySchema,
        description: endpoint.requestBody.description || "Request body",
      };
      if (endpoint.requestBody.required) {
        required.push("body");
      }
    }
  }

  return {
    type: "object" as const,
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}
