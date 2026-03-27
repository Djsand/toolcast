import type { ParsedSecurityScheme } from "../parser/types.js";

export interface AuthConfig {
  readonly type: "apiKey" | "bearer" | "basic" | "none";
  readonly value?: string;
  readonly headerName?: string;
}

export function resolveAuth(
  schemes: readonly ParsedSecurityScheme[],
  env: Record<string, string | undefined>,
): AuthConfig {
  if (schemes.length === 0) return { type: "none" };

  const scheme = schemes[0];

  if (scheme.type === "http" && scheme.scheme === "bearer") {
    const token = env.API_TOKEN ?? env.BEARER_TOKEN ?? env.AUTH_TOKEN;
    return { type: "bearer", value: token };
  }

  if (scheme.type === "http" && scheme.scheme === "basic") {
    const user = env.API_USER ?? env.BASIC_USER ?? "";
    const pass = env.API_PASSWORD ?? env.BASIC_PASSWORD ?? "";
    const encoded = Buffer.from(`${user}:${pass}`).toString("base64");
    return { type: "basic", value: encoded };
  }

  if (scheme.type === "apiKey") {
    const headerName = scheme.in === "header" ? scheme.name : "X-API-Key";
    const value = env.API_KEY ?? env[`${scheme.name.toUpperCase().replace(/-/g, "_")}`];
    return { type: "apiKey", value, headerName };
  }

  return { type: "none" };
}

export function applyAuth(
  headers: Record<string, string>,
  auth: AuthConfig,
): Record<string, string> {
  switch (auth.type) {
    case "bearer":
      return auth.value
        ? { ...headers, Authorization: `Bearer ${auth.value}` }
        : headers;
    case "basic":
      return auth.value
        ? { ...headers, Authorization: `Basic ${auth.value}` }
        : headers;
    case "apiKey":
      return auth.value && auth.headerName
        ? { ...headers, [auth.headerName]: auth.value }
        : headers;
    default:
      return headers;
  }
}
