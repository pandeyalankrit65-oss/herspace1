// "Help & your rights": practical guidance for India, in English and Hindi. This is general
// information, not legal or medical advice. Review it with a lawyer or a women's-rights
// organisation before launch, and whenever laws or helplines change (see REVIEWED).

export const REVIEWED = { en: "September 2026", hi: "सितंबर 2026" };

export type Helpline = { number: string; label: { en: string; hi: string } };

// Tap-to-call numbers. National unless noted; some states run their own as well.
export const HELPLINES: Helpline[] = [
  { number: "112", label: { en: "Emergency: police, fire, ambulance", hi: "आपातकाल: पुलिस, फ़ायर, एम्बुलेंस" } },
  { number: "181", label: { en: "Women Helpline (24x7)", hi: "महिला हेल्पलाइन (24x7)" } },
  { number: "108", label: { en: "Ambulance (most states)", hi: "एम्बुलेंस (ज़्यादातर राज्य)" } },
  { number: "1930", label: { en: "Cybercrime helpline", hi: "साइबर अपराध हेल्पलाइन" } },
  { number: "7827170170", label: { en: "National Commission for Women (WhatsApp)", hi: "राष्ट्रीय महिला आयोग (WhatsApp)" } },
  { number: "15100", label: { en: "Free legal aid (NALSA)", hi: "मुफ़्त कानूनी सहायता (NALSA)" } },
  { number: "14416", label: { en: "Tele-MANAS mental health", hi: "टेली-मानस मानसिक स्वास्थ्य" } },
  { number: "1098", label: { en: "Childline (under 18)", hi: "चाइल्डलाइन (18 से कम उम्र)" } },
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
    ],
    links: [
      { label: "cybercrime.gov.in", href: "https://cybercrime.gov.in" },
      { label: "StopNCII.org", href: "https://stopncii.org" },
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
    ],
    links: [
      { label: "cybercrime.gov.in", href: "https://cybercrime.gov.in" },
      { label: "StopNCII.org", href: "https://stopncii.org" },
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

export const HELP_SECTIONS: Record<"en" | "hi", HelpSection[]> = { en, hi };
