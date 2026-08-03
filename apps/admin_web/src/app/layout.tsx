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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[#EEF2F6] text-[#0F172A]">
        {children}
      </body>
    </html>
  );
}
