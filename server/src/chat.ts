import Anthropic from '@anthropic-ai/sdk';
import { takeAiBudget } from './aiBudget';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import * as z4 from 'zod/v4';
import { detectDistress } from './distress';
import { EMOTIONS, emotionFromWords, INTENSITIES, URGENCIES, type Emotion } from './emotion';

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
- Notice how she feels and adapt: if she's panicking, use very short, calm sentences and one small step at a time (a slow breath, then the next thing); if she's afraid, put her safety and options first; if she's sad or alone, slow down and listen; if she's angry, acknowledge it as fair before anything else.
- Also report the main emotion in her latest message, how strong it seems, and how urgent her situation is. The app uses this to offer SOS, a helpline or a breathing exercise beside your reply, so judge urgency carefully and don't mention these labels in the reply itself.

Safety:
- If the person may be in immediate danger, tell them clearly to call emergency services (${EMERGENCY_NUMBER}) or use the SOS button in the app, before anything else.
- If they mention thoughts of suicide or self-harm, respond with care, encourage them to contact a crisis line or emergency services now, and stay with them in the conversation.
- In India, Tele-MANAS (14416, free, 24x7) is the national mental health helpline; point to it for suicidal thoughts or overwhelming distress.
- The app has these pages you can point to: SOS (emergency alert to trusted contacts), Report (document an incident, optionally anonymously), Safe Map, Emergency Contacts, Walk with me (share a journey live), Well-being (breathing and grounding exercises), Expert help (checked counsellors and lawyers), and Help & rights (helplines and legal guidance).`;

export type Lang = 'en' | 'hi' | 'ta' | 'bn' | 'mr';

const FALLBACK: Record<Lang, Record<'selfHarm' | 'danger' | 'panic' | 'default', string>> = {
  en: {
    selfHarm: `I'm really glad you told me. Please reach out to a crisis line like Tele-MANAS (14416) or call ${EMERGENCY_NUMBER} right now, since you deserve support from a real person in this moment. I'm still here with you.`,
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
  ta: {
    selfHarm: `நீங்கள் என்னிடம் சொன்னதில் எனக்கு மிகவும் மகிழ்ச்சி. தயவுசெய்து இப்போதே டெலி-மனஸ் 14416-ஐ அழையுங்கள் அல்லது ${EMERGENCY_NUMBER}-ஐ அழையுங்கள். இந்த நேரத்தில் ஒரு மனிதரின் துணை உங்களுக்குத் தேவை. நானும் உங்களுடன் இருக்கிறேன்.`,
    danger: `உங்கள் பாதுகாப்பே முதன்மை. நீங்கள் உடனடி ஆபத்தில் இருந்தால், இப்போதே ${EMERGENCY_NUMBER}-ஐ அழையுங்கள் அல்லது SOS பொத்தானை அழுத்துங்கள். இப்போது பாதுகாப்பாக இருந்தால், அடுத்து என்ன செய்வது என்று யோசிக்க நான் உதவுகிறேன்.`,
    panic: 'நான் இங்கே இருக்கிறேன். ஒரு சிறிய பயிற்சி செய்வோம்: நீங்கள் பார்க்கக்கூடிய 5, தொடக்கூடிய 4, கேட்கக்கூடிய 3, நுகரக்கூடிய 2, சுவைக்கக்கூடிய 1 பொருளைச் சொல்லுங்கள். சேர்ந்து செய்யலாமா?',
    default: 'என்னிடம் பகிர்ந்ததற்கு நன்றி. உங்கள் உணர்வுகள் நியாயமானவை. என்ன நடந்தது என்று பேச விரும்புகிறீர்களா, அல்லது இப்போது சமாளிக்கச் சில வழிகள் உதவுமா?',
  },
  bn: {
    selfHarm: `আপনি আমাকে বলেছেন বলে আমি সত্যিই খুশি। দয়া করে এখনই টেলি-মানস 14416-এ বা ${EMERGENCY_NUMBER}-এ কল করুন। এই মুহূর্তে একজন মানুষের সাহায্য আপনার প্রাপ্য। আমিও আপনার সঙ্গে আছি।`,
    danger: `আপনার নিরাপত্তাই সবার আগে। আপনি এখনই বিপদে থাকলে ${EMERGENCY_NUMBER}-এ কল করুন বা SOS বোতাম টিপুন। এই মুহূর্তে নিরাপদ থাকলে, পরের পদক্ষেপ ভাবতে আমি সাহায্য করতে পারি।`,
    panic: 'আমি এখানে আছি। চলুন একটা ছোট অনুশীলন করি: দেখতে পাচ্ছেন এমন 5টি, ছুঁতে পারেন এমন 4টি, শুনতে পাচ্ছেন এমন 3টি, গন্ধ পাচ্ছেন এমন 2টি আর স্বাদ পাচ্ছেন এমন 1টি জিনিসের নাম বলুন। একসঙ্গে করবেন?',
    default: 'আমার সঙ্গে শেয়ার করার জন্য ধন্যবাদ। আপনার অনুভূতি স্বাভাবিক। কী হয়েছিল বলতে চান, নাকি এখন সামলানোর কিছু উপায় বেশি কাজে আসবে?',
  },
  mr: {
    selfHarm: `तुम्ही मला सांगितलंत याचा मला खरंच आनंद आहे. कृपया आत्ताच टेली-मानस 14416 वर किंवा ${EMERGENCY_NUMBER} वर कॉल करा. या क्षणी एखाद्या माणसाची साथ तुम्हाला मिळायला हवी. मीही तुमच्यासोबत आहे.`,
    danger: `तुमची सुरक्षा सर्वात आधी. तुम्ही आत्ता धोक्यात असाल तर ${EMERGENCY_NUMBER} वर कॉल करा किंवा SOS बटण दाबा. आत्ता सुरक्षित असाल तर पुढे काय करायचे याचा विचार करायला मी मदत करू शकते.`,
    panic: 'मी इथे आहे. एक छोटा सराव करूया: दिसणाऱ्या 5, स्पर्श करता येणाऱ्या 4, ऐकू येणाऱ्या 3, वास घेता येणाऱ्या 2 आणि चव घेता येणाऱ्या 1 गोष्टीचे नाव घ्या. एकत्र करूया?',
    default: 'माझ्याशी हे शेअर केल्याबद्दल धन्यवाद. तुमच्या भावना योग्य आहेत. काय झालं ते सांगायला आवडेल का, की आत्ता सावरण्याचे काही मार्ग जास्त उपयोगी पडतील?',
  },
};

// Used when no Anthropic credentials are configured or the API call fails.
// Self-harm is checked first: "kill myself" must not be treated as danger from someone else.
export function fallbackReply(messages: ChatMessage[], lang: Lang = 'en'): string {
  const text = ([...messages].reverse().find((m) => m.role === 'user')?.content || '').toLowerCase();
  const replies = FALLBACK[lang];
  const distress = detectDistress(text);
  if (distress === 'self_harm') return replies.selfHarm;
  if (distress === 'danger' || /danger|attack|kill|खतरा|हमला/.test(text)) return replies.danger;
  if (/panic|anxi|घबराहट|चिंता|बेचैन|பதற்ற|பயம்|আতঙ্ক|উদ্বেগ|घबराट|चिंता/.test(text)) return replies.panic;
  return replies.default;
}

let client: Anthropic | null = null;

export type SupportReply = { content: string; mode: 'ai' | 'fallback'; emotion: Emotion };

// One request returns the reply and Claude's reading of how she seems (structured output), so
// the app can adapt: calmer replies and a breathing step for panic, SOS for fear or danger.
const ReplySchema = z4.object({
  reply: z4.string().describe('The reply to show her: plain text, no markdown, in her language.'),
  emotion: z4.enum(EMOTIONS).describe('The main emotion in her latest message.'),
  intensity: z4.enum(INTENSITIES).describe('How strongly she seems to feel it.'),
  urgency: z4
    .enum(URGENCIES)
    .describe('none; support (she would benefit from help or a helpline); danger (she may be in danger from someone now); self_harm (thoughts of suicide or self-harm).'),
});

const lastUserText = (messages: ChatMessage[]) => [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';

const fallback = (messages: ChatMessage[], lang: Lang): SupportReply => ({
  content: fallbackReply(messages, lang),
  mode: 'fallback',
  emotion: emotionFromWords(lastUserText(messages)),
});

export async function supportReply(history: ChatMessage[], lang: Lang = 'en'): Promise<SupportReply> {
  // The API requires the conversation to start with a user turn; drop the UI's greeting.
  const firstUser = history.findIndex((m) => m.role === 'user');
  const messages = firstUser === -1 ? [] : history.slice(firstUser);
  if (messages.length === 0) return fallback(history, lang);
  if (!takeAiBudget()) return fallback(messages, lang);

  try {
    client ??= new Anthropic();
    const response = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      output_config: { effort: 'medium', format: betaZodOutputFormat(ReplySchema) },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM_PROMPT,
      messages,
    });

    const parsed = response.stop_reason === 'refusal' ? null : response.parsed_output;
    if (!parsed?.reply.trim()) return fallback(messages, lang);
    // The keyword check still counts: if either sees danger or self-harm, the app offers help.
    const words = emotionFromWords(lastUserText(messages));
    const urgency = parsed.urgency === 'none' && (words.urgency === 'danger' || words.urgency === 'self_harm') ? words.urgency : parsed.urgency;
    return {
      content: parsed.reply.trim(),
      mode: 'ai',
      emotion: { label: parsed.emotion, intensity: parsed.intensity, urgency, source: 'ai' },
    };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.warn('[chat] Anthropic credentials missing or invalid; using fallback replies.');
    } else if (err instanceof Anthropic.APIError) {
      console.error(`[chat] Anthropic API error ${err.status}:`, err.message);
    } else {
      console.error('[chat] Failed to reach Anthropic API:', err instanceof Error ? err.message : err);
    }
    return fallback(messages, lang);
  }
}
