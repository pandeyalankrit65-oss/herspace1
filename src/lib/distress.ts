// Spots signs of danger or self-harm in what someone types into the support chat, in the app's
// five languages (and romanised Hindi), so the chat can offer SOS or a helpline at once, before
// any reply and even offline. Self-harm is checked first: "kill myself" is not danger from
// someone else. The server's scripted fallback replies use the same lists (server/src/distress.ts).

export type Distress = "danger" | "self_harm";

const SELF_HARM = [
  // English
  /suicid/,
  /self.?harm/,
  /kill(ing)? myself/,
  /end (my life|it all)/,
  /want to die/,
  /(don'?t|do not) want to (live|be alive)/,
  /no reason to live/,
  /(hurt|cut)(ting)? myself/,
  // Hindi and romanised Hindi
  /आत्महत्या/,
  /खुद को (नुकसान|मार)/,
  /मरना चाहत/,
  /जीना नहीं/,
  /जीने का मन नहीं/,
  /marna chaht/,
  /mar jana chaht/,
  /jeena nahi/,
  /khud ko (maar|nuksan)/,
  // Tamil
  /தற்கொலை/,
  /சாக வேண்டும்/,
  /சாகணும்/,
  /வாழ விருப்பமில்லை/,
  // Bengali
  /আত্মহত্যা/,
  /মরে যেতে চাই/,
  /মরতে চাই/,
  /বাঁচতে চাই না/,
  // Marathi
  /मरायचं/,
  /मरावंसं वाटत/,
  /जगायचं नाही/,
];

const DANGER = [
  // English
  /follow(ing|ed)? me/,
  /someone('s| is) (outside|following|watching|at (my|the) door|in my (house|room))/,
  /(he|they)('s| is| are) (here|coming|hitting|beating)/,
  /(attack|hit|hurt|grab|chas|touch)(ing|ed|bed|ed)? me/,
  /in danger/,
  /not safe/,
  /unsafe/,
  /scared for my life/,
  /(locked|trapped) (me )?in/,
  /won'?t let me (go|leave)/,
  /please help/,
  /^help\W*$/,
  /^help me\W*$/,
  // Hindi and romanised Hindi
  /बचाओ/,
  /पीछा कर/,
  /खतरे में/,
  /मार रहा/,
  /डर लग रहा/,
  /मदद करो/,
  /bachao/,
  /p(ee|i)chh?a kar/,
  /khatre m(e|ei)n/,
  /maar raha/,
  /dar lag raha/,
  /madad karo/,
  // Tamil
  /காப்பா(த்|ற்)று/,
  /பின்தொடர்/,
  /ஆபத்தில்/,
  /பயமா இருக்கு/,
  // Bengali
  /বাঁচাও/,
  /পিছু নিচ্ছে/,
  /বিপদে/,
  /ভয় লাগছে/,
  /মারছে/,
  // Marathi
  /वाचवा/,
  /पाठलाग/,
  /धोक्यात/,
  /भीती वाटत/,
  /मारत आहे/,
];

export function detectDistress(text: string): Distress | null {
  const t = text.toLowerCase().trim();
  if (!t) return null;
  if (SELF_HARM.some((r) => r.test(t))) return "self_harm";
  if (DANGER.some((r) => r.test(t))) return "danger";
  return null;
}
