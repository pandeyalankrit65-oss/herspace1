import { Link } from "react-router-dom";
import LegalPage, { ContactLine, Section } from "@/components/LegalPage";
import { EMERGENCY_NUMBER } from "@/lib/api";

// Marathi translation of the Terms of Use, drafted with AI assistance (have it reviewed by a
// native speaker). Keep it in step with Terms.tsx: the English text is the binding version.
const TermsMr = () => (
  <LegalPage title="वापराच्या अटी" updated="27 सप्टेंबर 2026" lang="mr">
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-foreground">
      <strong>HerSpace ही आपत्कालीन सेवा नाही.</strong> ती पोलीस, रुग्णवाहिका किंवा कोणत्याही आपत्कालीन मदत सेवेशी संपर्क साधत नाही. तुम्ही
      धोक्यात असल्यास{" "}
      <a className="underline" href={`tel:${EMERGENCY_NUMBER}`}>
        {EMERGENCY_NUMBER}
      </a>{" "}
      वर कॉल करा.
    </div>

    <Section title="HerSpace काय करते">
      <p>
        HerSpace तुम्हाला विश्वासू व्यक्तींना सावध करू देते, घटनांची नोंद करू देते, समुदायाने नोंदवलेल्या घटना नकाशावर पाहू देते, आणि AI सपोर्ट
        सोबत्याशी बोलू देते. ते वापरून तुम्ही या अटींना आणि आमच्या{" "}
        <Link to="/privacy" className="text-primary underline">
          गोपनीयता धोरणाला
        </Link>{" "}
        संमती देता.
      </p>
    </Section>

    <Section title="SOS अलर्ट अयशस्वी होऊ शकतात">
      <p>
        टेक्स्ट मेसेज आणि कॉल फोन नेटवर्क, तुमचे इंटरनेट कनेक्शन, तुमच्या डिव्हाइसचे ठिकाण आणि तृतीय-पक्ष प्रदात्यांवर अवलंबून असतात.
        प्रत्येक अलर्ट पाठवला गेला की नाही हे आम्ही दाखवतो, पण अलर्ट पोहोचेल, वाचला जाईल किंवा त्यावर कारवाई होईल याची हमी आम्ही देऊ शकत
        नाही. मदत मिळवण्याचा दुसरा मार्ग नेहमी तयार ठेवा, आणि तुमची सेटिंग्ज तपासण्यासाठी टेस्ट अलर्ट वापरा.
      </p>
    </Section>

    <Section title="तुमच्या जबाबदाऱ्या">
      <ul>
        <li>फक्त तुम्हाला ओळखणाऱ्या आणि तुमच्याकडून अलर्ट घेण्यास संमती दिलेल्या व्यक्तींनाच आपत्कालीन संपर्क म्हणून जोडा.</li>
        <li>गंमत म्हणून किंवा कोणाला त्रास देण्यासाठी SOS सुरू करू नका.</li>
        <li>घटना प्रामाणिकपणे नोंदवा. खोटे रिपोर्ट किंवा इतरांची ओळख उघड करणारी माहिती टाकू नका.</li>
        <li>तुमचा पासवर्ड खाजगी ठेवा, आणि तुमच्या खात्याचा गैरवापर झाल्याचे वाटल्यास आम्हाला कळवा.</li>
      </ul>
      <p>हे नियम मोडणारा किंवा इतरांना धोक्यात आणणारा मजकूर आम्ही काढू शकतो किंवा खाती निलंबित करू शकतो.</p>
    </Section>

    <Section title="AI सपोर्ट चॅट">
      <p>
        सपोर्ट सोबती एक AI आहे. तो चुका करू शकतो आणि तो डॉक्टर, थेरपिस्ट, समुपदेशक किंवा वकील नाही. वैद्यकीय, कायदेशीर किंवा आपत्कालीन
        निर्णयांसाठी त्याच्यावर अवलंबून राहू नका.
      </p>
    </Section>

    <Section title="समुदाय नकाशा">
      <p>
        नकाशावरील रिपोर्ट इतर वापरकर्त्यांकडून येतात आणि ते पडताळलेले नाहीत. रिपोर्ट नसणे म्हणजे परिसर सुरक्षित आहे असे नाही, आणि एखादा रिपोर्ट
        काहीतरी घडल्याचे सिद्ध करत नाही.
      </p>
    </Section>

    <Section title="उपलब्धता आणि बदल">
      <p>
        HerSpace सक्रियपणे विकसित होत आहे. वैशिष्ट्ये बदलू शकतात, आणि सेवा कधीकधी उपलब्ध नसू शकते. गोष्टी बदलल्यावर आम्ही या अटी अपडेट करू
        आणि नवीन तारीख वर दाखवू.
      </p>
    </Section>

    <Section title="वापर थांबवणे">
      <p>
        तुम्ही कधीही HerSpace वापरणे थांबवू शकता आणि तुमच्या{" "}
        <Link to="/account" className="text-primary underline">
          खात्याच्या पेजवरून
        </Link>{" "}
        तुमचे खाते हटवू शकता.
      </p>
    </Section>

    <Section title="संपर्क">
      <ContactLine lang="mr" />
    </Section>
  </LegalPage>
);

export default TermsMr;
