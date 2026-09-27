import { Link } from "react-router-dom";
import LegalPage, { ContactLine, Section } from "@/components/LegalPage";

const Privacy = () => (
  <LegalPage title="Privacy Policy" updated="27 September 2026">
    <p className="text-lg text-muted-foreground leading-relaxed">
      HerSpace exists to help keep you safe, so we collect only what the app needs to work, and we tell you plainly where it
      goes.
    </p>

    <Section title="What we collect">
      <ul>
        <li>
          <strong>Your account:</strong> name, email address and a scrambled (hashed) version of your password. We never store
          your password itself.
        </li>
        <li>
          <strong>Emergency contacts:</strong> each contact's name, phone number, relationship (if you add one) and whether they
          have agreed to be your contact.
        </li>
        <li>
          <strong>SOS alerts:</strong> when you press SOS we store the time, your location if you allow location access, and
          whether each message or call was delivered.
        </li>
        <li>
          <strong>Incident reports:</strong> the incident type, your description, the date and any location you enter or choose
          to share. If you submit anonymously, the report is not linked to your account in any way.
        </li>
        <li>
          <strong>Map flags:</strong> when you flag a map point we record your account, or a scrambled version of your IP
          address if you're logged out, so each person counts once.
        </li>
        <li>
          <strong>On your device:</strong> the app keeps a copy of your name and emergency contacts in your browser so the SOS
          page can still offer to text or call them when you're offline. It's removed when you log out.
        </li>
        <li>
          <strong>Support chat:</strong> messages are sent to our AI provider to generate a reply. HerSpace does not save them.
        </li>
      </ul>
    </Section>

    <Section title="Who sees your information">
      <ul>
        <li>
          <strong>Your emergency contacts</strong> receive your name and a map link to your location when you trigger SOS, and
          only if they have agreed to be your contact.
        </li>
        <li>
          <strong>Everyone using the Safe Map</strong> can see reports that include a location, but only the incident type, the
          date and an area rounded to about 1 km. Descriptions and who reported are never shown.
        </li>
        <li>
          <strong>Service providers</strong> that run parts of the app for us: Twilio (text messages and calls), Resend
          (password-reset emails), Anthropic (the AI support chat) and OpenStreetMap (map images, which your browser loads
          directly). They receive only what they need for that task.
        </li>
      </ul>
      <p>
        We do not sell your data, show you ads, or pass your reports to the police or your employer. We would only disclose
        information if the law requires it.
      </p>
    </Section>

    <Section title="How long we keep it">
      <ul>
        <li>SOS alerts and their locations are deleted automatically after 90 days.</li>
        <li>Login sessions expire after 30 days; password-reset links after 1 hour.</li>
        <li>Your account, contacts and reports stay until you delete them.</li>
      </ul>
    </Section>

    <Section title="Your rights">
      <p>
        From your <Link to="/account" className="text-primary underline">account page</Link> you can download everything we
        store about you, delete individual reports, or delete your account and all personal data linked to it. Emergency
        contacts can withdraw their agreement at any time using the link they were sent.
      </p>
      <p>
        You also have rights under India's Digital Personal Data Protection Act, 2023, including to correct your data and to
        raise a grievance. To exercise them, contact us below.
      </p>
    </Section>

    <Section title="Security">
      <p>
        Passwords and login tokens are stored hashed, access to your data requires your login, and the server limits
        repeated attempts. Your data is protected by access controls on our server; it is not end-to-end encrypted.
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

export default Privacy;
