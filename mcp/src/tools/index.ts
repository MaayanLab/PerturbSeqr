import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import SingleGeneSetSearch from './SingleGeneSetSearchTool.js';
import PairedGeneSetSearch from './PairedGeneSetSearchTool.js';
import TermSearch from './TermSearchTool.js';
import GetGeneSetGenes from './GetGeneSetGenesTool.js';
import GetOverlap from './GetOverlapTool.js';
import ListDatasets from './ListDatasetsTool.js';

const tools: any[] = [SingleGeneSetSearch, PairedGeneSetSearch, TermSearch,
  GetGeneSetGenes, GetOverlap, ListDatasets];

export const initialize_tools = (server: McpServer) => {
  for (const [name, config, execute] of tools) {
    server.registerTool(name, config, execute);
  }
};
