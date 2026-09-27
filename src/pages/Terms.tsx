import { Link } from "react-router-dom";
import LegalPage, { ContactLine, Section } from "@/components/LegalPage";
import { EMERGENCY_NUMBER } from "@/lib/api";

const Terms = () => (
  <LegalPage title="Terms of Use" updated="27 September 2026">
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-foreground">
      <strong>HerSpace is not an emergency service.</strong> It does not contact the police, ambulance or any emergency responder.
      If you are in danger, call{" "}
      <a className="underline" href={`tel:${EMERGENCY_NUMBER}`}>
        {EMERGENCY_NUMBER}
      </a>
      .
    </div>

    <Section title="What HerSpace does">
      <p>
        HerSpace lets you alert people you trust, document incidents, see community-reported incidents on a map, and talk to an AI
        support companion. By using it you agree to these terms and to our{" "}
        <Link to="/privacy" className="text-primary underline">
          Privacy Policy
        </Link>
        .
      </p>
    </Section>

    <Section title="SOS alerts can fail">
      <p>
        Text messages and calls depend on phone networks, your internet connection, your device's location and third-party
        providers. We show you whether each alert was sent, but we cannot guarantee that an alert will be delivered, read or acted
        on. Always keep another way to get help, and use the test alert to check your setup.
      </p>
    </Section>

    <Section title="Your responsibilities">
      <ul>
        <li>Only add emergency contacts who know you and have agreed to receive alerts from you.</li>
        <li>Don't trigger SOS as a joke or to harass anyone.</li>
        <li>Report incidents honestly. Don't post false reports or information that identifies other people.</li>
        <li>Keep your password private and tell us if you think your account has been misused.</li>
      </ul>
      <p>We may remove content or suspend accounts that break these rules or put others at risk.</p>
    </Section>

    <Section title="AI support chat">
      <p>
        The support companion is an AI. It can make mistakes and is not a doctor, therapist, counsellor or lawyer. Don't rely on
        it for medical, legal or emergency decisions.
      </p>
    </Section>

    <Section title="Community map">
      <p>
        Map reports come from other users and are not verified. A lack of reports doesn't mean an area is safe, and a report
        doesn't prove that something happened.
      </p>
    </Section>

    <Section title="Availability and changes">
      <p>
        HerSpace is under active development. Features may change, and the service may occasionally be unavailable. We'll update
        these terms when things change and show the new date above.
      </p>
    </Section>

    <Section title="Ending your use">
      <p>
        You can stop using HerSpace and delete your account at any time from your{" "}
        <Link to="/account" className="text-primary underline">
          account page
        </Link>
        .
      </p>
    </Section>

    <Section title="Contact">
      <ContactLine />
    </Section>
  </LegalPage>
);

export default Terms;
