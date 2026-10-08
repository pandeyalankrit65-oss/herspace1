import { detectDistress } from './distress';

// How someone in the support chat seems to be feeling, so the chat can adapt: calmer and
// shorter when she's panicking, SOS and help when she's afraid. Claude judges it when the AI is
// available; otherwise these word lists (in the app's five languages) give a rougher guess.
export const EMOTIONS = ['fear', 'panic', 'sadness', 'anger', 'calm', 'other'] as const;
export const INTENSITIES = ['low', 'medium', 'high'] as const;
export const URGENCIES = ['none', 'support', 'danger', 'self_harm'] as const;

export type Emotion = {
  label: (typeof EMOTIONS)[number];
  intensity: (typeof INTENSITIES)[number];
  urgency: (typeof URGENCIES)[number];
  // Who judged it: the AI, or the word lists.
  source: 'ai' | 'words';
};

const WORDS: Record<'fear' | 'panic' | 'sadness' | 'anger', RegExp[]> = {
  fear: [
    /scared|afraid|frighten|terrified|fear|unsafe|not safe/,
    /डर|भय/,
    /dar lag|darr|dar rahi/,
    /பயம|பயமா/,
    /ভয়/,
    /भीती/,
  ],
  panic: [
    /panic|can'?t breathe|heart (is )?racing|shaking|anxious|anxiety/,
    /घबराहट|बेचैन|सांस नहीं/,
    /ghabrahat|bechain/,
    /பதற்ற|மூச்சு விட முடிய/,
    /আতঙ্ক|উদ্বেগ|দম বন্ধ/,
    /घबराट|श्वास घेता येत नाही/,
  ],
  sadness: [
    /sad|lonely|alone|crying|depressed|hopeless|empty|worthless/,
    /उदास|अकेल|रो रही|निराश/,
    /udaas|udas|akeli|ro rahi/,
    /சோக|தனிமை|அழுகிறேன்/,
    /দুঃখ|একা|কাঁদছি|হতাশ/,
    /एकटी|रडते|निराश/,
  ],
  anger: [/angry|furious|so mad|hate (him|them|this)|fed up/, /गुस्सा|नफ़रत/, /gussa/, /கோபம/, /রাগ/, /राग|संताप/],
};

const INTENSIFIERS = /very|so |really|extremely|can'?t (take|stop)|बहुत|bahut|ரொம்ப|খুব|खूप|!!/;

export function emotionFromWords(text: string): Emotion {
  const t = text.toLowerCase();
  const distress = detectDistress(t);
  const urgency: Emotion['urgency'] = distress ?? 'none';
  const scores = (Object.keys(WORDS) as Array<keyof typeof WORDS>).map((label) => ({
    label,
    hits: WORDS[label].filter((r) => r.test(t)).length,
  }));
  const top = scores.sort((a, b) => b.hits - a.hits)[0];
  // Danger reads as fear even when no fear word was used ("he's following me").
  const label: Emotion['label'] = top.hits > 0 ? top.label : distress === 'danger' ? 'fear' : distress === 'self_harm' ? 'sadness' : 'other';
  const intensity: Emotion['intensity'] = distress ? 'high' : INTENSIFIERS.test(t) || top.hits > 1 ? 'medium' : 'low';
  return { label, intensity, urgency: urgency === 'none' && top.hits > 0 && intensity !== 'low' ? 'support' : urgency, source: 'words' };
}
