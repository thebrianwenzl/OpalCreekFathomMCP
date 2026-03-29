import { z } from 'zod';
import type { Fathom } from 'fathom-typescript';

export const getSummarySchema = z.object({
  recording_id: z.number().describe(
    'The recording_id from a search_meetings result.'
  ),
});

export type GetSummaryInput = z.infer<typeof getSummarySchema>;

export async function getSummary(
  input: GetSummaryInput,
  fathom: Fathom
) {
  const tokenStore = (fathom as any)._tokenStore ?? (fathom as any).tokenStore;
  const tokenData = tokenStore ? await tokenStore.get() : null;

  if (!tokenData?.token) {
    throw new Error('No valid Fathom access token available');
  }

  const response = await fetch(
    `https://api.fathom.ai/external/v1/recordings/${input.recording_id}/summary`,
    {
      headers: {
        'X-Api-Key': tokenData.token,
      },
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Fathom summary fetch failed: ${response.status} ${err}`);
  }

  const data = await response.json() as {
    summary?: { template_name: string; markdown_formatted: string };
  };

  if (!data.summary) {
    return { recording_id: input.recording_id, summary: null, note: 'No summary available for this recording.' };
  }

  return {
    recording_id: input.recording_id,
    summary: data.summary.markdown_formatted,
    template: data.summary.template_name,
  };
}
