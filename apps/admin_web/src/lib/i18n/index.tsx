"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { MESSAGES, type Locale, type MessageKey } from "@/lib/i18n/messages.generated";
import { WEB_MESSAGES, type WebMessageKey } from "@/lib/i18n/web-messages";
import { LOCALE_COOKIE } from "@/lib/i18n/shared";

export type { Locale, MessageKey, WebMessageKey };

/** Any key from either table: the app's reviewed strings or the web-only ones. */
export type AnyMessageKey = MessageKey | WebMessageKey;

/** The app's translations win on a key collision: they are the reviewed ones. */
const TABLES: Record<Locale, Record<string, string>> = {
  en: { ...WEB_MESSAGES.en, ...MESSAGES.en },
  hi: { ...WEB_MESSAGES.hi, ...MESSAGES.hi },
  gu: { ...WEB_MESSAGES.gu, ...MESSAGES.gu },
};
// Re-exported for convenience; the definitions live in shared.ts so server
// components can use them too.
export { LOCALE_COOKIE, LOCALES, isLocale } from "@/lib/i18n/shared";

type Translate = (key: AnyMessageKey, fallback?: string) => string;

const LocaleContext = createContext<{ locale: Locale; setLocale: (l: Locale) => void; t: Translate }>({
  locale: "en",
  setLocale: () => {},
  t: (key, fallback) => fallback ?? TABLES.en[key] ?? String(key),
});

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    // A cookie rather than localStorage so the server renders the right
    // language on the first paint — same reason the theme uses one.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }, []);

  const value = useMemo(() => {
    const table = TABLES[locale] ?? TABLES.en;
    const t: Translate = (key, fallback) =>
      // Fall back to English, then to the caller's text, so an untranslated
      // string shows real words rather than a key name.
      table[key] ?? TABLES.en[key] ?? fallback ?? String(key);
    return { locale, setLocale, t };
  }, [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  return useContext(LocaleContext);
}

/** Shorthand for components that only need the translate function. */
export function useT(): Translate {
  return useContext(LocaleContext).t;
}
