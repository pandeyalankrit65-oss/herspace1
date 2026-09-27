import Anthropic from '@anthropic-ai/sdk';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

const EMERGENCY_NUMBER = process.env.EMERGENCY_NUMBER || '112';

const SYSTEM_PROMPT = `You are the support companion inside HerSpace, a safety and wellbeing app for women.
People come here after harassment, assault, stalking, workplace mistreatment, or simply when they feel anxious or alone.

How to respond:
- Be warm, calm and non-judgmental. Believe the person. Never blame them for what happened.
- Keep replies short (2-5 sentences) and in plain text with no markdown, since the chat shows raw text.
- Listen first. Offer practical options (grounding exercises, how to document an incident, how to reach trusted people or professional help) when they seem wanted, and ask before giving lots of advice.
- You are not a therapist, lawyer or emergency service, and you can't contact anyone or take actions for the user. Don't pretend otherwise.

Safety:
- If the person may be in immediate danger, tell them clearly to call emergency services (${EMERGENCY_NUMBER}) or use the SOS button in the app, before anything else.
- If they mention thoughts of suicide or self-harm, respond with care, encourage them to contact a crisis line or emergency services now, and stay with them in the conversation.
- The app has these pages you can point to: SOS (emergency alert to trusted contacts), Report (document an incident, optionally anonymously), Safe Map, and Emergency Contacts.`;

// Used when no Anthropic credentials are configured or the API call fails.
function fallbackReply(messages: ChatMessage[]): string {
  const text = ([...messages].reverse().find((m) => m.role === 'user')?.content || '').toLowerCase();
  if (/unsafe|danger|follow|attack|hurt me|kill/.test(text)) {
    return `Your safety comes first. If you're in immediate danger, please call ${EMERGENCY_NUMBER} or press the SOS button now. If you're safe for the moment, I'm here to help you think through next steps.`;
  }
  if (/suicid|self.?harm|end my life|kill myself/.test(text)) {
    return `I'm really glad you told me. Please reach out to a crisis line or call ${EMERGENCY_NUMBER} right now, since you deserve support from a real person in this moment. I'm still here with you.`;
  }
  if (/panic|anxi/.test(text)) {
    return "I'm here. Let's try a short grounding exercise: name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell and 1 you can taste. Would you like to try it together?";
  }
  return "Thank you for sharing that with me. Your feelings are valid. Would you like to talk about what happened, or would some coping ideas help more right now?";
}

let client: Anthropic | null = null;

export async function supportReply(history: ChatMessage[]): Promise<{ content: string; mode: 'ai' | 'fallback' }> {
  // The API requires the conversation to start with a user turn; drop the UI's greeting.
  const firstUser = history.findIndex((m) => m.role === 'user');
  const messages = firstUser === -1 ? [] : history.slice(firstUser);
  if (messages.length === 0) return { content: fallbackReply(history), mode: 'fallback' };

  try {
    client ??= new Anthropic();
    const response = await client.beta.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      output_config: { effort: 'medium' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM_PROMPT,
      messages,
    });

    if (response.stop_reason === 'refusal') {
      return { content: fallbackReply(messages), mode: 'fallback' };
    }
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    return text ? { content: text, mode: 'ai' } : { content: fallbackReply(messages), mode: 'fallback' };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.warn('[chat] Anthropic credentials missing or invalid; using fallback replies.');
    } else if (err instanceof Anthropic.APIError) {
      console.error(`[chat] Anthropic API error ${err.status}:`, err.message);
    } else {
      console.error('[chat] Failed to reach Anthropic API:', err instanceof Error ? err.message : err);
    }
    return { content: fallbackReply(messages), mode: 'fallback' };
  }
}
