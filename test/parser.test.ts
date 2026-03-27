import { describe, expect, it } from "vitest";
import { parseSpec } from "../src/parser/openapi.js";
import { join } from "node:path";

const FIXTURE = join(import.meta.dirname, "fixtures", "petstore-mini.json");

describe("OpenAPI Parser", () => {
  it("parses spec metadata", async () => {
    const spec = await parseSpec(FIXTURE);
    expect(spec.title).toBe("Mini Petstore");
    expect(spec.version).toBe("1.0.0");
    expect(spec.description).toBe("A minimal petstore for testing");
  });

  it("extracts servers", async () => {
    const spec = await parseSpec(FIXTURE);
    expect(spec.servers).toHaveLength(1);
    expect(spec.servers[0].url).toBe("https://petstore.example.com/api");
    expect(spec.servers[0].description).toBe("Production");
  });

  it("extracts all endpoints", async () => {
    const spec = await parseSpec(FIXTURE);
    expect(spec.endpoints).toHaveLength(4);

    const ids = spec.endpoints.map((e) => e.operationId);
    expect(ids).toContain("listPets");
    expect(ids).toContain("createPet");
    expect(ids).toContain("getPet");
    expect(ids).toContain("deletePet");
  });

  it("parses query parameters", async () => {
    const spec = await parseSpec(FIXTURE);
    const listPets = spec.endpoints.find((e) => e.operationId === "listPets")!;

    expect(listPets.parameters).toHaveLength(2);

    const limit = listPets.parameters.find((p) => p.name === "limit")!;
    expect(limit.in).toBe("query");
    expect(limit.required).toBe(false);
    expect(limit.schema).toEqual({
      type: "integer",
      minimum: 1,
      maximum: 100,
    });
  });

  it("parses path parameters", async () => {
    const spec = await parseSpec(FIXTURE);
    const getPet = spec.endpoints.find((e) => e.operationId === "getPet")!;

    const petId = getPet.parameters.find((p) => p.name === "petId")!;
    expect(petId.in).toBe("path");
    expect(petId.required).toBe(true);
    expect(petId.schema).toEqual({ type: "integer" });
  });

  it("parses header parameters", async () => {
    const spec = await parseSpec(FIXTURE);
    const deletePet = spec.endpoints.find((e) => e.operationId === "deletePet")!;

    const apiKey = deletePet.parameters.find((p) => p.name === "X-Api-Key")!;
    expect(apiKey.in).toBe("header");
    expect(apiKey.required).toBe(true);
  });

  it("parses request body with $ref resolution", async () => {
    const spec = await parseSpec(FIXTURE);
    const createPet = spec.endpoints.find((e) => e.operationId === "createPet")!;

    expect(createPet.requestBody).toBeDefined();
    expect(createPet.requestBody!.required).toBe(true);
    expect(createPet.requestBody!.contentType).toBe("application/json");

    const schema = createPet.requestBody!.schema;
    expect(schema.type).toBe("object");
    expect(schema.properties).toBeDefined();
  });

  it("extracts security schemes", async () => {
    const spec = await parseSpec(FIXTURE);
    expect(spec.securitySchemes).toHaveLength(2);

    const bearer = spec.securitySchemes.find((s) => s.name === "bearerAuth")!;
    expect(bearer.type).toBe("http");
    expect(bearer.scheme).toBe("bearer");

    const apiKey = spec.securitySchemes.find((s) => s.name === "apiKey")!;
    expect(apiKey.type).toBe("apiKey");
    expect(apiKey.in).toBe("header");
  });

  it("parses responses", async () => {
    const spec = await parseSpec(FIXTURE);
    const getPet = spec.endpoints.find((e) => e.operationId === "getPet")!;

    expect(getPet.responses).toHaveLength(2);
    expect(getPet.responses[0].statusCode).toBe("200");
    expect(getPet.responses[1].statusCode).toBe("404");
  });

  it("extracts method and path", async () => {
    const spec = await parseSpec(FIXTURE);
    const listPets = spec.endpoints.find((e) => e.operationId === "listPets")!;
    expect(listPets.method).toBe("GET");
    expect(listPets.path).toBe("/pets");

    const createPet = spec.endpoints.find((e) => e.operationId === "createPet")!;
    expect(createPet.method).toBe("POST");
    expect(createPet.path).toBe("/pets");
  });

  it("extracts tags", async () => {
    const spec = await parseSpec(FIXTURE);
    const listPets = spec.endpoints.find((e) => e.operationId === "listPets")!;
    expect(listPets.tags).toEqual(["pets"]);
  });
});
