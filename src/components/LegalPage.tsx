import { ReactNode } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useI18n } from "@/i18n";

export const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL as string | undefined;

export const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-3">
    <h2 className="text-xl font-semibold text-foreground">{title}</h2>
    <div className="space-y-3 text-muted-foreground leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_strong]:text-foreground">
      {children}
    </div>
  </section>
);

export const ContactLine = () =>
  CONTACT_EMAIL ? (
    <p>
      Email{" "}
      <a className="text-primary underline" href={`mailto:${CONTACT_EMAIL}`}>
        {CONTACT_EMAIL}
      </a>
      .
    </p>
  ) : (
    <p>A contact address for privacy requests will be published here before public launch.</p>
  );

// Legal text stays in English until it's professionally translated; Hindi readers are told so.
const EnglishOnlyNote = () => {
  const { lang, t } = useI18n();
  if (lang === "en") return null;
  return (
    <p lang={lang} className="rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-sm">
      {t("legal.englishOnly")}
    </p>
  );
};

const LegalPage = ({ title, updated, children }: { title: string; updated: string; children: ReactNode }) => (
  <div className="min-h-screen">
    <Navbar />
    <main className="pt-24 pb-16 px-4">
      <article className="container mx-auto max-w-3xl space-y-8" lang="en">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">Last updated {updated}</p>
          <EnglishOnlyNote />
        </header>
        {children}
      </article>
    </main>
    <Footer />
  </div>
);

export default LegalPage;
