#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Command } from "commander";
import { parseSpec } from "./parser/openapi.js";
import { startServer } from "./generator/mcp-server.js";
import { getRegistryEntry, listRegistry, searchRegistry } from "./registry/index.js";

const program = new Command();

program
  .name("anyapi")
  .description("Turn any API into an AI agent tool. Point at an OpenAPI spec → get a working MCP server.")
  .version("0.1.0");

program
  .command("serve")
  .description("Start an MCP server from an OpenAPI spec")
  .argument("<spec>", "OpenAPI spec URL or file path")
  .option("--base-url <url>", "Override the base URL for API requests")
  .option("--api-key <key>", "API key for authentication")
  .option("--bearer-token <token>", "Bearer token for authentication")
  .action(async (specSource: string, options: { baseUrl?: string; apiKey?: string; bearerToken?: string }) => {
    const spec = await parseSpec(specSource);

    const auth = options.apiKey
      ? { type: "apiKey" as const, value: options.apiKey, headerName: "Authorization" }
      : options.bearerToken
        ? { type: "bearer" as const, value: options.bearerToken }
        : undefined;

    process.stderr.write(`\x1b[32m✓\x1b[0m Loaded ${spec.title} v${spec.version}\n`);
    process.stderr.write(`\x1b[32m✓\x1b[0m Registered ${spec.endpoints.length} tools\n`);
    process.stderr.write(`\x1b[36m⟡\x1b[0m MCP server running on stdio\n`);

    await startServer(spec, { baseUrl: options.baseUrl, auth });
  });

program
  .command("list")
  .description("List all APIs in the registry")
  .action(async () => {
    const entries = await listRegistry();
    if (entries.length === 0) {
      console.log("Registry is empty. Add configs to the registry/ directory.");
      return;
    }
    console.log(`\n  \x1b[1m${entries.length} APIs available:\x1b[0m\n`);
    for (const entry of entries) {
      console.log(`  \x1b[36m${entry.name.padEnd(20)}\x1b[0m ${entry.description}`);
    }
    console.log(`\n  Run \x1b[33manyapi add <name>\x1b[0m to configure one.\n`);
  });

program
  .command("search")
  .description("Search the registry")
  .argument("<query>", "Search query")
  .action(async (query: string) => {
    const results = await searchRegistry(query);
    if (results.length === 0) {
      console.log(`No APIs found matching "${query}".`);
      return;
    }
    console.log(`\n  \x1b[1m${results.length} result(s):\x1b[0m\n`);
    for (const entry of results) {
      console.log(`  \x1b[36m${entry.name.padEnd(20)}\x1b[0m ${entry.description}`);
    }
    console.log();
  });

program
  .command("add")
  .description("Add a registry API to your MCP config")
  .argument("<name>", "API name from registry")
  .option("--config <path>", "Path to .mcp.json", ".mcp.json")
  .action(async (name: string, options: { config: string }) => {
    const entry = await getRegistryEntry(name);
    if (!entry) {
      console.error(`\x1b[31m✗\x1b[0m API "${name}" not found in registry. Run \x1b[33manyapi list\x1b[0m to see available APIs.`);
      process.exit(1);
    }

    const configPath = resolve(options.config);
    let config: Record<string, unknown> = {};
    try {
      const existing = await readFile(configPath, "utf-8");
      config = JSON.parse(existing);
    } catch {
      // File doesn't exist yet
    }

    const mcpServers = (config.mcpServers ?? {}) as Record<string, unknown>;
    mcpServers[`anyapi-${entry.name}`] = {
      command: "npx",
      args: ["anyapi", "serve", entry.specUrl, "--base-url", entry.baseUrl],
      env: entry.authEnvVar ? { [entry.authEnvVar]: `<your-${entry.name}-api-key>` } : undefined,
    };
    config.mcpServers = mcpServers;

    await writeFile(configPath, JSON.stringify(config, null, 2) + "\n");

    console.log(`\x1b[32m✓\x1b[0m Added ${entry.displayName} to ${configPath}`);
    if (entry.authEnvVar) {
      console.log(`\x1b[33m!\x1b[0m Set your ${entry.authEnvVar} environment variable or update ${configPath}`);
    }
  });

program
  .command("inspect")
  .description("Show the tools that would be generated from a spec")
  .argument("<spec>", "OpenAPI spec URL or file path")
  .action(async (specSource: string) => {
    const spec = await parseSpec(specSource);
    console.log(`\n  \x1b[1m${spec.title}\x1b[0m v${spec.version}`);
    if (spec.description) console.log(`  ${spec.description}`);
    console.log(`\n  \x1b[1mServers:\x1b[0m`);
    for (const server of spec.servers) {
      console.log(`    ${server.url}${server.description ? ` — ${server.description}` : ""}`);
    }
    console.log(`\n  \x1b[1m${spec.endpoints.length} Tools:\x1b[0m\n`);
    for (const ep of spec.endpoints) {
      const params = ep.parameters.length + (ep.requestBody ? 1 : 0);
      console.log(`  \x1b[36m${ep.operationId.padEnd(40)}\x1b[0m ${ep.method.padEnd(7)} ${ep.path}  (${params} params)`);
    }
    console.log();
  });

program.parse();
