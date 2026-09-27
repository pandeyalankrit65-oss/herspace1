import { createContext, Fragment, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import en, { type MessageKey } from "./en";
import hi from "./hi";

export type Lang = "en" | "hi";
export const LANGS: Record<Lang, { label: string; messages: Record<MessageKey, string> }> = {
  en: { label: "English", messages: en },
  hi: { label: "हिन्दी", messages: hi },
};

const STORAGE_KEY = "herspace_lang";
type Vars = Record<string, string | number>;

export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "hi") return saved;
  } catch {
    // ignore
  }
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("hi") ? "hi" : "en";
}

// Replaces {name} placeholders. Missing keys fall back to English (the types prevent this,
// but it keeps a bad deploy readable).
export function format(lang: Lang, key: MessageKey, vars?: Vars) {
  const template = LANGS[lang].messages[key] ?? en[key] ?? key;
  return vars ? template.replace(/\{(\w+)\}/g, (_, name) => (name in vars ? String(vars[name]) : `{${name}}`)) : template;
}

type I18n = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MessageKey, vars?: Vars) => string;
  // Picks `${key}_one` or `${key}_other` for the count and passes {count}.
  tn: (key: string, count: number, vars?: Vars) => string;
  // For sentences containing links or other elements: {name} placeholders are replaced by
  // the given nodes, so each language can put them where its word order needs them.
  tr: (key: MessageKey, nodes: Record<string, ReactNode>) => ReactNode;
};

function interpolateNodes(template: string, nodes: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    return <Fragment key={i}>{name && name in nodes ? nodes[name] : part}</Fragment>;
  });
}

const I18nContext = createContext<I18n | null>(null);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang,
      t: (key, vars) => format(lang, key, vars),
      tn: (key, count, vars) => format(lang, `${key}_${count === 1 ? "one" : "other"}` as MessageKey, { count, ...vars }),
      tr: (key, nodes) => interpolateNodes(LANGS[lang].messages[key] ?? en[key], nodes),
    }),
    [lang, setLang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
};
