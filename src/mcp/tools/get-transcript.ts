import { z } from 'zod';
import type { Fathom } from 'fathom-typescript';

export const getTranscriptSchema = z.object({
  recording_id: z.number().describe(
    'The recording_id from a search_meetings result.'
  ),
});

export type GetTranscriptInput = z.infer<typeof getTranscriptSchema>;

export async function getTranscript(
  input: GetTranscriptInput,
  fathom: Fathom
) {
  // The fathom-typescript SDK doesn't yet have a typed getTranscript method.
  // We call the recordings endpoint directly via raw fetch with the access token.
  const tokenStore = (fathom as any)._tokenStore ?? (fathom as any).tokenStore;
  const tokenData = tokenStore ? await tokenStore.get() : null;

  if (!tokenData?.token) {
    throw new Error('No valid Fathom access token available');
  }

  const response = await fetch(
    `https://api.fathom.ai/external/v1/recordings/${input.recording_id}/transcript`,
    {
      headers: {
        'X-Api-Key': tokenData.token,
      },
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Fathom transcript fetch failed: ${response.status} ${err}`);
  }

  const data = await response.json() as {
    transcript: { speaker: { display_name: string; matched_calendar_invitee_email?: string }; text: string; timestamp: string }[];
  };

  return {
    recording_id: input.recording_id,
    transcript: (data.transcript ?? []).map(t => ({
      speaker: t.speaker.display_name,
      speaker_email: t.speaker.matched_calendar_invitee_email ?? null,
      text: t.text,
      timestamp: t.timestamp,
    })),
    line_count: data.transcript?.length ?? 0,
  };
}
