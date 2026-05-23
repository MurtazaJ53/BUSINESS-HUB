import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Business Hub Admin",
  description: "Curated owner and manager workspace for Business Hub.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full bg-[var(--bg-app)] text-[var(--text-primary)]">
        {children}
      </body>
    </html>
  );
}
