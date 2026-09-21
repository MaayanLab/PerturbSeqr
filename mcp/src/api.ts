import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

const endpoint = process.env.PERTURBSEQR_API_URL || 'https://perturbseqr.maayanlab.cloud/graphql';

export async function graphql(query: string, variables: Record<string, unknown> = {}): Promise<CallToolResult> {
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Perturb-Seqr API returned HTTP ${response.status}`);
  const { data, errors } = await response.json();
  if (errors?.length) throw new Error(errors.map((error: { message: string }) => error.message).join('; '));
  if (!data) throw new Error('Perturb-Seqr API returned no data');
  return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data };
}
