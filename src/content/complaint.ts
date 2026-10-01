// Turns what the user filled in into a formal complaint letter, in any of the app's
// languages. The user can edit the result before copying, printing or emailing it.
// Tamil, Bengali and Marathi were drafted with AI assistance: have them checked by a native
// speaker with legal knowledge before launch.

export type ComplaintKind = "police" | "workplace";
export type LetterLang = "en" | "hi" | "ta" | "bn" | "mr";
export type ComplaintFields = {
  kind: ComplaintKind;
  to: string; // police station, or organisation name
  name: string;
  phone: string;
  address: string;
  date: string; // yyyy-mm-dd
  place: string;
  description: string;
  accused: string;
  witnesses: string;
  attachments: number;
};

type Template = {
  locale: string;
  to: { police: (station: string) => string; workplace: (org: string) => string; station: string; org: string };
  subject: { police: (when: string, place: string) => string; workplace: string };
  ask: { police: string; workplace: string };
  dateLabel: string;
  salutation: string;
  intro: (name: string, address: string) => string;
  placeLabel: string;
  accused: string;
  witnesses: string;
  attached: (n: number) => string;
  closing: string;
  phoneLabel: string;
  blanks: { name: string; address: string; date: string; place: string; description: string; phone: string };
};

const TEMPLATES: Record<LetterLang, Template> = {
  en: {
    locale: "en-IN",
    to: {
      police: (s) => `To,\nThe Station House Officer,\n${s}`,
      workplace: (o) => `To,\nThe Presiding Officer,\nInternal Committee (POSH),\n${o}`,
      station: "[Police station name]",
      org: "[Organisation name]",
    },
    subject: {
      police: (when, place) => `Subject: Complaint for registration of an FIR regarding an incident${when ? ` on ${when}` : ""} at ${place}`,
      workplace: "Subject: Complaint of sexual harassment at the workplace under the POSH Act, 2013",
    },
    ask: {
      police:
        "I request you to register an FIR on the basis of this complaint and take the necessary action. If the incident falls outside this police station's jurisdiction, please register a Zero FIR and transfer it to the appropriate police station. Kindly provide me with a copy of the FIR.",
      workplace:
        "I request the Committee to inquire into this complaint and take appropriate action. Please keep my identity confidential during the inquiry and ensure that I face no retaliation.",
    },
    dateLabel: "Date",
    salutation: "Sir/Madam,",
    intro: (name, address) => `I, ${name}, residing at ${address}, wish to report the following incident:`,
    placeLabel: "Place",
    accused: "Details of the accused",
    witnesses: "Witnesses",
    attached: (n) => `Attached: ${n} photo${n === 1 ? "" : "s"}`,
    closing: "Yours faithfully,",
    phoneLabel: "Phone",
    blanks: {
      name: "[your name]",
      address: "[your address]",
      date: "[date]",
      place: "[place]",
      description: "[what happened, in your own words]",
      phone: "[your phone number]",
    },
  },
  hi: {
    locale: "hi-IN",
    to: {
      police: (s) => `सेवा में,\nथाना प्रभारी (SHO),\n${s}`,
      workplace: (o) => `सेवा में,\nअध्यक्ष, आंतरिक समिति (POSH),\n${o}`,
      station: "[पुलिस स्टेशन का नाम]",
      org: "[संस्था का नाम]",
    },
    subject: {
      police: (when, place) => `विषय: ${when ? `${when} को ` : ""}${place} पर हुई घटना के संबंध में FIR दर्ज करने हेतु शिकायत`,
      workplace: "विषय: कार्यस्थल पर यौन उत्पीड़न की शिकायत (POSH अधिनियम, 2013 के तहत)",
    },
    ask: {
      police:
        "मेरा अनुरोध है कि इस शिकायत के आधार पर FIR दर्ज की जाए और आवश्यक कार्रवाई की जाए। यदि घटना किसी अन्य थाना क्षेत्र की है, तो कृपया ज़ीरो FIR दर्ज करके इसे संबंधित थाने को भेजें। कृपया मुझे FIR की एक प्रति दें।",
      workplace:
        "मेरा अनुरोध है कि समिति इस शिकायत की जांच करे और आवश्यक कार्रवाई करे। जांच के दौरान मेरी पहचान गोपनीय रखी जाए और मेरे साथ कोई प्रतिशोधात्मक व्यवहार न हो।",
    },
    dateLabel: "दिनांक",
    salutation: "महोदय/महोदया,",
    intro: (name, address) => `मैं, ${name}, निवासी ${address}, निम्नलिखित घटना की सूचना देना चाहती हूं:`,
    placeLabel: "स्थान",
    accused: "आरोपी के बारे में जानकारी",
    witnesses: "गवाह",
    attached: (n) => `संलग्न: ${n} फ़ोटो`,
    closing: "भवदीया,",
    phoneLabel: "फ़ोन",
    blanks: {
      name: "[आपका नाम]",
      address: "[आपका पता]",
      date: "[तारीख]",
      place: "[स्थान]",
      description: "[क्या हुआ, अपने शब्दों में]",
      phone: "[आपका फ़ोन नंबर]",
    },
  },
  ta: {
    locale: "ta-IN",
    to: {
      police: (s) => `பெறுநர்,\nகாவல் நிலையப் பொறுப்பு அதிகாரி (SHO),\n${s}`,
      workplace: (o) => `பெறுநர்,\nதலைமை அலுவலர், உள் புகார் குழு (POSH),\n${o}`,
      station: "[காவல் நிலையத்தின் பெயர்]",
      org: "[நிறுவனத்தின் பெயர்]",
    },
    subject: {
      police: (when, place) => `பொருள்: ${when ? `${when} அன்று ` : ""}${place} என்ற இடத்தில் நடந்த சம்பவம் தொடர்பாக FIR பதிவு செய்யக் கோரும் புகார்`,
      workplace: "பொருள்: POSH சட்டம், 2013-இன் கீழ் பணியிடத்தில் நடந்த பாலியல் துன்புறுத்தல் குறித்த புகார்",
    },
    ask: {
      police:
        "இந்தப் புகாரின் அடிப்படையில் FIR பதிவு செய்து தேவையான நடவடிக்கை எடுக்குமாறு கேட்டுக்கொள்கிறேன். சம்பவம் இந்தக் காவல் நிலைய எல்லைக்கு வெளியே நடந்திருந்தால், ஜீரோ FIR பதிவு செய்து உரிய காவல் நிலையத்துக்கு மாற்றுமாறு கேட்டுக்கொள்கிறேன். FIR-இன் நகலை எனக்கு வழங்குமாறும் கேட்டுக்கொள்கிறேன்.",
      workplace:
        "இந்தப் புகாரைக் குழு விசாரித்து உரிய நடவடிக்கை எடுக்குமாறு கேட்டுக்கொள்கிறேன். விசாரணையின்போது என் அடையாளத்தை ரகசியமாக வைத்திருக்கவும், எனக்கு எந்தப் பழிவாங்கலும் நேராமல் இருப்பதை உறுதிசெய்யவும் கேட்டுக்கொள்கிறேன்.",
    },
    dateLabel: "தேதி",
    salutation: "ஐயா/அம்மா,",
    intro: (name, address) => `${address} என்ற முகவரியில் வசிக்கும் ${name} ஆகிய நான், பின்வரும் சம்பவத்தைப் புகாரளிக்க விரும்புகிறேன்:`,
    placeLabel: "இடம்",
    accused: "குற்றம் சாட்டப்பட்டவர் பற்றிய விவரங்கள்",
    witnesses: "சாட்சிகள்",
    attached: (n) => `இணைப்பு: ${n} ${n === 1 ? "புகைப்படம்" : "புகைப்படங்கள்"}`,
    closing: "இப்படிக்கு,",
    phoneLabel: "தொலைபேசி",
    blanks: {
      name: "[உங்கள் பெயர்]",
      address: "[உங்கள் முகவரி]",
      date: "[தேதி]",
      place: "[இடம்]",
      description: "[என்ன நடந்தது, உங்கள் சொந்த வார்த்தைகளில்]",
      phone: "[உங்கள் தொலைபேசி எண்]",
    },
  },
  bn: {
    locale: "bn-IN",
    to: {
      police: (s) => `প্রতি,\nভারপ্রাপ্ত আধিকারিক (OC/SHO),\n${s}`,
      workplace: (o) => `প্রতি,\nসভাপতি, অভ্যন্তরীণ কমিটি (POSH),\n${o}`,
      station: "[থানার নাম]",
      org: "[প্রতিষ্ঠানের নাম]",
    },
    subject: {
      police: (when, place) => `বিষয়: ${when ? `${when} তারিখে ` : ""}${place}-এ ঘটা ঘটনার বিষয়ে FIR নথিভুক্ত করার জন্য অভিযোগ`,
      workplace: "বিষয়: POSH আইন, 2013 অনুযায়ী কর্মস্থলে যৌন হয়রানির অভিযোগ",
    },
    ask: {
      police:
        "আমার অনুরোধ, এই অভিযোগের ভিত্তিতে FIR নথিভুক্ত করে প্রয়োজনীয় ব্যবস্থা নেওয়া হোক। ঘটনাটি এই থানার এলাকার বাইরে ঘটে থাকলে, অনুগ্রহ করে জিরো FIR নথিভুক্ত করে সংশ্লিষ্ট থানায় পাঠান। অনুগ্রহ করে আমাকে FIR-এর একটি কপি দিন।",
      workplace:
        "আমার অনুরোধ, কমিটি এই অভিযোগের তদন্ত করে উপযুক্ত ব্যবস্থা নিক। তদন্ত চলাকালীন আমার পরিচয় গোপন রাখা হোক এবং আমার প্রতি কোনো প্রতিশোধমূলক আচরণ যেন না হয়, তা নিশ্চিত করা হোক।",
    },
    dateLabel: "তারিখ",
    salutation: "মহাশয়/মহাশয়া,",
    intro: (name, address) => `আমি, ${name}, ${address}-এর বাসিন্দা, নিম্নলিখিত ঘটনাটি জানাতে চাই:`,
    placeLabel: "স্থান",
    accused: "অভিযুক্ত সম্পর্কে তথ্য",
    witnesses: "সাক্ষী",
    attached: (n) => `সংযুক্ত: ${n}টি ছবি`,
    closing: "বিনীত,",
    phoneLabel: "ফোন",
    blanks: {
      name: "[আপনার নাম]",
      address: "[আপনার ঠিকানা]",
      date: "[তারিখ]",
      place: "[স্থান]",
      description: "[কী ঘটেছিল, আপনার নিজের ভাষায়]",
      phone: "[আপনার ফোন নম্বর]",
    },
  },
  mr: {
    locale: "mr-IN",
    to: {
      police: (s) => `प्रति,\nपोलीस ठाणे प्रभारी (SHO),\n${s}`,
      workplace: (o) => `प्रति,\nअध्यक्ष, अंतर्गत समिती (POSH),\n${o}`,
      station: "[पोलीस ठाण्याचे नाव]",
      org: "[संस्थेचे नाव]",
    },
    subject: {
      police: (when, place) => `विषय: ${when ? `${when} रोजी ` : ""}${place} येथे घडलेल्या घटनेबाबत FIR नोंदवण्यासाठी तक्रार`,
      workplace: "विषय: POSH कायदा, 2013 अंतर्गत कामाच्या ठिकाणी लैंगिक छळाची तक्रार",
    },
    ask: {
      police:
        "माझी विनंती आहे की या तक्रारीच्या आधारे FIR नोंदवून आवश्यक कारवाई करावी. घटना या पोलीस ठाण्याच्या हद्दीबाहेर घडली असल्यास, कृपया झिरो FIR नोंदवून ती संबंधित पोलीस ठाण्याकडे पाठवावी. कृपया मला FIR ची प्रत द्यावी.",
      workplace:
        "माझी विनंती आहे की समितीने या तक्रारीची चौकशी करून योग्य कारवाई करावी. चौकशीदरम्यान माझी ओळख गोपनीय ठेवावी आणि माझ्याविरुद्ध कोणतीही सूडबुद्धीची कारवाई होणार नाही याची खात्री करावी.",
    },
    dateLabel: "दिनांक",
    salutation: "महोदय/महोदया,",
    intro: (name, address) => `मी, ${name}, राहणार ${address}, पुढील घटनेची माहिती देऊ इच्छिते:`,
    placeLabel: "ठिकाण",
    accused: "आरोपीबद्दल माहिती",
    witnesses: "साक्षीदार",
    attached: (n) => `सोबत जोडलेले: ${n} फोटो`,
    closing: "आपली विश्वासू,",
    phoneLabel: "फोन",
    blanks: {
      name: "[तुमचे नाव]",
      address: "[तुमचा पत्ता]",
      date: "[तारीख]",
      place: "[ठिकाण]",
      description: "[काय घडले, तुमच्या स्वतःच्या शब्दांत]",
      phone: "[तुमचा फोन नंबर]",
    },
  },
};

export const LETTER_LANGS = Object.keys(TEMPLATES) as LetterLang[];

// "Subject:" in each language, taken from the templates themselves.
const SUBJECT_PREFIXES = LETTER_LANGS.map((code) => `${TEMPLATES[code].subject.workplace.split(":")[0]}:`);

// The letter's subject line without its label (for an email subject), if it has one.
export function letterSubject(letter: string): string | null {
  for (const line of letter.split("\n")) {
    const prefix = SUBJECT_PREFIXES.find((p) => line.startsWith(p));
    if (prefix) return line.slice(prefix.length).trim();
  }
  return null;
}

const longDate = (date: Date, locale: string) => date.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
const blank = (v: string, placeholder: string) => v.trim() || placeholder;

export function buildComplaint(f: ComplaintFields, lang: LetterLang): string {
  const l = TEMPLATES[lang];
  const when = f.date ? longDate(new Date(`${f.date}T12:00:00`), l.locale) : "";
  const place = blank(f.place, l.blanks.place);
  const name = blank(f.name, l.blanks.name);
  const police = f.kind === "police";
  return [
    police ? l.to.police(blank(f.to, l.to.station)) : l.to.workplace(blank(f.to, l.to.org)),
    "",
    `${l.dateLabel}: ${longDate(new Date(), l.locale)}`,
    "",
    police ? l.subject.police(when, place) : l.subject.workplace,
    "",
    l.salutation,
    "",
    l.intro(name, blank(f.address, l.blanks.address)),
    "",
    `${l.dateLabel}: ${when || l.blanks.date}`,
    `${l.placeLabel}: ${place}`,
    "",
    blank(f.description, l.blanks.description),
    "",
    ...(f.accused.trim() ? [`${l.accused}: ${f.accused.trim()}`, ""] : []),
    ...(f.witnesses.trim() ? [`${l.witnesses}: ${f.witnesses.trim()}`, ""] : []),
    ...(f.attachments ? [l.attached(f.attachments), ""] : []),
    police ? l.ask.police : l.ask.workplace,
    "",
    l.closing,
    name,
    `${l.phoneLabel}: ${blank(f.phone, l.blanks.phone)}`,
  ].join("\n");
}
