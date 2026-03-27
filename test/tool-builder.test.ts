import { describe, expect, it } from "vitest";
import { parseSpec } from "../src/parser/openapi.js";
import { buildTools } from "../src/generator/tool-builder.js";
import { join } from "node:path";

const FIXTURE = join(import.meta.dirname, "fixtures", "petstore-mini.json");

describe("Tool Builder", () => {
  it("creates a tool for each endpoint", async () => {
    const spec = await parseSpec(FIXTURE);
    const tools = buildTools(spec.endpoints);
    expect(tools).toHaveLength(4);
  });

  it("generates valid tool names", async () => {
    const spec = await parseSpec(FIXTURE);
    const tools = buildTools(spec.endpoints);

    for (const tool of tools) {
      expect(tool.name).toMatch(/^[a-zA-Z0-9_-]+$/);
      expect(tool.name.length).toBeLessThanOrEqual(64);
    }
  });

  it("includes method and path in description", async () => {
    const spec = await parseSpec(FIXTURE);
    const tools = buildTools(spec.endpoints);

    const listPets = tools.find((t) => t.name === "listPets")!;
    expect(listPets.description).toContain("GET");
    expect(listPets.description).toContain("/pets");
    expect(listPets.description).toContain("List all pets");
  });

  it("builds input schema with query parameters", async () => {
    const spec = await parseSpec(FIXTURE);
    const tools = buildTools(spec.endpoints);

    const listPets = tools.find((t) => t.name === "listPets")!;
    const schema = listPets.inputSchema;

    expect(schema.type).toBe("object");
    const props = schema.properties as Record<string, Record<string, unknown>>;
    expect(props.limit).toBeDefined();
    expect(props.status).toBeDefined();
    expect(schema.required).toBeUndefined(); // both optional
  });

  it("builds input schema with path parameters as required", async () => {
    const spec = await parseSpec(FIXTURE);
    const tools = buildTools(spec.endpoints);

    const getPet = tools.find((t) => t.name === "getPet")!;
    const schema = getPet.inputSchema;

    expect((schema.required as string[])).toContain("petId");
  });

  it("flattens request body properties with body_ prefix", async () => {
    const spec = await parseSpec(FIXTURE);
    const tools = buildTools(spec.endpoints);

    const createPet = tools.find((t) => t.name === "createPet")!;
    const schema = createPet.inputSchema;
    const props = schema.properties as Record<string, unknown>;

    expect(props.body_name).toBeDefined();
    expect(props.body_id).toBeDefined();
    expect(props.body_status).toBeDefined();
  });

  it("marks required body fields as required", async () => {
    const spec = await parseSpec(FIXTURE);
    const tools = buildTools(spec.endpoints);

    const createPet = tools.find((t) => t.name === "createPet")!;
    const required = createPet.inputSchema.required as string[];

    expect(required).toContain("body_name");
  });

  it("preserves endpoint reference", async () => {
    const spec = await parseSpec(FIXTURE);
    const tools = buildTools(spec.endpoints);

    const getPet = tools.find((t) => t.name === "getPet")!;
    expect(getPet.endpoint.method).toBe("GET");
    expect(getPet.endpoint.path).toBe("/pets/{petId}");
  });
});
