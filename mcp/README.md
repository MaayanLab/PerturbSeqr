# Perturb-Seqr MCP

MCP tools wrapping the core Perturb-Seqr GraphQL API.

## Quick Start

```bash
npm ci
npm run build
PERTURBSEQR_API_URL=http://localhost:3000/graphql npm start
```

Connect to client at `http://localhost:5000/mcp`.

## Project Structure

```text
mcp/
├── src/
│   ├── tools/
│   │   ├── SingleGeneSetSearchTool.ts
│   │   ├── PairedGeneSetSearchTool.ts
│   │   ├── TermSearchTool.ts
│   │   ├── GetGeneSetGenesTool.ts
│   │   ├── GetOverlapTool.ts
│   │   ├── ListDatasetsTool.ts
│   │   └── index.ts
│   ├── api.ts             # Shared GraphQL requests
│   ├── fields.ts
│   ├── schemas.ts
│   └── index.ts
├── Dockerfile
├── package.json
└── tsconfig.json
```
