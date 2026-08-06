import type { Metadata } from "next";
import { cookies } from "next/headers";

import "./globals.css";
import { LocaleProvider } from "@/lib/i18n";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n/shared";

export const metadata: Metadata = {
  title: "Business Hub - Smart POS & Cloud Ledger",
  description: "Retail Point of Sale, Smart Inventory & Multi-Shop Management",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the locale server-side so the first paint is already in the right
  // language, and so <html lang> is correct for screen readers.
  const cookieStore = await cookies();
  const stored = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(stored) ? stored : "en";

  return (
    // suppressHydrationWarning: the inline script below deliberately rewrites
    // data-theme before React hydrates, so the server's "light" and the
    // client's resolved theme legitimately differ. Without this, every page
    // load logs a hydration error. It suppresses the warning for this element's
    // attributes only, not for the tree inside it.
    <html
      lang={locale}
      className="h-full antialiased"
      data-theme="light"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme') || 'system';
                  if (theme === 'system') {
                    var dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
                  } else {
                    document.documentElement.setAttribute('data-theme', theme);
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full">
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
