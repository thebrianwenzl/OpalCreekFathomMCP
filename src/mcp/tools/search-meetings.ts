import { z } from 'zod';
import type { Fathom } from 'fathom-typescript';

export const searchMeetingsSchema = z.object({
  attendee_domain: z.array(z.string()).optional().describe(
    'Filter by attendee email domain(s), e.g. ["npghealth.com"]. Matches any meeting where at least one invitee has this domain.'
  ),
  recorded_by: z.array(z.string().email()).optional().describe(
    'Filter by recorder email address(es). Useful for filtering to your own meetings.'
  ),
  created_after: z.string().optional().describe(
    'ISO 8601 datetime. Only return meetings created after this time.'
  ),
  created_before: z.string().optional().describe(
    'ISO 8601 datetime. Only return meetings created before this time.'
  ),
  cursor: z.string().optional().describe(
    'Pagination cursor from a previous search_meetings call.'
  ),
});

export type SearchMeetingsInput = z.infer<typeof searchMeetingsSchema>;

export async function searchMeetings(
  input: SearchMeetingsInput,
  fathom: Fathom
) {
  const result = await fathom.listMeetings({
    calendarInviteesDomains: input.attendee_domain,
    recordedBy: input.recorded_by,
    createdAfter: input.created_after,
    createdBefore: input.created_before,
    cursor: input.cursor,
    includeActionItems: false, // keep list calls lean; use get_action_items for these
  });

  const meetings = (result?.result?.items ?? []).map((m: any) => ({
    recording_id: m.recording_id,
    title: m.title,
    meeting_title: m.meeting_title,
    url: m.url,
    created_at: m.created_at,
    scheduled_start_time: m.scheduled_start_time,
    scheduled_end_time: m.scheduled_end_time,
    recorded_by: m.recorded_by,
    calendar_invitees: (m.calendar_invitees ?? []).map((i: any) => ({
      name: i.name,
      email: i.email,
      is_external: i.is_external,
    })),
  }));

  return {
    meetings,
    next_cursor: result?.result?.nextCursor ?? null,
    count: meetings.length,
  };
}
