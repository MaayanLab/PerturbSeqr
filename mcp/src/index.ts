import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import cors from 'cors';
import { initialize_tools } from './tools/index.js';

// Adapted from https://github.com/MaayanLab/DRC-Portals/blob/10b81ade7652a996488ab9fd5ef15cf20223e9d4/cfde-mcp/src/index.ts
const app = express();
app.use(cors({
    "origin": "*",
    "methods": "GET,POST,DELETE,OPTIONS",
}));
app.post('/mcp', async (req, res) => {
    const server = new McpServer({
        name: 'perturbseqr-mcp-server',
        version: '0.2.51'
    });

    initialize_tools(server)

    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
    });

    res.on('close', () => {
        server.close();
    });

    try {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    } catch (error) {
        console.error('MCP request failed:', error);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0',
                error: { code: -32603, message: 'MCP request failed' },
                id: null
            });
        }
    }
});
app.all('/mcp', (_req, res) => {
    res.set('Allow', 'POST, OPTIONS').status(405).end();
});

const port = parseInt("5000");
app.listen(port, () => {
    console.log(`Perturb-Seqr MCP Server running on http://localhost:5000/mcp`);
}).on('error', error => {
    console.error('Server error:', error);
    process.exit(1);
});
