"use client";

import { useState } from "react";
import { Languages } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { LOCALES } from "@/lib/i18n/shared";

/** Language picker. Each option is written in its own script, because someone
 *  who cannot read English cannot find "Hindi" in a list. */
export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Change language"
        className="p-2 rounded-xl bg-bg-base hover:bg-bg-soft border border-border-soft text-text-secondary transition-colors flex items-center gap-1.5"
      >
        <Languages className="w-4 h-4" />
        <span className="text-[11px] font-extrabold uppercase">{current.code}</span>
      </button>

      {open && (
        <>
          {/* Click-away layer */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 z-50 w-44 rounded-2xl border border-border-soft bg-surface shadow-lg overflow-hidden">
            {LOCALES.map((option) => (
              <button
                key={option.code}
                type="button"
                onClick={() => {
                  setLocale(option.code);
                  setOpen(false);
                }}
                className={`w-full px-4 py-2.5 text-left text-sm font-bold transition-colors ${
                  option.code === locale
                    ? "bg-[var(--primary)]/10 text-[var(--primary-hover)]"
                    : "text-text-primary hover:bg-bg-base"
                }`}
              >
                {option.label}
                <span className="block text-[10px] font-semibold text-text-tertiary">
                  {option.english}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
