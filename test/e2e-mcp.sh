#!/bin/bash
# End-to-end test: verify toolcast works from npm and MCP protocol is functional
set -e

echo "=== CLI Tests ==="
npx toolcast --version
npx toolcast list
npx toolcast inspect https://petstore3.swagger.io/api/v3/openapi.json

echo "=== MCP Protocol Test ==="
printf '%s\n%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"findPetsByStatus","arguments":{"status":"available"}}}' \
| npx toolcast serve https://petstore3.swagger.io/api/v3/openapi.json --base-url https://petstore3.swagger.io/api/v3 2>/dev/null \
| tail -1 | python3 -c "import sys,json; d=json.load(sys.stdin); print('PASS:', len(json.loads(d['result']['content'][0]['text'])), 'pets returned')"

echo "=== All tests passed ==="
