import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Fathom } from 'fathom-typescript';
import { searchMeetingsSchema, searchMeetings } from './tools/search-meetings';
import { getTranscriptSchema, getTranscript } from './tools/get-transcript';
import { getSummarySchema, getSummary } from './tools/get-summary';
import { getActionItemsSchema, getActionItems } from './tools/get-action-items';

/**
 * Create a new McpServer instance for a specific request/user.
 * The fathomClient is pre-authenticated and scoped to this user.
 *
 * We create a new instance per request because:
 * 1. User context (fathomClient) is request-scoped
 * 2. Stateless transport requires no shared state across requests
 * 3. McpServer instantiation is cheap
 */
export function createMcpServer(fathomClient: Fathom): McpServer {
  const server = new McpServer({
    name: 'fathom-mcp',
    version: '1.0.0',
  });

  server.tool(
    'search_meetings',
    'Search and filter your Fathom meeting recordings. Returns meeting metadata and recording IDs. Use recording IDs with get_transcript, get_summary, or get_action_items.',
    searchMeetingsSchema.shape,
    async (input) => {
      const result = await searchMeetings(input as any, fathomClient);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'get_transcript',
    'Get the full verbatim transcript for a meeting recording. Speaker-labeled and timestamped. Use this for deep analysis, finding specific quotes, or understanding the full conversation.',
    getTranscriptSchema.shape,
    async (input) => {
      const result = await getTranscript(input as any, fathomClient);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'get_summary',
    "Get Fathom's AI-generated summary for a meeting recording. Returns markdown. Useful for quick context before deciding whether to pull the full transcript.",
    getSummarySchema.shape,
    async (input) => {
      const result = await getSummary(input as any, fathomClient);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'get_action_items',
    'Get all action items Fathom extracted from a meeting recording. Includes assignees, completion status, and deep-links back into the recording at the timestamp where each item was raised.',
    getActionItemsSchema.shape,
    async (input) => {
      const result = await getActionItems(input as any, fathomClient);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  return server;
}
