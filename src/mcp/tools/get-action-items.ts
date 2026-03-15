import { z } from 'zod';
import type { Fathom } from 'fathom-typescript';

export const getActionItemsSchema = z.object({
  recording_id: z.number().describe(
    'The recording_id from a search_meetings result.'
  ),
});

export type GetActionItemsInput = z.infer<typeof getActionItemsSchema>;

export async function getActionItems(
  input: GetActionItemsInput,
  fathom: Fathom
) {
  // Fathom has no single-meeting GET endpoint, so we paginate listMeetings
  // with include_action_items=true until we find the target recording.
  const result = await fathom.listMeetings({
    includeActionItems: true,
  });

  let allItems = result?.result?.items ?? [];
  let cursor = result?.result?.nextCursor;

  // Look in first page
  let meeting = allItems.find((m: any) => m.recording_id === input.recording_id);

  // If not found and there are more pages, keep fetching (up to 5 pages)
  let pages = 0;
  while (!meeting && cursor && pages < 4) {
    const next = await fathom.listMeetings({
      includeActionItems: true,
      cursor,
    });
    meeting = (next?.result?.items ?? []).find((m: any) => m.recording_id === input.recording_id);
    cursor = next?.result?.nextCursor;
    pages++;
  }

  if (!meeting) {
    return {
      recording_id: input.recording_id,
      action_items: [],
      note: 'Meeting not found. It may be older than the accessible history or belong to a different user.',
    };
  }

  const actionItems = ((meeting as any).action_items ?? []).map((item: any) => ({
    description: item.description,
    assignee_name: item.assignee?.name ?? null,
    assignee_email: item.assignee?.email ?? null,
    completed: item.completed ?? false,
    timestamp: item.recording_timestamp ?? null,
    playback_url: item.recording_playback_url ?? null,
  }));

  return {
    recording_id: input.recording_id,
    action_items: actionItems,
    count: actionItems.length,
  };
}
