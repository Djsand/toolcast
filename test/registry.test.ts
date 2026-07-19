import { describe, expect, it } from "vitest";
import { getRegistryEntry, listRegistry, searchRegistry } from "../src/registry/index.js";

describe("Registry", () => {
  it("lists all registry entries", async () => {
    const entries = await listRegistry();
    expect(entries.length).toBeGreaterThanOrEqual(7);

    const names = entries.map((e) => e.name);
    expect(names).toContain("github");
    expect(names).toContain("stripe");
    expect(names).toContain("petstore");
    expect(names).toContain("xquik");
  });

  it("each entry has required fields", async () => {
    const entries = await listRegistry();
    for (const entry of entries) {
      expect(entry.name).toBeTruthy();
      expect(entry.displayName).toBeTruthy();
      expect(entry.description).toBeTruthy();
      expect(entry.specUrl).toBeTruthy();
      expect(entry.baseUrl).toBeTruthy();
      expect(entry.authType).toBeTruthy();
      expect(entry.tags.length).toBeGreaterThan(0);
    }
  });

  it("searches by name", async () => {
    const results = await searchRegistry("github");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].name).toBe("github");
  });

  it("searches by tag", async () => {
    const results = await searchRegistry("payments");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].name).toBe("stripe");
  });

  it("searches by description", async () => {
    const results = await searchRegistry("messages");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.name === "slack")).toBe(true);
  });

  it("returns empty for no match", async () => {
    const results = await searchRegistry("zzz_nonexistent_zzz");
    expect(results).toHaveLength(0);
  });

  it("gets entry by name", async () => {
    const entry = await getRegistryEntry("petstore");
    expect(entry).toBeDefined();
    expect(entry!.displayName).toBe("Petstore (Demo)");
    expect(entry!.authType).toBe("none");
  });

  it("gets Xquik API key auth metadata", async () => {
    const entry = await getRegistryEntry("xquik");
    expect(entry).toBeDefined();
    expect(entry!.authType).toBe("apiKey");
    expect(entry!.authEnvVar).toBe("X_API_KEY");
    expect(entry!.authHeaderName).toBe("x-api-key");
  });

  it("returns undefined for missing entry", async () => {
    const entry = await getRegistryEntry("nonexistent");
    expect(entry).toBeUndefined();
  });
});
