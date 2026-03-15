import 'dotenv/config';
import { serve } from '@hono/node-server';
import app from './app';

serve({ fetch: app.fetch, port: 3000 }, () => {
  console.log('Fathom MCP running at http://localhost:3000');
  console.log('OAuth connect: http://localhost:3000/auth/connect');
  console.log('MCP endpoint: http://localhost:3000/mcp');
});
