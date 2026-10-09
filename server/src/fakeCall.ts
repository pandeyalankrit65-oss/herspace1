import Anthropic from '@anthropic-ai/sdk';
import { takeAiBudget } from './aiBudget';
import type { ChatMessage, Lang } from './chat';

// The fake call's caller, talking back. It has to sound like a real person on the phone and
// answer within a second or two, so: a fast model, one or two short sentences, plain text.
const MODEL = 'claude-haiku-4-5-20251001';

const LANGUAGE: Record<Lang, string> = { en: 'English', hi: 'Hindi', ta: 'Tamil', bn: 'Bengali', mr: 'Marathi' };

const systemPrompt = (caller: string, lang: Lang) => `You are ${caller}, a close relative or friend, on a phone call with a woman. She started this call from a safety app as a reason to leave, or to look busy, because she may feel uncomfortable or unsafe where she is. People near her may hear your side through her phone's speaker.

Talk like a real person on the phone in ${LANGUAGE[lang]}: warm, familiar, a little urgent, as if you're expecting her and you're nearby or already on your way. Ask where she is, tell her to stay where there are people and lights, say you'll wait on the line. Give her easy reasons to leave ("Mum's waiting", "come now, dinner's ready").

Rules:
- One or two short sentences per turn. Plain spoken words only: no stage directions, emojis, quotes or lists.
- Never say you're an AI, an app or a script, and never mention HerSpace.
- Don't threaten anyone or say anything that could make a situation worse if overheard.
- If she sounds frightened or says she's in danger, stay calm: say you're coming now and staying on the line, and tell her to move towards people. Don't claim you've called the police.
- If what she says isn't clear (speech recognition makes mistakes), carry on naturally rather than asking her to repeat.`;

// Without the AI: a natural sequence of caller lines, in turn.
const FALLBACK: Record<Lang, string[]> = {
  en: [
    "Where are you exactly? I'm nearly there.",
    'Okay, stay where there are people. I can see the main road.',
    "Keep talking to me, I'm two minutes away.",
    "Mum keeps asking when you'll be home. Start walking, I'll meet you.",
    "I'm right here, just stay on the line with me.",
  ],
  hi: [
    'तुम ठीक कहाँ हो? मैं बस पहुँचने वाला हूं।',
    'ठीक है, जहाँ लोग हैं वहीं रहो। मुझे मेन रोड दिख रही है।',
    'मुझसे बात करती रहो, मैं दो मिनट में पहुँच रहा हूं।',
    'मम्मी बार-बार पूछ रही हैं कि तुम कब आओगी। चलना शुरू करो, मैं मिलता हूं।',
    'मैं यहीं हूं, बस फ़ोन पर बनी रहो।',
  ],
  ta: [
    'நீ சரியாக எங்கே இருக்கிறாய்? நான் கிட்டத்தட்ட வந்துவிட்டேன்.',
    'சரி, மக்கள் இருக்கும் இடத்திலேயே இரு. எனக்கு மெயின் ரோடு தெரிகிறது.',
    'என்னிடம் பேசிக்கொண்டே இரு, இரண்டு நிமிடத்தில் வந்துவிடுவேன்.',
    'அம்மா நீ எப்போது வருவாய் என்று கேட்டுக்கொண்டே இருக்கிறார். நடக்க ஆரம்பி, நான் வந்து சந்திக்கிறேன்.',
    'நான் இங்கேதான் இருக்கிறேன், லைனிலேயே இரு.',
  ],
  bn: [
    'তুমি ঠিক কোথায় আছ? আমি প্রায় পৌঁছে গেছি।',
    'ঠিক আছে, যেখানে লোকজন আছে সেখানেই থাকো। আমি বড় রাস্তাটা দেখতে পাচ্ছি।',
    'আমার সঙ্গে কথা বলতে থাকো, দু মিনিটে পৌঁছচ্ছি।',
    'মা বারবার জিজ্ঞেস করছে তুমি কখন ফিরবে। হাঁটা শুরু করো, আমি এসে দেখা করছি।',
    'আমি এখানেই আছি, শুধু ফোনে থাকো।',
  ],
  mr: [
    'तू नक्की कुठे आहेस? मी जवळजवळ पोहोचलोय.',
    'ठीक आहे, जिथे लोक आहेत तिथेच थांब. मला मुख्य रस्ता दिसतोय.',
    'माझ्याशी बोलत राहा, मी दोन मिनिटांत पोहोचतोय.',
    'आई सारखी विचारतेय तू कधी येणार. चालायला सुरुवात कर, मी भेटतो.',
    'मी इथेच आहे, फक्त फोनवर राहा.',
  ],
};

let client: Anthropic | undefined;

export type CallerReply = { content: string; mode: 'ai' | 'fallback' };

const fallback = (history: ChatMessage[], lang: Lang): CallerReply => {
  const lines = FALLBACK[lang];
  const turn = history.filter((m) => m.role === 'assistant').length;
  return { content: lines[turn % lines.length], mode: 'fallback' };
};

export async function callerReply(history: ChatMessage[], caller: string, lang: Lang = 'en'): Promise<CallerReply> {
  // The API needs the conversation to start with her; the caller's opening line is dropped.
  const firstUser = history.findIndex((m) => m.role === 'user');
  const messages = firstUser === -1 ? [] : history.slice(firstUser);
  if (messages.length === 0) return fallback(history, lang);
  if (!takeAiBudget()) return fallback(messages, lang);
  try {
    client ??= new Anthropic();
    const response = await client.messages.create(
      { model: MODEL, max_tokens: 200, system: systemPrompt(caller, lang), messages },
      // A slow answer sounds wrong on a call: give up and use a scripted line.
      { timeout: 6000, maxRetries: 0 }
    );
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join(' ')
      .trim();
    if (response.stop_reason === 'refusal' || !text) return fallback(messages, lang);
    return { content: text, mode: 'ai' };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) console.warn('[fake call] Anthropic credentials missing or invalid; using scripted lines.');
    else if (err instanceof Anthropic.APIError) console.error(`[fake call] Anthropic API error ${err.status}:`, err.message);
    else console.error('[fake call] Failed to reach Anthropic API:', err instanceof Error ? err.message : err);
    return fallback(messages, lang);
  }
}
