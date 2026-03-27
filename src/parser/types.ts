export interface ParsedParameter {
  readonly name: string;
  readonly in: "query" | "path" | "header" | "cookie";
  readonly description: string;
  readonly required: boolean;
  readonly schema: Record<string, unknown>;
}

export interface ParsedRequestBody {
  readonly contentType: string;
  readonly description: string;
  readonly required: boolean;
  readonly schema: Record<string, unknown>;
}

export interface ParsedResponse {
  readonly statusCode: string;
  readonly description: string;
  readonly contentType?: string;
  readonly schema?: Record<string, unknown>;
}

export interface ParsedEndpoint {
  readonly operationId: string;
  readonly method: string;
  readonly path: string;
  readonly summary: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly parameters: readonly ParsedParameter[];
  readonly requestBody?: ParsedRequestBody;
  readonly responses: readonly ParsedResponse[];
  readonly security: readonly Record<string, readonly string[]>[];
}

export interface ParsedSecurityScheme {
  readonly name: string;
  readonly type: "apiKey" | "http" | "oauth2" | "openIdConnect";
  readonly in?: "query" | "header" | "cookie";
  readonly scheme?: string;
  readonly bearerFormat?: string;
  readonly description: string;
}

export interface ParsedServer {
  readonly url: string;
  readonly description: string;
}

export interface ParsedSpec {
  readonly title: string;
  readonly version: string;
  readonly description: string;
  readonly servers: readonly ParsedServer[];
  readonly endpoints: readonly ParsedEndpoint[];
  readonly securitySchemes: readonly ParsedSecurityScheme[];
}
