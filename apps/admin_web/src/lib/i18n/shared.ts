/**
 * Locale values and helpers usable from BOTH the server and the client.
 *
 * Kept out of index.tsx because that file carries "use client", which marks
 * every one of its exports client-only — the root layout is a server component
 * and calling isLocale() from there fails at runtime (not at build time).
 */
import type { Locale } from "@/lib/i18n/messages.generated";

export type { Locale };

export const LOCALE_COOKIE = "bh_locale";

export const LOCALES: { code: Locale; label: string; english: string }[] = [
  { code: "en", label: "English", english: "English" },
  { code: "hi", label: "हिंदी", english: "Hindi" },
  { code: "gu", label: "ગુજરાતી", english: "Gujarati" },
];

export function isLocale(value: string | undefined): value is Locale {
  return value === "en" || value === "hi" || value === "gu";
}
