import { Hono } from 'hono';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { authMiddleware } from './auth/middleware';
import { handleConnect, handleCallback } from './auth/oauth';
import { createMcpServer } from './mcp/server';
import type { Fathom } from 'fathom-typescript';

type Variables = {
  userId: string;
  fathomClient: Fathom;
};

const app = new Hono<{ Variables: Variables }>();

// Health check — useful for Vercel deployment validation
app.get('/', (c) => c.json({ status: 'ok', service: 'fathom-mcp' }));

// OAuth onboarding flow (no auth middleware — these are public)
app.get('/auth/connect', handleConnect);
app.get('/auth/callback', handleCallback);

// MCP endpoint — requires valid server API key
app.post('/mcp', authMiddleware, async (c) => {
  const fathomClient = c.get('fathomClient');
  const server = createMcpServer(fathomClient);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — no session management
  });

  await server.connect(transport);

  const response = await transport.handleRequest(c.req.raw);
  return response;
});

// MCP GET endpoint — required by spec for capability negotiation in some clients
app.get('/mcp', authMiddleware, async (c) => {
  const fathomClient = c.get('fathomClient');
  const server = createMcpServer(fathomClient);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);
  const response = await transport.handleRequest(c.req.raw);
  return response;
});

export default app;
