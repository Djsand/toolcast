import { readFile } from "node:fs/promises";
import type {
  ParsedEndpoint,
  ParsedParameter,
  ParsedRequestBody,
  ParsedResponse,
  ParsedSecurityScheme,
  ParsedServer,
  ParsedSpec,
} from "./types.js";

type OpenAPISpec = Record<string, unknown>;
type SchemaObject = Record<string, unknown>;

export async function parseSpec(source: string): Promise<ParsedSpec> {
  const raw = await loadSpec(source);
  return extractSpec(raw);
}

async function loadSpec(source: string): Promise<OpenAPISpec> {
  const text = await (source.startsWith("http://") || source.startsWith("https://")
    ? fetchSpec(source)
    : readFile(source, "utf-8"));

  if (source.endsWith(".yaml") || source.endsWith(".yml") || text.trimStart().startsWith("{") === false) {
    const { parse } = await import("yaml");
    return parse(text) as OpenAPISpec;
  }
  return JSON.parse(text) as OpenAPISpec;
}

async function fetchSpec(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch spec from ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function extractSpec(raw: OpenAPISpec): ParsedSpec {
  const info = (raw.info ?? {}) as Record<string, unknown>;
  const servers = extractServers(raw);
  const securitySchemes = extractSecuritySchemes(raw);
  const endpoints = extractEndpoints(raw);

  return {
    title: String(info.title ?? "API"),
    version: String(info.version ?? "1.0.0"),
    description: String(info.description ?? ""),
    servers,
    endpoints,
    securitySchemes,
  };
}

function extractServers(raw: OpenAPISpec): readonly ParsedServer[] {
  const servers = raw.servers as Array<Record<string, unknown>> | undefined;
  if (!servers?.length) return [{ url: "https://api.example.com", description: "Default" }];
  return servers.map((s) => ({
    url: String(s.url ?? ""),
    description: String(s.description ?? ""),
  }));
}

function extractSecuritySchemes(raw: OpenAPISpec): readonly ParsedSecurityScheme[] {
  const components = (raw.components ?? {}) as Record<string, unknown>;
  const schemes = (components.securitySchemes ?? {}) as Record<string, Record<string, unknown>>;

  return Object.entries(schemes).map(([name, scheme]) => ({
    name,
    type: scheme.type as ParsedSecurityScheme["type"],
    in: scheme.in as ParsedSecurityScheme["in"],
    scheme: scheme.scheme as string | undefined,
    bearerFormat: scheme.bearerFormat as string | undefined,
    description: String(scheme.description ?? ""),
  }));
}

function extractEndpoints(raw: OpenAPISpec): readonly ParsedEndpoint[] {
  const paths = (raw.paths ?? {}) as Record<string, Record<string, unknown>>;
  const endpoints: ParsedEndpoint[] = [];

  for (const [path, pathItem] of Object.entries(paths)) {
    const pathParams = (pathItem.parameters ?? []) as Array<Record<string, unknown>>;

    for (const method of ["get", "post", "put", "patch", "delete", "head", "options"]) {
      const operation = pathItem[method] as Record<string, unknown> | undefined;
      if (!operation) continue;

      const resolvedParams = resolveParams(raw, [
        ...pathParams,
        ...((operation.parameters ?? []) as Array<Record<string, unknown>>),
      ]);

      endpoints.push({
        operationId: String(operation.operationId ?? generateOperationId(method, path)),
        method: method.toUpperCase(),
        path,
        summary: String(operation.summary ?? ""),
        description: String(operation.description ?? operation.summary ?? ""),
        tags: ((operation.tags ?? []) as string[]),
        parameters: resolvedParams,
        requestBody: extractRequestBody(raw, operation.requestBody as Record<string, unknown> | undefined),
        responses: extractResponses(operation.responses as Record<string, Record<string, unknown>> | undefined),
        security: (operation.security ?? raw.security ?? []) as Record<string, string[]>[],
      });
    }
  }

  return endpoints;
}

function resolveRef(root: OpenAPISpec, obj: Record<string, unknown>): Record<string, unknown> {
  const ref = obj.$ref as string | undefined;
  if (!ref) return obj;

  const parts = ref.replace("#/", "").split("/");
  let current: unknown = root;
  for (const part of parts) {
    current = (current as Record<string, unknown>)[part];
  }
  return (current ?? obj) as Record<string, unknown>;
}

function resolveParams(root: OpenAPISpec, params: Array<Record<string, unknown>>): readonly ParsedParameter[] {
  return params.map((p) => {
    const resolved = resolveRef(root, p);
    return {
      name: String(resolved.name ?? ""),
      in: resolved.in as ParsedParameter["in"],
      description: String(resolved.description ?? ""),
      required: Boolean(resolved.required ?? resolved.in === "path"),
      schema: resolveSchemaDeep(root, (resolved.schema ?? { type: "string" }) as SchemaObject),
    };
  });
}

function resolveSchemaDeep(root: OpenAPISpec, schema: SchemaObject): Record<string, unknown> {
  if (schema.$ref) {
    const resolved = resolveRef(root, schema);
    return resolveSchemaDeep(root, resolved);
  }

  const result: Record<string, unknown> = { ...schema };

  if (result.properties && typeof result.properties === "object") {
    const props: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(result.properties as Record<string, SchemaObject>)) {
      props[key] = resolveSchemaDeep(root, value);
    }
    result.properties = props;
  }

  if (result.items && typeof result.items === "object") {
    result.items = resolveSchemaDeep(root, result.items as SchemaObject);
  }

  if (result.allOf && Array.isArray(result.allOf)) {
    result.allOf = (result.allOf as SchemaObject[]).map((s) => resolveSchemaDeep(root, s));
  }

  if (result.oneOf && Array.isArray(result.oneOf)) {
    result.oneOf = (result.oneOf as SchemaObject[]).map((s) => resolveSchemaDeep(root, s));
  }

  if (result.anyOf && Array.isArray(result.anyOf)) {
    result.anyOf = (result.anyOf as SchemaObject[]).map((s) => resolveSchemaDeep(root, s));
  }

  return result;
}

function extractRequestBody(
  root: OpenAPISpec,
  body: Record<string, unknown> | undefined,
): ParsedRequestBody | undefined {
  if (!body) return undefined;

  const resolved = resolveRef(root, body);
  const content = resolved.content as Record<string, Record<string, unknown>> | undefined;
  if (!content) return undefined;

  const contentType = Object.keys(content).find((ct) => ct.includes("json")) ?? Object.keys(content)[0];
  if (!contentType) return undefined;

  const mediaType = content[contentType];
  const schema = mediaType?.schema
    ? resolveSchemaDeep(root, mediaType.schema as SchemaObject)
    : {};

  return {
    contentType,
    description: String(resolved.description ?? ""),
    required: Boolean(resolved.required ?? false),
    schema,
  };
}

function extractResponses(
  responses: Record<string, Record<string, unknown>> | undefined,
): readonly ParsedResponse[] {
  if (!responses) return [];

  return Object.entries(responses).map(([statusCode, response]) => {
    const content = response.content as Record<string, Record<string, unknown>> | undefined;
    const contentType = content ? Object.keys(content)[0] : undefined;

    return {
      statusCode,
      description: String(response.description ?? ""),
      contentType,
      schema: contentType && content?.[contentType]?.schema
        ? (content[contentType].schema as Record<string, unknown>)
        : undefined,
    };
  });
}

function generateOperationId(method: string, path: string): string {
  const parts = path
    .split("/")
    .filter(Boolean)
    .map((p) => (p.startsWith("{") ? `by_${p.slice(1, -1)}` : p));
  return `${method}_${parts.join("_")}`.replace(/[^a-zA-Z0-9_]/g, "_");
}
