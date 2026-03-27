<p align="center">
  <h1 align="center">toolcast</h1>
  <p align="center">
    <strong>Turn any API into an AI agent tool. One command.</strong>
  </p>
  <p align="center">
    Point at an OpenAPI spec. Get a working MCP server in 10 seconds.<br/>
    Your AI agent can now call Stripe, GitHub, Slack, Notion — or <em>any</em> API with a spec.
  </p>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#registry">Registry</a> &bull;
  <a href="#how-it-works">How It Works</a> &bull;
  <a href="#examples">Examples</a> &bull;
  <a href="#contributing">Contributing</a>
</p>

---

## The Problem

You want your AI agent to call an API. Today you have to:

1. Find or build an MCP server for that specific API
2. Write tool definitions, parameter schemas, auth handling
3. Test it, debug it, deploy it
4. Repeat for every new API

**toolcast does all of this in one command.**

## Quick Start

```bash
# Try it right now with the demo Petstore API (no auth needed)
npx toolcast serve https://petstore3.swagger.io/api/v3/openapi.json
```

That's it. Your AI agent now has 19 tools for managing pets, orders, and users.

### Add a real API

```bash
# Add Stripe to your Claude Code config
npx toolcast add stripe

# Or point at any OpenAPI spec
npx toolcast serve https://api.example.com/openapi.json --bearer-token $MY_TOKEN
```

### Inspect before serving

```bash
# See what tools would be generated
npx toolcast inspect https://petstore3.swagger.io/api/v3/openapi.json
```

```
  Swagger Petstore v1.0.27

  19 Tools:

  addPet                    POST    /pet              (1 params)
  updatePet                 PUT     /pet              (1 params)
  findPetsByStatus          GET     /pet/findByStatus (1 params)
  getPetById                GET     /pet/{petId}      (1 params)
  getInventory              GET     /store/inventory  (0 params)
  placeOrder                POST    /store/order      (1 params)
  createUser                POST    /user             (1 params)
  ...
```

## Registry

toolcast ships with pre-built configs for popular APIs. One command to add them:

| API | Command | What You Get |
|-----|---------|-------------|
| **GitHub** | `toolcast add github` | Repos, issues, PRs, actions, users |
| **Stripe** | `toolcast add stripe` | Payments, subscriptions, invoices |
| **Slack** | `toolcast add slack` | Messages, channels, users, reactions |
| **Notion** | `toolcast add notion` | Pages, databases, blocks, search |
| **Linear** | `toolcast add linear` | Issues, projects, teams, cycles |
| **OpenAI** | `toolcast add openai` | Completions, embeddings, images |
| **Petstore** | `toolcast add petstore` | Demo API for testing |

```bash
# List all available APIs
toolcast list

# Search by keyword
toolcast search payments
```

**Want to add an API?** See [Contributing](#contributing).

## How It Works

```
                    +-----------------+
  OpenAPI Spec ---> |     toolcast      | ---> MCP Server (stdio)
  (URL or file)     |                 |      ready for Claude Code,
                    | 1. Parse spec   |      Cursor, or any MCP client
                    | 2. Build tools  |
                    | 3. Handle auth  |
                    +-----------------+
```

1. **Parse** — Reads any OpenAPI 3.0/3.1 spec (JSON or YAML, URL or file). Resolves `$ref`s, extracts endpoints, parameters, and auth schemes.

2. **Build Tools** — Each API endpoint becomes an MCP tool with:
   - A human-readable name (from `operationId`)
   - A clear description (from `summary` + `description`)
   - A typed input schema (from parameters + request body)
   - Proper parameter handling (path, query, header, body)

3. **Serve** — Starts a stdio MCP server that proxies tool calls to the real API with proper auth, headers, and error formatting.

## Examples

### Use with Claude Code

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "my-api": {
      "command": "npx",
      "args": ["toolcast", "serve", "https://api.example.com/openapi.json"],
      "env": {
        "API_TOKEN": "your-token-here"
      }
    }
  }
}
```

Or use the `add` command to auto-configure:

```bash
toolcast add github
# Adds to .mcp.json automatically
```

### Use with a local spec file

```bash
toolcast serve ./my-api-spec.yaml --base-url https://localhost:3000
```

### Use programmatically

```typescript
import { parseSpec, createMcpServer } from "toolcast";

const spec = await parseSpec("https://api.example.com/openapi.json");
const server = createMcpServer(spec, {
  baseUrl: "https://api.example.com",
  auth: { type: "bearer", value: process.env.API_TOKEN },
});
```

## Auth

toolcast supports three auth methods, auto-detected from the OpenAPI spec:

| Method | Env Variables | Flag |
|--------|--------------|------|
| **Bearer Token** | `API_TOKEN`, `BEARER_TOKEN`, `AUTH_TOKEN` | `--bearer-token` |
| **API Key** | `API_KEY`, or derived from scheme name | `--api-key` |
| **Basic Auth** | `API_USER` + `API_PASSWORD` | — |

Registry entries specify which env var to use (e.g., `GITHUB_TOKEN` for GitHub).

## CLI Reference

```
toolcast serve <spec>       Start MCP server from OpenAPI spec
  --base-url <url>        Override base URL
  --api-key <key>         API key auth
  --bearer-token <token>  Bearer token auth

toolcast inspect <spec>     Preview tools without starting server

toolcast add <name>         Add registry API to .mcp.json
  --config <path>         Config file path (default: .mcp.json)

toolcast list               List all registry APIs
toolcast search <query>     Search registry
toolcast --version          Show version
toolcast --help             Show help
```

## Contributing

### Add an API to the registry

1. Create a YAML file in `registry/`:

```yaml
name: my-api
displayName: My API
description: What this API does
specUrl: https://example.com/openapi.json
baseUrl: https://api.example.com
authType: bearer
authEnvVar: MY_API_KEY
tags:
  - category
  - keywords
```

2. Submit a PR. That's it.

### Development

```bash
git clone https://github.com/your-username/toolcast.git
cd toolcast
npm install
npm run build
npm test

# Test locally
node dist/cli.js inspect https://petstore3.swagger.io/api/v3/openapi.json
```

## License

MIT
