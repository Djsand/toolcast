import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { ParsedSpec } from "../parser/types.js";
import { type AuthConfig, applyAuth, resolveAuth } from "./auth.js";
import { type ToolDefinition, buildTools } from "./tool-builder.js";

export interface ServerOptions {
  readonly baseUrl?: string;
  readonly auth?: AuthConfig;
  readonly env?: Record<string, string | undefined>;
}

export function createServer(
  spec: ParsedSpec,
  options: ServerOptions = {},
): { server: Server; tools: readonly ToolDefinition[] } {
  const server = new Server(
    {
      name: `mcpgen-${spec.title.toLowerCase().replace(/\s+/g, "-")}`,
      version: spec.version,
    },
    { capabilities: { tools: {} } },
  );

  const baseUrl = options.baseUrl ?? spec.servers[0]?.url ?? "https://api.example.com";
  const auth = options.auth ?? resolveAuth(spec.securitySchemes, options.env ?? process.env);
  const tools = buildTools(spec.endpoints);

  const toolMap = new Map<string, ToolDefinition>();
  for (const tool of tools) {
    toolMap.set(tool.name, tool);
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as {
        type: "object";
        properties?: Record<string, unknown>;
        required?: string[];
      },
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = toolMap.get(name);

    if (!tool) {
      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    const result = await executeRequest(tool, args ?? {}, baseUrl, auth);
    return {
      content: [{ type: "text" as const, text: result }],
    };
  });

  return { server, tools };
}

async function executeRequest(
  tool: ToolDefinition,
  params: Record<string, unknown>,
  baseUrl: string,
  auth: AuthConfig,
): Promise<string> {
  const { endpoint } = tool;

  let url = `${baseUrl.replace(/\/$/, "")}${endpoint.path}`;
  for (const param of endpoint.parameters.filter((p) => p.in === "path")) {
    const value = params[param.name];
    if (value !== undefined) {
      url = url.replace(`{${param.name}}`, encodeURIComponent(String(value)));
    }
  }

  const queryParams = endpoint.parameters
    .filter((p) => p.in === "query")
    .reduce<Record<string, string>>((acc, p) => {
      const value = params[p.name];
      if (value !== undefined) acc[p.name] = String(value);
      return acc;
    }, {});

  if (Object.keys(queryParams).length > 0) {
    const qs = new URLSearchParams(queryParams).toString();
    url = `${url}?${qs}`;
  }

  let headers: Record<string, string> = {
    "Accept": "application/json",
    "User-Agent": "mcpgen/0.1.0",
  };

  for (const param of endpoint.parameters.filter((p) => p.in === "header")) {
    const value = params[param.name];
    if (value !== undefined) headers[param.name] = String(value);
  }

  headers = applyAuth(headers, auth);

  let body: string | undefined;
  if (endpoint.requestBody) {
    const bodyData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (key.startsWith("body_")) {
        bodyData[key.slice(5)] = value;
      } else if (key === "body") {
        Object.assign(bodyData, typeof value === "string" ? JSON.parse(value) : value);
      }
    }
    if (Object.keys(bodyData).length > 0) {
      headers["Content-Type"] = endpoint.requestBody.contentType;
      body = JSON.stringify(bodyData);
    }
  }

  const response = await fetch(url, {
    method: endpoint.method,
    headers,
    body,
  });

  const responseText = await response.text();

  if (!response.ok) {
    return JSON.stringify({
      error: true,
      status: response.status,
      statusText: response.statusText,
      body: tryParseJson(responseText),
    }, null, 2);
  }

  const parsed = tryParseJson(responseText);
  return typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2);
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function startServer(spec: ParsedSpec, options: ServerOptions = {}): Promise<void> {
  const { server } = createServer(spec, options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
