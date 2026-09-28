import { ReactNode } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useI18n } from "@/i18n";

export const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL as string | undefined;
export type LegalLang = "en" | "hi";

export const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-3">
    <h2 className="text-xl font-semibold text-foreground">{title}</h2>
    <div className="space-y-3 text-muted-foreground leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_strong]:text-foreground">
      {children}
    </div>
  </section>
);

export const ContactLine = ({ lang = "en" }: { lang?: LegalLang }) =>
  CONTACT_EMAIL ? (
    <p>
      {lang === "hi" ? "ईमेल करें:" : "Email"}{" "}
      <a className="text-primary underline" href={`mailto:${CONTACT_EMAIL}`}>
        {CONTACT_EMAIL}
      </a>
      {lang === "hi" ? "।" : "."}
    </p>
  ) : (
    <p>
      {lang === "hi"
        ? "प्राइवेसी से जुड़े अनुरोधों के लिए संपर्क पता सार्वजनिक लॉन्च से पहले यहां दिया जाएगा।"
        : "A contact address for privacy requests will be published here before public launch."}
    </p>
  );

// Which version of a legal page to show: Hindi when the app is in Hindi, unless the reader
// asked for the English original (?lang=en).
export function useLegalLang(): LegalLang {
  const { lang } = useI18n();
  const [params] = useSearchParams();
  return lang === "hi" && params.get("lang") !== "en" ? "hi" : "en";
}

// The English text is the binding one; translations say so and link back to it.
const TranslationNote = ({ lang }: { lang: LegalLang }) => {
  const { lang: appLang, t } = useI18n();
  const { pathname } = useLocation();
  if (lang === "hi") {
    return (
      <p className="rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-sm">
        {t("legal.translationNote")}{" "}
        <Link to={`${pathname}?lang=en`} className="font-semibold underline underline-offset-2">
          {t("legal.readEnglish")}
        </Link>
      </p>
    );
  }
  if (appLang === "hi") {
    return (
      <p lang="hi" className="rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-sm">
        <Link to={pathname} className="font-semibold underline underline-offset-2">
          {t("legal.readHindi")}
        </Link>
      </p>
    );
  }
  if (appLang !== "en") {
    return (
      <p lang={appLang} className="rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-sm">
        {t("legal.englishOnly")}
      </p>
    );
  }
  return null;
};

const LegalPage = ({ title, updated, lang = "en", children }: { title: string; updated: string; lang?: LegalLang; children: ReactNode }) => (
  <div className="min-h-screen">
    <Navbar />
    <main className="pt-24 pb-16 px-4">
      <article className="container mx-auto max-w-3xl space-y-8" lang={lang}>
        <header className="space-y-2">
          <h1 className="text-4xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{lang === "hi" ? `अंतिम अपडेट: ${updated}` : `Last updated ${updated}`}</p>
          <TranslationNote lang={lang} />
        </header>
        {children}
      </article>
    </main>
    <Footer />
  </div>
);

export default LegalPage;
