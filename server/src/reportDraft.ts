import Anthropic from '@anthropic-ai/sdk';
import { takeAiBudget } from './aiBudget';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import * as z4 from 'zod/v4';
import type { Lang } from './chat';

// "Tell it in your own words": turns what she said into a draft report she checks and edits
// before sending. Nothing is saved here, and nothing is sent anywhere until she submits the form.

export const INCIDENT_TYPES = ['harassment', 'assault', 'stalking', 'threat', 'discrimination', 'other'] as const;

const DraftSchema = z4.object({
  incidentType: z4.enum(INCIDENT_TYPES).describe('The closest type. "other" if none fits.'),
  description: z4
    .string()
    .describe("Her account, in her own language and first person, in clear order. Keep her words and every detail she gave; add nothing she didn't say."),
  location: z4.string().describe('Where it happened, as she described it (a street, landmark, bus route). Empty if she did not say.'),
  date: z4.string().describe('YYYY-MM-DD if she gave or implied a date (work out "yesterday" from today). Empty if not.'),
  time: z4.string().describe('HH:MM, 24-hour, if she gave a time ("around 9 at night" is 21:00). Empty if not.'),
});

export type ReportDraft = z4.infer<typeof DraftSchema>;

const LANGUAGE: Record<Lang, string> = { en: 'English', hi: 'Hindi', ta: 'Tamil', bn: 'Bengali', mr: 'Marathi' };

const systemPrompt = (today: string, lang: Lang) => `A woman is reporting an incident (harassment, assault, stalking, threats, discrimination) to a community safety map, and has described it in her own words, possibly by voice (speech recognition makes small mistakes). Turn it into a draft report she will check and edit before anything is sent.

Today is ${today}. Her app is in ${LANGUAGE[lang]}; write the description in the language she used.

- Keep her account: her words, her order where it's clear, every detail she gave. Fix obvious speech-recognition slips. Don't add, guess, judge, soften or dramatise anything.
- The description is about what happened. Leave out names and phone numbers of private people she mentions, and her own identifying details, because reports with a location are shown on a public map.
- Only fill in the date, time and place if she said them or they follow directly from what she said.`;

let client: Anthropic | undefined;

const isDate = (d: string, today: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && d <= today;
const isTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

export async function draftReport(text: string, today: string, lang: Lang = 'en'): Promise<{ draft: ReportDraft; mode: 'ai' | 'fallback' }> {
  const fallback = { draft: { incidentType: 'other' as const, description: text, location: '', date: '', time: '' }, mode: 'fallback' as const };
  if (!takeAiBudget()) return fallback;
  try {
    client ??= new Anthropic();
    const response = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      output_config: { effort: 'low', format: betaZodOutputFormat(DraftSchema) },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: systemPrompt(today, lang),
      messages: [{ role: 'user', content: text }],
    });
    const parsed = response.stop_reason === 'refusal' ? null : response.parsed_output;
    if (!parsed?.description.trim()) return fallback;
    return {
      draft: {
        incidentType: parsed.incidentType,
        description: parsed.description.trim().slice(0, 5000),
        location: parsed.location.trim().slice(0, 200),
        // Only well-formed values reach the form; anything odd is left for her to fill in.
        date: isDate(parsed.date, today) ? parsed.date : '',
        time: isTime(parsed.time) ? parsed.time : '',
      },
      mode: 'ai',
    };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) console.warn('[report draft] Anthropic credentials missing or invalid; using her words as they are.');
    else if (err instanceof Anthropic.APIError) console.error(`[report draft] Anthropic API error ${err.status}:`, err.message);
    else console.error('[report draft] Failed to reach Anthropic API:', err instanceof Error ? err.message : err);
    return fallback;
  }
}
