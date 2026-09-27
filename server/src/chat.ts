import Anthropic from '@anthropic-ai/sdk';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

const EMERGENCY_NUMBER = process.env.EMERGENCY_NUMBER || '112';

const SYSTEM_PROMPT = `You are the support companion inside HerSpace, a safety and wellbeing app for women.
People come here after harassment, assault, stalking, workplace mistreatment, or simply when they feel anxious or alone.

How to respond:
- Be warm, calm and non-judgmental. Believe the person. Never blame them for what happened.
- Keep replies short (2-5 sentences) and in plain text with no markdown, since the chat shows raw text.
- Reply in the language the person writes in (for example Hindi, Hinglish or English).
- Listen first. Offer practical options (grounding exercises, how to document an incident, how to reach trusted people or professional help) when they seem wanted, and ask before giving lots of advice.
- You are not a therapist, lawyer or emergency service, and you can't contact anyone or take actions for the user. Don't pretend otherwise.

Safety:
- If the person may be in immediate danger, tell them clearly to call emergency services (${EMERGENCY_NUMBER}) or use the SOS button in the app, before anything else.
- If they mention thoughts of suicide or self-harm, respond with care, encourage them to contact a crisis line or emergency services now, and stay with them in the conversation.
- The app has these pages you can point to: SOS (emergency alert to trusted contacts), Report (document an incident, optionally anonymously), Safe Map, and Emergency Contacts.`;

export type Lang = 'en' | 'hi';

const FALLBACK: Record<Lang, Record<'selfHarm' | 'danger' | 'panic' | 'default', string>> = {
  en: {
    selfHarm: `I'm really glad you told me. Please reach out to a crisis line or call ${EMERGENCY_NUMBER} right now, since you deserve support from a real person in this moment. I'm still here with you.`,
    danger: `Your safety comes first. If you're in immediate danger, please call ${EMERGENCY_NUMBER} or press the SOS button now. If you're safe for the moment, I'm here to help you think through next steps.`,
    panic: "I'm here. Let's try a short grounding exercise: name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell and 1 you can taste. Would you like to try it together?",
    default: 'Thank you for sharing that with me. Your feelings are valid. Would you like to talk about what happened, or would some coping ideas help more right now?',
  },
  hi: {
    selfHarm: `मुझे बहुत अच्छा लगा कि आपने मुझे बताया। कृपया अभी किसी क्राइसिस हेल्पलाइन (जैसे टेली-मानस 14416) से संपर्क करें या ${EMERGENCY_NUMBER} पर कॉल करें। इस पल में आपको किसी इंसान का साथ मिलना चाहिए। मैं भी आपके साथ हूं।`,
    danger: `आपकी सुरक्षा सबसे पहले है। अगर आप तुरंत खतरे में हैं, तो अभी ${EMERGENCY_NUMBER} पर कॉल करें या SOS बटन दबाएं। अगर आप इस समय सुरक्षित हैं, तो मैं आगे के कदम सोचने में आपकी मदद कर सकती हूं।`,
    panic: 'मैं यहां हूं। चलिए एक छोटा ग्राउंडिंग अभ्यास करते हैं: 5 चीज़ें जो आप देख सकती हैं, 4 जिन्हें छू सकती हैं, 3 जो सुन सकती हैं, 2 जिनकी गंध ले सकती हैं और 1 जिसका स्वाद ले सकती हैं। क्या आप साथ में करना चाहेंगी?',
    default: 'मुझसे यह साझा करने के लिए धन्यवाद। आपकी भावनाएं जायज़ हैं। क्या आप बताना चाहेंगी कि क्या हुआ, या अभी संभलने के कुछ तरीके ज़्यादा मदद करेंगे?',
  },
};

// Used when no Anthropic credentials are configured or the API call fails.
// Self-harm is checked first: "kill myself" must not be treated as danger from someone else.
export function fallbackReply(messages: ChatMessage[], lang: Lang = 'en'): string {
  const text = ([...messages].reverse().find((m) => m.role === 'user')?.content || '').toLowerCase();
  const replies = FALLBACK[lang];
  if (/suicid|self.?harm|end my life|kill myself|want to die|आत्महत्या|खुद को नुकसान|मरना चाहती|जीना नहीं/.test(text)) return replies.selfHarm;
  if (/unsafe|danger|follow|attack|hurt me|kill|खतरा|खतरे|पीछा|हमला|बचाओ|डर लग/.test(text)) return replies.danger;
  if (/panic|anxi|घबराहट|चिंता|बेचैन/.test(text)) return replies.panic;
  return replies.default;
}

let client: Anthropic | null = null;

export async function supportReply(history: ChatMessage[], lang: Lang = 'en'): Promise<{ content: string; mode: 'ai' | 'fallback' }> {
  // The API requires the conversation to start with a user turn; drop the UI's greeting.
  const firstUser = history.findIndex((m) => m.role === 'user');
  const messages = firstUser === -1 ? [] : history.slice(firstUser);
  if (messages.length === 0) return { content: fallbackReply(history, lang), mode: 'fallback' };

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
      return { content: fallbackReply(messages, lang), mode: 'fallback' };
    }
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    return text ? { content: text, mode: 'ai' } : { content: fallbackReply(messages, lang), mode: 'fallback' };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.warn('[chat] Anthropic credentials missing or invalid; using fallback replies.');
    } else if (err instanceof Anthropic.APIError) {
      console.error(`[chat] Anthropic API error ${err.status}:`, err.message);
    } else {
      console.error('[chat] Failed to reach Anthropic API:', err instanceof Error ? err.message : err);
    }
    return { content: fallbackReply(messages, lang), mode: 'fallback' };
  }
}
