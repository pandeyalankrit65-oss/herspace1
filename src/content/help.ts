import type { Lang } from "@/i18n";
import { ta } from "./help-ta";
import { bn } from "./help-bn";
import { mr } from "./help-mr";

// "Help & your rights": practical guidance for India, in every app language. This is general
// information, not legal or medical advice. Review it with a lawyer or a women's-rights
// organisation before launch, and whenever laws or helplines change (see REVIEWED).

export const REVIEWED: Record<Lang, string> = { en: "September 2026", hi: "सितंबर 2026", ta: "செப்டம்பர் 2026", bn: "সেপ্টেম্বর 2026", mr: "सप्टेंबर 2026" };

export type Helpline = { number: string; label: Record<Lang, string> };

// Tap-to-call numbers. National unless noted; some states run their own as well.
export const HELPLINES: Helpline[] = [
  { number: "112", label: { en: "Emergency: police, fire, ambulance", hi: "आपातकाल: पुलिस, फ़ायर, एम्बुलेंस", ta: "அவசரம்: காவல்துறை, தீயணைப்பு, ஆம்புலன்ஸ்", bn: "জরুরি: পুলিশ, দমকল, অ্যাম্বুলেন্স", mr: "आपत्कालीन: पोलीस, अग्निशमन, रुग्णवाहिका" } },
  { number: "181", label: { en: "Women Helpline (24x7)", hi: "महिला हेल्पलाइन (24x7)", ta: "பெண்கள் உதவி எண் (24x7)", bn: "মহিলা হেল্পলাইন (24x7)", mr: "महिला हेल्पलाइन (24x7)" } },
  { number: "108", label: { en: "Ambulance (most states)", hi: "एम्बुलेंस (ज़्यादातर राज्य)", ta: "ஆம்புலன்ஸ் (பெரும்பாலான மாநிலங்கள்)", bn: "অ্যাম্বুলেন্স (বেশিরভাগ রাজ্যে)", mr: "रुग्णवाहिका (बहुतांश राज्ये)" } },
  { number: "1930", label: { en: "Cybercrime helpline", hi: "साइबर अपराध हेल्पलाइन", ta: "சைபர் குற்ற உதவி எண்", bn: "সাইবার অপরাধ হেল্পলাইন", mr: "सायबर गुन्हे हेल्पलाइन" } },
  { number: "7827170170", label: { en: "National Commission for Women (WhatsApp)", hi: "राष्ट्रीय महिला आयोग (WhatsApp)", ta: "தேசிய மகளிர் ஆணையம் (WhatsApp)", bn: "জাতীয় মহিলা কমিশন (WhatsApp)", mr: "राष्ट्रीय महिला आयोग (WhatsApp)" } },
  { number: "15100", label: { en: "Free legal aid (NALSA)", hi: "मुफ़्त कानूनी सहायता (NALSA)", ta: "இலவச சட்ட உதவி (NALSA)", bn: "বিনামূল্যে আইনি সাহায্য (NALSA)", mr: "मोफत कायदेशीर मदत (NALSA)" } },
  { number: "139", label: { en: "Rail Madad: trouble on a train or at a station", hi: "रेल मदद: ट्रेन या स्टेशन पर परेशानी", ta: "ரயில் மதத்: ரயிலில் அல்லது நிலையத்தில் பிரச்சினை", bn: "রেল মদদ: ট্রেনে বা স্টেশনে সমস্যা", mr: "रेल मदद: ट्रेनमध्ये किंवा स्टेशनवर अडचण" } },
  { number: "1800113090", label: { en: "Indians working abroad, or about to (free, 24 hours)", hi: "विदेश में काम करने वाले या जाने वाले भारतीय (मुफ़्त, 24 घंटे)", ta: "வெளிநாட்டில் வேலை செய்யும் அல்லது செல்லவிருக்கும் இந்தியர்கள் (இலவசம், 24 மணிநேரம்)", bn: "বিদেশে কর্মরত বা যেতে চলা ভারতীয়রা (বিনামূল্যে, 24 ঘণ্টা)", mr: "परदेशात काम करणारे किंवा जाणारे भारतीय (मोफत, 24 तास)" } },
  { number: "14416", label: { en: "Tele-MANAS mental health", hi: "टेली-मानस मानसिक स्वास्थ्य", ta: "டெலி-மனஸ் மனநலம்", bn: "টেলি-মানস মানসিক স্বাস্থ্য", mr: "टेली-मानस मानसिक आरोग्य" } },
  { number: "1098", label: { en: "Childline (under 18)", hi: "चाइल्डलाइन (18 से कम उम्र)", ta: "சைல்ட்லைன் (18 வயதுக்குக் கீழ்)", bn: "চাইল্ডলাইন (18 বছরের কম)", mr: "चाइल्डलाइन (18 वर्षांखालील)" } },
];

export type HelpLink = { label: string; href: string };
export type HelpSection = { id: string; title: string; intro?: string; points: string[]; links?: HelpLink[] };

const en: HelpSection[] = [
  {
    id: "after-assault",
    title: "After a sexual assault: the first hours",
    intro: "What happened is not your fault. Go at your own pace; you decide what to do next.",
    points: [
      "Get somewhere safe and, if you can, call someone you trust or 181.",
      "Any hospital, government or private, must give you first aid and treatment free of charge, even before a police complaint.",
      "A medical examination needs your consent. You can ask for a woman doctor and bring someone with you.",
      "Emergency contraception works best as soon as possible, within 72 hours (some types up to 5 days). Ask the doctor or a pharmacist.",
      "Medicine that lowers the risk of HIV (PEP) must be started within 72 hours, ideally within 24. Ask for it at the hospital.",
      "If you might report it: try not to wash, change or throw away clothes first. Keep clothes in a paper bag, and save messages, call logs and photos.",
      "You can file a Zero FIR at any police station, whatever area it happened in. You can ask for a woman officer, and to give your statement at home.",
      "One Stop Centres (Sakhi) in every district offer shelter, medical help, legal help and counselling in one place. Call 181 to find yours.",
    ],
  },
  {
    id: "police",
    title: "Your rights with the police",
    points: [
      "The police must register an FIR for a serious offence. If they refuse, you can send your complaint in writing to the Superintendent of Police, or apply to a magistrate.",
      "Zero FIR: any police station must register your complaint and transfer it to the right one.",
      "You get a free copy of the FIR.",
      "Your name must not be published in cases of sexual offences.",
      "Free legal aid is available through your District Legal Services Authority (call 15100).",
      "If they refuse, HerSpace can write your letter to the Superintendent of Police (Write a complaint > Police refused my FIR). Send it by registered post and keep the receipt.",
    ],
  },
  {
    id: "domestic-violence",
    title: "Domestic violence",
    intro: "The Protection of Women from Domestic Violence Act, 2005 covers physical, sexual, verbal, emotional and economic abuse by a husband, partner or family members you live with.",
    points: [
      "You have the right to live in the shared home, even if you don't own it.",
      "A magistrate can order protection (stop the abuse and contact), residence, money for expenses, and custody of children. A Protection Officer in your district can help you apply.",
      "Make a safety plan: keep ID, bank cards, some money, medicines and important papers where you can grab them, or with someone you trust.",
      "Agree a signal with a neighbour or friend, and use HerSpace's code phrase with your contacts.",
      "If your phone may be checked, turn on disguised mode and quick exit (Account > Safety at home).",
      "Call 181 or the NCW WhatsApp helpline for advice, or 112 in an emergency.",
    ],
  },
  {
    id: "work",
    title: "Harassment at work (POSH)",
    points: [
      "Every workplace with 10 or more people must have an Internal Committee to handle complaints of sexual harassment.",
      "Smaller or informal workplaces, including domestic work, can complain to the Local Committee in the district.",
      "Complain in writing within 3 months of the last incident (the committee can extend this by 3 months).",
      "Government and private employees can also use the SHe-Box portal.",
      "Your employer must not punish you for complaining.",
    ],
    links: [{ label: "SHe-Box portal", href: "https://shebox.wcd.gov.in" }],
  },
  {
    id: "online",
    title: "Online harassment and image abuse",
    points: [
      "Save evidence first: screenshots showing the profile, the message, the link and the date.",
      "Report it on cybercrime.gov.in or call 1930. You can report anonymously for crimes against women.",
      "If someone threatens to share intimate images, StopNCII.org can help stop them being posted on major platforms, without you uploading the images.",
      "Don't pay a blackmailer: it usually leads to more demands. Report them instead.",
      "Report the account on the platform, and tighten your privacy settings.",
      "Keep the screenshots in your private record (Account > Safety at home), so they're safe even if your phone is checked or lost, or the messages are deleted.",
    ],
    links: [
      { label: "cybercrime.gov.in", href: "https://cybercrime.gov.in" },
      { label: "StopNCII.org", href: "https://stopncii.org" },
    ],
  },
  {
    id: "forced-marriage",
    title: "Forced marriage",
    intro: "You have the right to decide whether, when and whom you marry.",
    points: [
      "A marriage without your free consent can be challenged. Pressure, threats or locking you in are crimes, even by family.",
      "If you're under 18, a child marriage can be stopped: call 1098 or 112.",
      "If you're threatened for choosing your own partner, the police must protect you; the Supreme Court said so in 2018. Call 112, or 181 for advice.",
      "Keep your ID, certificates and phone safe, or copies with someone you trust, and agree a code phrase with a friend.",
      "Call 181 to reach your district's One Stop Centre for shelter, counselling and legal help.",
    ],
  },
  {
    id: "acid-burns",
    title: "Acid attack or burns",
    intro: "Act fast: the first minutes matter most.",
    points: [
      "Rinse with plenty of cool running water for at least 20 minutes. Take off clothes and jewellery the acid touched, unless they're stuck to the skin.",
      "Don't put on cream, oil, toothpaste or ice. Call 108 or 112 and go to the nearest hospital.",
      "Every hospital, government or private, must treat acid attack survivors free of charge, and give a certificate for compensation (Supreme Court, 2015).",
      "Survivors are entitled to compensation from the state, at least ₹3 lakh. Free legal aid (15100) can help you claim it.",
      "Acid attack is a serious crime: report it to the police, or file a Zero FIR at any station.",
    ],
  },
  {
    id: "jobs-abroad",
    title: "Job offers abroad and trafficking",
    points: [
      "Only use recruiting agents registered with the Ministry of External Affairs: check them on emigrate.gov.in, pay only the legal fee, and get a receipt.",
      "Be careful of high pay without an interview, a tourist visa for a job, or anyone asking to keep your passport.",
      "Leave copies of your passport, visa and contract with family, with your employer's address.",
      "If you're stuck abroad or your passport is taken, contact the Indian embassy, or call 1800 11 3090 (free in India, 24 hours, 11 languages).",
      "In India, report trafficking or a fake agent to the police (112); women can also call 181.",
    ],
    links: [
      { label: "eMigrate: check a recruiting agent", href: "https://emigrate.gov.in" },
      { label: "MADAD: help for Indians abroad", href: "https://madad.gov.in" },
    ],
  },
  {
    id: "lgbtq",
    title: "For LGBTQ+ women",
    intro: "HerSpace is for you too: SOS, contacts, reports, circles and the support chat all work the same.",
    points: [
      "Consensual same-sex relationships are not a crime in India (Supreme Court, 2018).",
      "The Transgender Persons (Protection of Rights) Act, 2019 protects transgender people from discrimination, including at work, in healthcare and in renting a home.",
      "If family or anyone threatens or hurts you for who you are or whom you love, that's abuse: you can ask the police for protection (112), and courts have ordered it for couples.",
      "Outed or threatened online: save the evidence and report it on cybercrime.gov.in or 1930.",
      "Call 181 for advice, or 14416 (Tele-MANAS) if you'd like to talk to someone.",
    ],
  },
  {
    id: "stalkerware",
    title: "Is someone tracking your phone?",
    intro: "If someone knows things they shouldn't, your phone or accounts may be monitored.",
    points: [
      "Warning signs: apps you don't recognise, fast battery drain, the phone staying warm, or settings changed without you.",
      "Android: check Settings > Security > Device admin apps and Settings > Accessibility for apps you didn't enable.",
      "Check your Google or Apple account for devices you don't know, and turn off location sharing you didn't set up.",
      "From a safe device, change your passwords and turn on two-step verification.",
      "Careful: removing a tracking app can alert the person who installed it. Make a safety plan first, and talk to 181 or a support organisation.",
    ],
  },
  {
    id: "cant-speak",
    title: "If you can't speak or hear",
    points: [
      "In many states you can send an SMS to 112, or use the 112 India app's SOS button.",
      "HerSpace SOS works without speaking: it texts your contacts your location.",
      "Set a code phrase so your contacts know when a normal-looking message means you need help.",
    ],
  },
];

const hi: HelpSection[] = [
  {
    id: "after-assault",
    title: "यौन हिंसा के बाद: पहले कुछ घंटे",
    intro: "जो हुआ उसमें आपकी कोई गलती नहीं है। अपनी रफ़्तार से चलें; आगे क्या करना है, यह आप तय करेंगी।",
    points: [
      "किसी सुरक्षित जगह जाएं और हो सके तो किसी भरोसेमंद व्यक्ति को या 181 पर कॉल करें।",
      "कोई भी अस्पताल, सरकारी या निजी, आपको मुफ़्त प्राथमिक उपचार और इलाज देने के लिए बाध्य है, पुलिस शिकायत से पहले भी।",
      "मेडिकल जांच के लिए आपकी सहमति ज़रूरी है। आप महिला डॉक्टर की मांग कर सकती हैं और किसी को साथ ला सकती हैं।",
      "आपातकालीन गर्भनिरोधक जितनी जल्दी हो सके, 72 घंटे के अंदर सबसे अच्छा काम करता है (कुछ प्रकार 5 दिन तक)। डॉक्टर या फ़ार्मासिस्ट से पूछें।",
      "HIV का खतरा कम करने वाली दवा (PEP) 72 घंटे के अंदर, बेहतर हो तो 24 घंटे के अंदर शुरू करनी होती है। अस्पताल में इसकी मांग करें।",
      "अगर आप शिकायत कर सकती हैं: हो सके तो पहले नहाएं नहीं, कपड़े न बदलें या न फेंकें। कपड़े कागज़ के थैले में रखें, और मैसेज, कॉल लॉग और फ़ोटो सेव रखें।",
      "आप किसी भी पुलिस स्टेशन में ज़ीरो FIR दर्ज करा सकती हैं, घटना चाहे किसी भी इलाके में हुई हो। आप महिला अधिकारी की, और घर पर बयान दर्ज कराने की मांग कर सकती हैं।",
      "हर ज़िले में वन स्टॉप सेंटर (सखी) एक ही जगह पर आश्रय, चिकित्सा मदद, कानूनी मदद और काउंसलिंग देते हैं। अपना सेंटर जानने के लिए 181 पर कॉल करें।",
    ],
  },
  {
    id: "police",
    title: "पुलिस के सामने आपके अधिकार",
    points: [
      "गंभीर अपराध में पुलिस को FIR दर्ज करनी होती है। अगर वे मना करें, तो आप अपनी शिकायत लिखकर पुलिस अधीक्षक (SP) को भेज सकती हैं, या मजिस्ट्रेट के पास आवेदन कर सकती हैं।",
      "ज़ीरो FIR: कोई भी पुलिस स्टेशन आपकी शिकायत दर्ज करके उसे सही स्टेशन को भेजने के लिए बाध्य है।",
      "आपको FIR की मुफ़्त कॉपी मिलती है।",
      "यौन अपराधों के मामलों में आपका नाम प्रकाशित नहीं किया जा सकता।",
      "ज़िला विधिक सेवा प्राधिकरण के ज़रिए मुफ़्त कानूनी सहायता मिलती है (15100 पर कॉल करें)।",
      "अगर वे मना करें, तो HerSpace पुलिस अधीक्षक के लिए आपका पत्र लिख सकता है (शिकायत लिखें > पुलिस ने FIR दर्ज नहीं की)। इसे रजिस्टर्ड डाक से भेजें और रसीद रखें।",
    ],
  },
  {
    id: "domestic-violence",
    title: "घरेलू हिंसा",
    intro: "घरेलू हिंसा से महिलाओं का संरक्षण अधिनियम, 2005 पति, साथी या साथ रहने वाले परिवार के सदस्यों द्वारा शारीरिक, यौन, मौखिक, भावनात्मक और आर्थिक उत्पीड़न पर लागू होता है।",
    points: [
      "आपको साझा घर में रहने का अधिकार है, भले ही वह आपके नाम पर न हो।",
      "मजिस्ट्रेट संरक्षण (हिंसा और संपर्क रोकना), निवास, खर्च के लिए पैसे और बच्चों की कस्टडी का आदेश दे सकते हैं। आपके ज़िले के संरक्षण अधिकारी आवेदन में मदद कर सकते हैं।",
      "सुरक्षा योजना बनाएं: पहचान पत्र, बैंक कार्ड, कुछ पैसे, दवाएं और ज़रूरी कागज़ ऐसी जगह रखें जहां से तुरंत ले सकें, या किसी भरोसेमंद व्यक्ति के पास।",
      "किसी पड़ोसी या दोस्त के साथ कोई इशारा तय करें, और अपने संपर्कों के साथ HerSpace का कोड वाक्य इस्तेमाल करें।",
      "अगर आपका फ़ोन देखा जा सकता है, तो छिपा हुआ मोड और तुरंत बाहर निकलने का बटन चालू करें (खाता > घर पर सुरक्षा)।",
      "सलाह के लिए 181 या NCW WhatsApp हेल्पलाइन पर, और आपातकाल में 112 पर कॉल करें।",
    ],
  },
  {
    id: "work",
    title: "काम की जगह पर उत्पीड़न (POSH)",
    points: [
      "10 या ज़्यादा लोगों वाली हर कार्यस्थल पर यौन उत्पीड़न की शिकायतों के लिए एक आंतरिक समिति होनी चाहिए।",
      "छोटी या अनौपचारिक कार्यस्थल, घरेलू काम सहित, ज़िले की स्थानीय समिति में शिकायत कर सकती हैं।",
      "आखिरी घटना के 3 महीने के अंदर लिखित शिकायत करें (समिति इसे 3 महीने और बढ़ा सकती है)।",
      "सरकारी और निजी कर्मचारी SHe-Box पोर्टल का भी इस्तेमाल कर सकते हैं।",
      "शिकायत करने पर आपका नियोक्ता आपको सज़ा नहीं दे सकता।",
    ],
    links: [{ label: "SHe-Box पोर्टल", href: "https://shebox.wcd.gov.in" }],
  },
  {
    id: "online",
    title: "ऑनलाइन उत्पीड़न और तस्वीरों का दुरुपयोग",
    points: [
      "पहले सबूत सेव करें: प्रोफ़ाइल, मैसेज, लिंक और तारीख दिखाने वाले स्क्रीनशॉट।",
      "cybercrime.gov.in पर शिकायत करें या 1930 पर कॉल करें। महिलाओं के खिलाफ़ अपराधों की शिकायत आप गुमनाम रूप से कर सकती हैं।",
      "अगर कोई निजी तस्वीरें शेयर करने की धमकी दे, तो StopNCII.org बड़े प्लेटफ़ॉर्म पर उन्हें पोस्ट होने से रोकने में मदद कर सकता है, बिना तस्वीरें अपलोड किए।",
      "ब्लैकमेल करने वाले को पैसे न दें: इससे आम तौर पर और मांगें आती हैं। इसके बजाय शिकायत करें।",
      "प्लेटफ़ॉर्म पर उस अकाउंट की शिकायत करें, और अपनी प्राइवेसी सेटिंग कड़ी करें।",
      "स्क्रीनशॉट अपने निजी रिकॉर्ड में रखें (खाता > घर पर सुरक्षा), ताकि आपका फ़ोन देखे जाने, खो जाने या मैसेज मिटा दिए जाने पर भी वे सुरक्षित रहें।",
    ],
    links: [
      { label: "cybercrime.gov.in", href: "https://cybercrime.gov.in" },
      { label: "StopNCII.org", href: "https://stopncii.org" },
    ],
  },
  {
    id: "forced-marriage",
    title: "ज़बरदस्ती शादी",
    intro: "शादी करनी है या नहीं, कब और किससे, यह तय करने का हक़ आपका है।",
    points: [
      "आपकी आज़ाद मर्ज़ी के बिना हुई शादी को चुनौती दी जा सकती है। दबाव डालना, धमकाना या बंद करके रखना अपराध है, परिवार करे तब भी।",
      "अगर आपकी उम्र 18 से कम है, तो बाल विवाह रोका जा सकता है: 1098 या 112 पर कॉल करें।",
      "अपना साथी ख़ुद चुनने पर धमकी मिले, तो पुलिस को आपकी रक्षा करनी होगी; सुप्रीम कोर्ट ने 2018 में यही कहा। 112 पर, या सलाह के लिए 181 पर कॉल करें।",
      "अपने पहचान पत्र, प्रमाण पत्र और फ़ोन सुरक्षित रखें, या उनकी कॉपी किसी भरोसेमंद के पास रखें, और किसी दोस्त के साथ कोड वाक्य तय करें।",
      "आश्रय, काउंसलिंग और कानूनी मदद के लिए अपने ज़िले के वन स्टॉप सेंटर तक पहुँचने के लिए 181 पर कॉल करें।",
    ],
  },
  {
    id: "acid-burns",
    title: "एसिड हमला या जलना",
    intro: "जल्दी करें: पहले कुछ मिनट सबसे अहम हैं।",
    points: [
      "कम से कम 20 मिनट तक ढेर सारे ठंडे बहते पानी से धोएँ। जिन कपड़ों और गहनों पर एसिड लगा हो उन्हें उतार दें, जब तक वे त्वचा से चिपके न हों।",
      "क्रीम, तेल, टूथपेस्ट या बर्फ़ न लगाएँ। 108 या 112 पर कॉल करें और नज़दीकी अस्पताल जाएँ।",
      "हर अस्पताल, सरकारी या निजी, को एसिड हमले से बची महिलाओं का मुफ़्त इलाज करना होगा और मुआवज़े के लिए प्रमाण पत्र देना होगा (सुप्रीम कोर्ट, 2015)।",
      "पीड़ितों को राज्य से कम से कम ₹3 लाख मुआवज़ा पाने का हक़ है। मुफ़्त कानूनी सहायता (15100) इसे पाने में मदद कर सकती है।",
      "एसिड हमला गंभीर अपराध है: पुलिस में रिपोर्ट करें, या किसी भी थाने में ज़ीरो FIR दर्ज कराएँ।",
    ],
  },
  {
    id: "jobs-abroad",
    title: "विदेश में नौकरी के ऑफ़र और तस्करी",
    points: [
      "सिर्फ़ विदेश मंत्रालय में पंजीकृत भर्ती एजेंट से ही बात करें: उन्हें emigrate.gov.in पर जाँचें, सिर्फ़ कानूनी फ़ीस दें और रसीद लें।",
      "बिना इंटरव्यू के ज़्यादा तनख़्वाह, नौकरी के लिए टूरिस्ट वीज़ा, या पासपोर्ट अपने पास रखने को कहने वाले से सावधान रहें।",
      "अपने पासपोर्ट, वीज़ा और कॉन्ट्रैक्ट की कॉपी परिवार के पास छोड़ें, नियोक्ता के पते के साथ।",
      "अगर आप विदेश में फँस जाएँ या पासपोर्ट ले लिया जाए, तो भारतीय दूतावास से संपर्क करें, या 1800 11 3090 पर कॉल करें (भारत में मुफ़्त, 24 घंटे, 11 भाषाएँ)।",
      "भारत में तस्करी या फ़र्ज़ी एजेंट की रिपोर्ट पुलिस (112) में करें; महिलाएँ 181 पर भी कॉल कर सकती हैं।",
    ],
    links: [
      { label: "eMigrate: भर्ती एजेंट जाँचें", href: "https://emigrate.gov.in" },
      { label: "MADAD: विदेश में भारतीयों की मदद", href: "https://madad.gov.in" },
    ],
  },
  {
    id: "lgbtq",
    title: "LGBTQ+ महिलाओं के लिए",
    intro: "HerSpace आपके लिए भी है: SOS, संपर्क, रिपोर्ट, सर्कल और सपोर्ट चैट सब वैसे ही काम करते हैं।",
    points: [
      "आपसी सहमति से समलैंगिक संबंध भारत में अपराध नहीं है (सुप्रीम कोर्ट, 2018)।",
      "ट्रांसजेंडर व्यक्ति (अधिकारों का संरक्षण) अधिनियम, 2019 ट्रांसजेंडर लोगों को भेदभाव से बचाता है, जिसमें नौकरी, इलाज और घर किराए पर लेना शामिल है।",
      "अगर परिवार या कोई भी आपको आपकी पहचान या आपके प्यार की वजह से धमकाए या चोट पहुँचाए, तो यह हिंसा है: आप पुलिस से सुरक्षा माँग सकती हैं (112), और अदालतों ने जोड़ों को यह सुरक्षा दिलाई है।",
      "ऑनलाइन पहचान उजागर की गई या धमकी मिली: सबूत सेव करें और cybercrime.gov.in या 1930 पर रिपोर्ट करें।",
      "सलाह के लिए 181 पर कॉल करें, या किसी से बात करनी हो तो 14416 (टेली-मानस) पर।",
    ],
  },
  {
    id: "stalkerware",
    title: "क्या कोई आपका फ़ोन ट्रैक कर रहा है?",
    intro: "अगर किसी को ऐसी बातें पता हों जो उसे नहीं पता होनी चाहिए, तो हो सकता है आपके फ़ोन या अकाउंट पर नज़र रखी जा रही हो।",
    points: [
      "चेतावनी के संकेत: अनजान ऐप, बैटरी का जल्दी खत्म होना, फ़ोन का गर्म रहना, या आपके बिना सेटिंग का बदलना।",
      "Android: सेटिंग > सुरक्षा > डिवाइस एडमिन ऐप और सेटिंग > सुलभता (Accessibility) में वे ऐप देखें जिन्हें आपने चालू नहीं किया।",
      "अपने Google या Apple अकाउंट में अनजान डिवाइस देखें, और वह लोकेशन शेयरिंग बंद करें जो आपने सेट नहीं की।",
      "किसी सुरक्षित डिवाइस से अपने पासवर्ड बदलें और दो-चरणीय सत्यापन चालू करें।",
      "सावधान: ट्रैकिंग ऐप हटाने से उसे लगाने वाले को पता चल सकता है। पहले सुरक्षा योजना बनाएं, और 181 या किसी सहायता संस्था से बात करें।",
    ],
  },
  {
    id: "cant-speak",
    title: "अगर आप बोल या सुन नहीं सकतीं",
    points: [
      "कई राज्यों में आप 112 पर SMS भेज सकती हैं, या 112 India ऐप का SOS बटन इस्तेमाल कर सकती हैं।",
      "HerSpace SOS बिना बोले काम करता है: यह आपके संपर्कों को आपकी लोकेशन मैसेज कर देता है।",
      "कोड वाक्य तय करें, ताकि आपके संपर्कों को पता रहे कि कोई सामान्य-सा मैसेज कब मदद की पुकार है।",
    ],
  },
];

// Tamil, Bengali and Marathi (help-ta.ts and so on) were drafted with AI assistance from the
// English; they keep the same section ids, so links like /help#police work in every language.
export const HELP_SECTIONS: Record<Lang, HelpSection[]> = { en, hi, ta, bn, mr };
