// Turns a spoken phrase into an app action. Works for English, Hindi, Tamil, Bengali and
// Marathi (and a mix of them, which is how many people speak). Matching is by keywords, so
// "please call Mom", "Mom ko call karo" and "मम्मी को कॉल करो" all work.

export type VoiceCommand =
  | { type: "sos" }
  | { type: "alarm" }
  | { type: "fakeCall" }
  | { type: "call"; name: string; phone: string }
  | { type: "timer"; minutes?: number }
  | { type: "walk" }
  | { type: "ride" }
  | { type: "map" }
  | { type: "report" }
  | { type: "chat" }
  | { type: "contacts" }
  | { type: "rights" }
  | { type: "unknown" };

type Contact = { name: string; phone: string; status?: string; relation?: string | null };

// \b doesn't work for Indian scripts, so non-Latin words are matched as plain substrings.
const any = (words: string[]) => new RegExp(words.map((w) => (/^[a-z ]+$/.test(w) ? `\\b${w}\\b` : w)).join("|"), "i");

const WORDS = {
  sos: any(["help", "help me", "sos", "emergency", "save me", "bachao", "bachao", "बचाओ", "बचाव", "मदद", "हेल्प", "உதவி", "காப்பா", "বাঁচাও", "বাচাও", "সাহায্য", "वाचवा", "मदत"]),
  alarm: any(["alarm", "siren", "अलार्म", "सायरन", "அலாரம்", "சைரன்", "অ্যালার্ম", "সাইরেন"]),
  fakeCall: any(["fake call", "pretend call", "nakli call", "नकली कॉल", "फेक कॉल", "फ़ेक कॉल", "போலி அழைப்பு", "நகல் அழைப்பு", "নকল কল", "ফেক কল", "खोटा कॉल", "बनावट कॉल"]),
  call: any(["call", "phone", "dial", "ring", "कॉल", "फ़ोन", "फोन", "அழை", "கால்", "কল", "ফোন", "कॉल"]),
  police: any(["police", "112", "ambulance", "emergency number", "पुलिस", "एम्बुलेंस", "காவல்", "போலீஸ்", "ஆம்புலன்ஸ்", "পুলিশ", "অ্যাম্বুলেন্স", "पोलीस", "रुग्णवाहिका"]),
  womenHelpline: any(["women helpline", "helpline", "181", "महिला हेल्पलाइन", "हेल्पलाइन", "உதவி எண்", "হেল্পলাইন", "हेल्पलाइन"]),
  timer: any(["timer", "टाइमर", "டைமர்", "টাইমার", "टायमर"]),
  hours: any(["hour", "hours", "hr", "घंटा", "घंटे", "மணி", "ঘণ্টা", "तास"]),
  ride: any(["cab", "taxi", "auto", "uber", "ola", "rapido", "कैब", "टैक्सी", "ऑटो", "கேப்", "டாக்ஸி", "ஆட்டோ", "ক্যাব", "ট্যাক্সি", "অটো", "कॅब", "टॅक्सी", "रिक्षा"]),
  walk: any(["walk", "walking", "share my location", "share location", "journey", "going home", "साथ चलो", "लोकेशन शेयर", "सफ़र", "सफर", "நட", "பயணம்", "இருப்பிடம் பகிர்", "চলো", "হাঁট", "যাত্রা", "লোকেশন শেয়ার", "चाल", "प्रवास", "लोकेशन शेअर"]),
  map: any(["map", "nearby", "police station", "hospital", "pharmacy", "नक्शा", "मैप", "अस्पताल", "थाना", "வரைபடம்", "மருத்துவமனை", "மருந்தகம்", "মানচিত্র", "ম্যাপ", "হাসপাতাল", "থানা", "नकाशा", "रुग्णालय", "मॅप"]),
  report: any(["report", "complain", "complaint", "रिपोर्ट", "शिकायत", "புகார்", "রিপোর্ট", "অভিযোগ", "तक्रार"]),
  chat: any(["chat", "talk", "counsel", "चैट", "बात", "அரட்டை", "பேச", "চ্যাট", "কথা", "चॅट", "बोल"]),
  contacts: any(["contacts", "contact list", "संपर्क", "தொடர்பு", "পরিচিত", "যোগাযোগ"]),
  rights: any(["rights", "legal", "अधिकार", "कानून", "உரிமை", "சட்ட", "অধিকার", "আইন", "हक्क", "कायदा"]),
};

// Spoken numbers often come back as digits; a few common words too.
const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, "forty five": 45, sixty: 60, ninety: 90,
  half: 0.5, "आधा": 0.5, "एक": 1, "दो": 2, "तीन": 3, "दस": 10, "पंद्रह": 15, "बीस": 20, "तीस": 30,
};

function spokenMinutes(text: string): number | undefined {
  const lower = text.toLowerCase();
  let n: number | undefined;
  const digits = /(\d+(?:\.\d+)?)/.exec(lower);
  if (digits) n = Number(digits[1]);
  else for (const [word, value] of Object.entries(NUMBER_WORDS)) if (lower.includes(word)) n = value;
  if (n === undefined) return WORDS.hours.test(lower) ? 60 : undefined;
  return Math.round(WORDS.hours.test(lower) ? n * 60 : n);
}

// Family words in every supported language, so "call Mom", "मम्मी को कॉल करो" and
// "அம்மாவை அழை" all find a contact named "Mom" or with the relation "Mother".
const RELATIONS: string[][] = [
  ["mom", "mother", "mum", "mummy", "mommy", "maa", "ma", "माँ", "मां", "मम्मी", "माता", "அம்மா", "মা", "মাম্মি", "आई"],
  ["dad", "father", "papa", "daddy", "पापा", "पिता", "पिताजी", "அப்பா", "বাবা", "बाबा", "वडील"],
  ["sister", "sis", "didi", "बहन", "दीदी", "அக்கா", "தங்கை", "সিস্টার", "বোন", "দিদি", "बहीण", "ताई"],
  ["brother", "bro", "bhai", "bhaiya", "भाई", "भैया", "அண்ணா", "தம்பி", "ভাই", "দাদা", "भाऊ", "दादा"],
  ["husband", "पति", "கணவர்", "স্বামী", "नवरा"],
  ["friend", "दोस्त", "सहेली", "தோழி", "நண்பர்", "বন্ধু", "मैत्रीण", "मित्र"],
];
const hasWord = (text: string, word: string) =>
  /^[a-z]+$/.test(word) ? new RegExp(`\\b${word}\\b`, "i").test(text) : text.includes(word);

// A contact named in the phrase: full name, first name, or a family word matching their name
// or relation. Compared without case.
function findContact(text: string, contacts: Contact[]): Contact | undefined {
  const lower = text.toLowerCase();
  const usable = contacts.filter((c) => c.status !== "declined");
  const byName =
    usable.find((c) => lower.includes(c.name.toLowerCase())) ??
    usable.find((c) => {
      const first = c.name.trim().split(/\s+/)[0]?.toLowerCase();
      return first && first.length >= 2 && lower.includes(first);
    });
  if (byName) return byName;
  for (const group of RELATIONS) {
    if (!group.some((w) => hasWord(lower, w))) continue;
    const match = usable.find((c) => group.some((w) => hasWord(c.name.toLowerCase(), w) || hasWord((c.relation ?? "").toLowerCase(), w)));
    if (match) return match;
  }
  return undefined;
}

export function parseCommand(candidates: string[], contacts: Contact[], emergencyNumber = "112"): VoiceCommand {
  // Try each of the recognizer's guesses; the first that means something wins.
  for (const raw of candidates) {
    const text = raw.trim();
    if (!text) continue;
    if (WORDS.fakeCall.test(text)) return { type: "fakeCall" };
    if (WORDS.call.test(text)) {
      if (WORDS.police.test(text)) return { type: "call", name: emergencyNumber, phone: emergencyNumber };
      if (WORDS.womenHelpline.test(text)) return { type: "call", name: "181", phone: "181" };
      const contact = findContact(text, contacts);
      if (contact) return { type: "call", name: contact.name, phone: contact.phone };
    }
    if (WORDS.sos.test(text) && !WORDS.rights.test(text) && !WORDS.womenHelpline.test(text)) return { type: "sos" };
    if (WORDS.alarm.test(text)) return { type: "alarm" };
    if (WORDS.timer.test(text)) return { type: "timer", minutes: spokenMinutes(text) };
    if (WORDS.ride.test(text)) return { type: "ride" };
    if (WORDS.walk.test(text)) return { type: "walk" };
    if (WORDS.map.test(text)) return { type: "map" };
    if (WORDS.report.test(text)) return { type: "report" };
    if (WORDS.rights.test(text) || WORDS.womenHelpline.test(text)) return { type: "rights" };
    if (WORDS.contacts.test(text)) return { type: "contacts" };
    if (WORDS.chat.test(text)) return { type: "chat" };
  }
  return { type: "unknown" };
}
