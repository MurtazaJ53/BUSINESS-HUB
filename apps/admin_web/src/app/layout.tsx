import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Business Hub - Smart POS & Cloud Ledger",
  description: "Retail Point of Sale, Smart Inventory & Multi-Shop Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the inline script below deliberately rewrites
    // data-theme before React hydrates, so the server's "light" and the
    // client's resolved theme legitimately differ. Without this, every page
    // load logs a hydration error. It suppresses the warning for this element's
    // attributes only, not for the tree inside it.
    <html
      lang="en"
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
        {children}
      </body>
    </html>
  );
}
