import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import LegalPage, { ContactLine, Section, useLegalLang, type LegalLang } from "@/components/LegalPage";

const PrivacyEn = () => (
  <LegalPage title="Privacy Policy" updated="7 October 2026">
    <p className="text-lg text-muted-foreground leading-relaxed">
      HerSpace exists to help keep you safe, so we collect only what the app needs to work, and we tell you plainly where it goes.
    </p>

    <Section title="What we collect">
      <ul>
        <li>
          <strong>Your account:</strong> name, email address and a scrambled (hashed) version of your password. We never store
          your password itself. If you add your own phone number, we text you a code to check it's yours and store the number
          once you've entered it.
        </li>
        <li>
          <strong>Emergency contacts:</strong> each contact's name, phone number, relationship (if you add one) and whether they
          have agreed to be your contact.
        </li>
        <li>
          <strong>SOS alerts:</strong> when you press SOS we store the time, your location if you allow location access, and
          whether each message or call was delivered. If you're logged in, your contacts also get a private live-location link:
          while the SOS page is open we keep only your latest position, and delete it as soon as you tap "I'm safe" or after 4
          hours. With each position we also keep your phone's battery level, so contacts know if it's about to switch off. If a
          contact taps "I'm on my way" on that page, we record their reply so you can see it.
        </li>
        <li>
          <strong>SOS audio recordings (only if you turn them on):</strong> after an alert, sound around you is recorded in short
          pieces and uploaded as evidence. Only you can play or download them, and they're deleted with the alert after 90 days.
        </li>
        <li>
          <strong>Emergency info (only if you add it):</strong> your blood group, allergies, medicines, health conditions and
          notes. This is health information, so it's private by default. If you turn sharing on, your contacts see it only on the
          live-location link while an SOS is active. You can change or remove it at any time on your account page.
        </li>
        <li>
          <strong>Walk with me and safety timers:</strong> the same live-location sharing, started by you, with an optional note
          about where you're going. We keep only your latest position and delete it when you stop sharing or the time runs out.
          If you head to one of your saved places, we store only its name (such as "Home") so your contacts know where you're
          going and can be told when you arrive.
        </li>
        <li>
          <strong>Incident reports:</strong> the incident type, your description, the date and any location you enter or choose to
          share, and any photos you add. Before a photo leaves your device, the app makes a clean copy without its hidden
          details (such as the GPS position and camera model); our server removes any that remain. If you submit anonymously,
          the report and its photos are not linked to your account in any way.
        </li>
        <li>
          <strong>Map flags:</strong> when you flag a map point we record your account, or a scrambled version of your IP address
          if you're logged out, so each person counts once.
        </li>
        <li>
          <strong>On your device:</strong> the app keeps a copy of your name and emergency contacts in your browser so the SOS
          page can still offer to text or call them when you're offline. Your saved places (such as Home and Work) are kept
          only on your device, never on our server; the app uses them to notice when you've arrived. All of this is removed
          when you log out.
        </li>
        <li>
          <strong>Corporate Connect (only if you join a workplace):</strong> which workplace you belong to, whether you're on its HR team, and the reports you send to your HR team with the conversation that follows. Each report is anonymous to HR unless you choose to share your name. If your HR team turns on Slack, Teams or email alerts, those alerts say only that a report or message arrived, never what it says or who sent it.
        </li>
        <li>
          <strong>Support chat:</strong> messages are sent to our AI provider to generate a reply. HerSpace does not save them.
        </li>
      </ul>
    </Section>

    <Section title="Who sees your information">
      <ul>
        <li>
          <strong>Your emergency contacts</strong> receive your name (and your phone number, if you've verified it) and a map
          link to your location when you trigger SOS, and only if they have agreed to be your contact. The live-location link
          also shows your phone's battery level and, if you chose to share it, your emergency info.
        </li>
        <li>
          <strong>Everyone using the Safe Map</strong> can see reports that include a location, but only the incident type, the
          date and an area rounded to about 1 km. Descriptions, photos and who reported are never shown.
        </li>
        <li>
          <strong>HerSpace moderators</strong> review map points that people flag as false or abusive. They see the report's
          type, description, date, rough area and photos, but not who sent it.
        </li>
        <li>
          <strong>Your workplace's HR team</strong>, only for the reports you send them through Corporate Connect: what you wrote and the conversation that follows. They see your name and email only if you chose to share them with that report. If you're on an HR team, the rest of that team sees your name and email. Your employer never sees anything else you do in HerSpace.
        </li>
        <li>
          <strong>Service providers</strong> that run parts of the app for us: Twilio (text messages and calls), Resend
          (password-reset emails), Anthropic (the AI support chat) and OpenStreetMap (map images, which your browser loads
          directly). They receive only what they need for that task.
        </li>
        <li>
          <strong>OpenStreetMap's Nominatim and Overpass services</strong>, contacted by our server, not your device. To add
          an area name such as "Near Connaught Place" to SOS texts, we send your location rounded to about 10 m; to show police
          stations, hospitals and pharmacies near you on the map, we send it rounded to about 1 km. Neither request includes
          your name or account, and we cache the answers so the same area isn't looked up twice.
        </li>
      </ul>
      <p>
        We do not sell your data or show you ads, and we never pass your reports to the police. Your employer sees only the workplace reports you send to your HR team yourself. We would only disclose information if the law requires it.
      </p>
    </Section>

    <Section title="How long we keep it">
      <ul>
        <li>SOS alerts, their locations and any audio recordings are deleted automatically after 90 days.</li>
        <li>Login sessions expire after 30 days; password-reset links after 1 hour.</li>
        <li>Your account, contacts and reports stay until you delete them.</li>
      </ul>
    </Section>

    <Section title="Your rights">
      <p>
        From your{" "}
        <Link to="/account" className="text-primary underline">
          account page
        </Link>{" "}
        you can download everything we store about you, delete individual reports, or delete your account and all personal data
        linked to it. Emergency contacts can withdraw their agreement at any time using the link they were sent.
      </p>
      <p>
        You also have rights under India's Digital Personal Data Protection Act, 2023, including to correct your data and to raise
        a grievance. To exercise them, contact us below.
      </p>
    </Section>

    <Section title="Security">
      <p>
        Passwords and login tokens are stored hashed, access to your data requires your login, and the server limits repeated
        attempts. Your data is protected by access controls on our server; it is not end-to-end encrypted.
      </p>
    </Section>

    <Section title="Age">
      <p>HerSpace is intended for people aged 18 and over.</p>
    </Section>

    <Section title="Changes and contact">
      <p>If we change this policy we'll update the date at the top and, for significant changes, tell you in the app.</p>
      <ContactLine />
    </Section>
  </LegalPage>
);

// Readers get their language; the English text is the binding version. Each translation is
// downloaded only by people reading it.
const TRANSLATIONS: Record<Exclude<LegalLang, "en">, React.LazyExoticComponent<() => JSX.Element>> = {
  hi: lazy(() => import("./legal/PrivacyHi")),
  ta: lazy(() => import("./legal/PrivacyTa")),
  bn: lazy(() => import("./legal/PrivacyBn")),
  mr: lazy(() => import("./legal/PrivacyMr")),
};

const Privacy = () => {
  const lang = useLegalLang();
  if (lang === "en") return <PrivacyEn />;
  const Translation = TRANSLATIONS[lang];
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <Translation />
    </Suspense>
  );
};

export default Privacy;
