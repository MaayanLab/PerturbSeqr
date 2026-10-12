export const dynamic = 'force-dynamic'

// Follow MaayanLab/bio.autoxiv's Markdown discovery endpoint pattern.
export function GET() {
  const site = (process.env.PUBLIC_URL || 'https://perturbseqr.maayanlab.cloud').replace(/\/+$/, '')
  const body = `# Perturb-Seqr

> A Connectivity Mapping search engine and database integrating drug and gene perturbation signatures from multiple resources. Search individual gene sets, find signatures that mimic or reverse paired up/down gene sets, and retrieve signature metadata and overlapping genes through MCP or GraphQL.

When asked to use Perturb-Seqr, read the Agent Skill below for analysis workflows and result interpretation, then use the MCP server or GraphQL API. Public access does not require an API key.

The MCP endpoint is ${site}/mcp and uses Streamable HTTP. Connect with an MCP client; it accepts JSON-RPC over HTTP POST, not a browser GET. Discover the available tools with tools/list: single_gene_set_search, paired_gene_set_search, term_search, get_gene_set_genes, get_overlap, and list_datasets.

For Codex CLI, add the server with:

\`\`\`sh
codex mcp add perturbseqr --url ${site}/mcp
\`\`\`

Alternatively, use this Codex config.toml entry:

\`\`\`toml
[mcp_servers.perturbseqr]
url = "${site}/mcp"
\`\`\`

Reload or restart the client if newly configured tools do not appear. If MCP is unavailable, follow the skill's direct GraphQL examples. Call list_datasets to obtain current library names and counts; follow pagination when retrieving signatures or their genes. Use paired_gene_set_search when both up- and down-regulated query genes are available, and single_gene_set_search for a single query gene set.

## Agents

- [Perturb-Seqr Agent Skill](https://raw.githubusercontent.com/MaayanLab/maayan-lab-tools-skills/main/skills/Perturb-Seqr/SKILL.md): Markdown instructions, GraphQL examples, signature parsing, and interpretation guidance.
- [MCP server](${site}/mcp): Streamable HTTP endpoint for discovering and calling the six analysis tools.
- [MCP README](https://raw.githubusercontent.com/MaayanLab/PerturbSeqr/main/mcp/README.md): Tool overview and instructions for running the server locally.
- [AI applications user manual](${site}/help#mcp-and-skills): Skill and MCP setup examples for AI applications.

## API and data

- [GraphQL API](${site}/graphql): POST JSON containing query and variables for enrichment, term search, libraries, signature genes, and overlap queries.
- [GraphiQL](${site}/graphiql): Interactive schema explorer and query editor.
- [Python wrapper README](https://raw.githubusercontent.com/MaayanLab/PerturbSeqr/main/perturbseqr-py/README.md): Programmatic access using perturbseqr-py.
- [User manual](${site}/help): Search modes, dataset filtering, API examples, and download instructions.
- [Downloads](${site}/download): Per-dataset GMT gene sets, metadata, and full differential-expression files.

## Optional

- [About Perturb-Seqr](${site}/about): Resource description, datasets, authors, and citation.
- [Perturb-Seqr preprint](https://www.biorxiv.org/content/10.64898/2026.10.06.757137v1): Comprehensive Signature Search Engine Integrating Connectivity Maps from Multiple Sources.
- [Source code](https://github.com/MaayanLab/PerturbSeqr): Application, database, ingest pipeline, enrichment backend, and MCP implementation.
`
  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
