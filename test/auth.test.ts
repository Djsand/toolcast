import { describe, expect, it } from "vitest";
import { applyAuth, resolveAuth } from "../src/generator/auth.js";
import type { ParsedSecurityScheme } from "../src/parser/types.js";

describe("Auth", () => {
  describe("resolveAuth", () => {
    it("returns none when no schemes", () => {
      const result = resolveAuth([], {});
      expect(result.type).toBe("none");
    });

    it("resolves bearer auth from env", () => {
      const schemes: ParsedSecurityScheme[] = [
        { name: "bearerAuth", type: "http", scheme: "bearer", description: "" },
      ];
      const result = resolveAuth(schemes, { API_TOKEN: "test-token" });
      expect(result.type).toBe("bearer");
      expect(result.value).toBe("test-token");
    });

    it("resolves API key from env", () => {
      const schemes: ParsedSecurityScheme[] = [
        { name: "X-Api-Key", type: "apiKey", in: "header", description: "" },
      ];
      const result = resolveAuth(schemes, { API_KEY: "my-key" });
      expect(result.type).toBe("apiKey");
      expect(result.value).toBe("my-key");
      expect(result.headerName).toBe("X-Api-Key");
    });

    it("resolves basic auth from env", () => {
      const schemes: ParsedSecurityScheme[] = [
        { name: "basicAuth", type: "http", scheme: "basic", description: "" },
      ];
      const result = resolveAuth(schemes, { API_USER: "user", API_PASSWORD: "pass" });
      expect(result.type).toBe("basic");
      expect(result.value).toBe(Buffer.from("user:pass").toString("base64"));
    });
  });

  describe("applyAuth", () => {
    it("adds bearer token header", () => {
      const headers = applyAuth({}, { type: "bearer", value: "tok123" });
      expect(headers.Authorization).toBe("Bearer tok123");
    });

    it("adds basic auth header", () => {
      const encoded = Buffer.from("u:p").toString("base64");
      const headers = applyAuth({}, { type: "basic", value: encoded });
      expect(headers.Authorization).toBe(`Basic ${encoded}`);
    });

    it("adds API key header", () => {
      const headers = applyAuth({}, { type: "apiKey", value: "key123", headerName: "X-Api-Key" });
      expect(headers["X-Api-Key"]).toBe("key123");
    });

    it("returns unchanged headers for none", () => {
      const headers = applyAuth({ Accept: "json" }, { type: "none" });
      expect(headers).toEqual({ Accept: "json" });
    });

    it("does not add header when value is missing", () => {
      const headers = applyAuth({}, { type: "bearer", value: undefined });
      expect(headers.Authorization).toBeUndefined();
    });
  });
});
