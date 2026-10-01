import { ReactNode } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useI18n, type Lang } from "@/i18n";

export const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL as string | undefined;
export type LegalLang = Lang;

// The few fixed phrases on every legal page, in each language.
const LEGAL_TEXT: Record<LegalLang, { updated: (date: string) => string; email: string; end: string; noContact: string }> = {
  en: {
    updated: (d) => `Last updated ${d}`,
    email: "Email",
    end: ".",
    noContact: "A contact address for privacy requests will be published here before public launch.",
  },
  hi: {
    updated: (d) => `अंतिम अपडेट: ${d}`,
    email: "ईमेल करें:",
    end: "।",
    noContact: "प्राइवेसी से जुड़े अनुरोधों के लिए संपर्क पता सार्वजनिक लॉन्च से पहले यहां दिया जाएगा।",
  },
  ta: {
    updated: (d) => `கடைசியாகப் புதுப்பிக்கப்பட்டது: ${d}`,
    email: "மின்னஞ்சல்:",
    end: ".",
    noContact: "தனியுரிமை தொடர்பான கோரிக்கைகளுக்கான தொடர்பு முகவரி பொது வெளியீட்டுக்கு முன் இங்கே வெளியிடப்படும்.",
  },
  bn: {
    updated: (d) => `সর্বশেষ আপডেট: ${d}`,
    email: "ইমেল করুন:",
    end: "।",
    noContact: "গোপনীয়তা সংক্রান্ত অনুরোধের জন্য যোগাযোগের ঠিকানা সর্বজনীন প্রকাশের আগে এখানে দেওয়া হবে।",
  },
  mr: {
    updated: (d) => `शेवटचे अपडेट: ${d}`,
    email: "ईमेल करा:",
    end: ".",
    noContact: "गोपनीयतेशी संबंधित विनंत्यांसाठी संपर्क पत्ता सार्वजनिक लॉन्चपूर्वी येथे दिला जाईल.",
  },
};

export const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-3">
    <h2 className="text-xl font-semibold text-foreground">{title}</h2>
    <div className="space-y-3 text-muted-foreground leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_strong]:text-foreground">
      {children}
    </div>
  </section>
);

export const ContactLine = ({ lang = "en" }: { lang?: LegalLang }) => {
  const text = LEGAL_TEXT[lang];
  return CONTACT_EMAIL ? (
    <p>
      {text.email}{" "}
      <a className="text-primary underline" href={`mailto:${CONTACT_EMAIL}`}>
        {CONTACT_EMAIL}
      </a>
      {text.end}
    </p>
  ) : (
    <p>{text.noContact}</p>
  );
};

// Which version of a legal page to show: the app's language, unless the reader asked for the
// English original (?lang=en).
export function useLegalLang(): LegalLang {
  const { lang } = useI18n();
  const [params] = useSearchParams();
  return params.get("lang") === "en" ? "en" : lang;
}

// The English text is the binding one; translations say so and link back to it, and the
// English original links back to the translation.
const TranslationNote = ({ lang }: { lang: LegalLang }) => {
  const { lang: appLang, t } = useI18n();
  const { pathname } = useLocation();
  if (lang !== "en") {
    return (
      <p className="rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-sm">
        {t("legal.translationNote")}{" "}
        <Link to={`${pathname}?lang=en`} className="font-semibold underline underline-offset-2">
          {t("legal.readEnglish")}
        </Link>
      </p>
    );
  }
  if (appLang !== "en") {
    return (
      <p lang={appLang} className="rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-sm">
        <Link to={pathname} className="font-semibold underline underline-offset-2">
          {t("legal.readTranslation")}
        </Link>
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
          <p className="text-sm text-muted-foreground">{LEGAL_TEXT[lang].updated(updated)}</p>
          <TranslationNote lang={lang} />
        </header>
        {children}
      </article>
    </main>
    <Footer />
  </div>
);

export default LegalPage;
