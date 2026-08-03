"use client";

import React, { useState } from "react";
import {
  Settings,
  Building2,
  Receipt,
  Printer,
  Shield,
  CreditCard,
  CheckCircle2,
  Save,
  QrCode,
  Sliders,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export function StoreSettings({
  currentShopName = "Business Hub Supermarket",
  planTier = "starter",
}: {
  currentShopName?: string;
  planTier?: string;
}) {
  const [activeTab, setActiveTab] = useState<"general" | "tax" | "hardware" | "plan">("general");

  // Form State
  const [shopName, setShopName] = useState(currentShopName);
  const [legalName, setLegalName] = useState("Murtaza Retail Enterprises Pvt Ltd");
  const [phone, setPhone] = useState("+91 98450 00000");
  const [email, setEmail] = useState("store@businesshub.com");
  const [address, setAddress] = useState("Shop 4, Commercial Complex, Main Road, Mumbai 400001");
  const [currency, setCurrency] = useState("INR");

  // Tax State
  const [gstin, setGstin] = useState("27AAACB1234F1Z5");
  const [invoicePrefix, setInvoicePrefix] = useState("INV-");
  const [footerNotes, setFooterNotes] = useState("Thank you for shopping with us! Goods once sold cannot be returned without original receipt.");

  // Hardware State
  const [paperWidth, setPaperWidth] = useState<"58mm" | "80mm">("80mm");
  const [autoPrint, setAutoPrint] = useState(true);
  const [scannerDelay, setScannerDelay] = useState("50");

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-text-primary tracking-tight">Store & POS Settings</h2>
          <p className="text-xs text-[var(--text-tertiary)]">
            Configure store profile, GSTIN parameters, thermal receipt layout, and hardware
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-xl animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>Settings Saved!</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border-soft)]">
        <button
          onClick={() => setActiveTab("general")}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "general"
              ? "border-[var(--primary)] text-white"
              : "border-transparent text-[var(--text-tertiary)] hover:text-white"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Store Profile</span>
        </button>
        <button
          onClick={() => setActiveTab("tax")}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "tax"
              ? "border-[var(--primary)] text-white"
              : "border-transparent text-[var(--text-tertiary)] hover:text-white"
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>GST & Invoicing</span>
        </button>
        <button
          onClick={() => setActiveTab("hardware")}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "hardware"
              ? "border-[var(--primary)] text-white"
              : "border-transparent text-[var(--text-tertiary)] hover:text-white"
          }`}
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Printers & Barcode</span>
        </button>
        <button
          onClick={() => setActiveTab("plan")}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "plan"
              ? "border-[var(--primary)] text-white"
              : "border-transparent text-[var(--text-tertiary)] hover:text-white"
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Plan & Subscription</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* General Store Tab */}
        {activeTab === "general" && (
          <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-text-primary mb-4 pb-2 border-b border-[var(--border-soft)]">
              Store Identity & Contact Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Store Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Legal Entity / Business Name
                </label>
                <input
                  type="text"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Store Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none focus:border-[var(--primary)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Full Physical Address (Printed on Invoices)
              </label>
              <textarea
                rows={3}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none focus:border-[var(--primary)] resize-none"
              />
            </div>
          </div>
        )}

        {/* Tax & Invoicing Tab */}
        {activeTab === "tax" && (
          <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-text-primary mb-4 pb-2 border-b border-[var(--border-soft)]">
              GSTIN & Invoice Numbering Rules
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Store GSTIN
                </label>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  placeholder="27AAACB1234F1Z5"
                  className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none focus:border-[var(--primary)] uppercase font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Invoice Sequence Prefix
                </label>
                <input
                  type="text"
                  value={invoicePrefix}
                  onChange={(e) => setInvoicePrefix(e.target.value)}
                  placeholder="INV-"
                  className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none focus:border-[var(--primary)] font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Receipt Footer Terms & Policy
              </label>
              <textarea
                rows={3}
                value={footerNotes}
                onChange={(e) => setFooterNotes(e.target.value)}
                className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none focus:border-[var(--primary)] resize-none"
              />
            </div>
          </div>
        )}

        {/* Hardware & Printer Tab */}
        {activeTab === "hardware" && (
          <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-text-primary mb-4 pb-2 border-b border-[var(--border-soft)]">
              Thermal Receipt Printers & USB Scanners
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Thermal Paper Width
                </label>
                <select
                  value={paperWidth}
                  onChange={(e) => setPaperWidth(e.target.value as any)}
                  className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none"
                >
                  <option value="80mm">80mm Standard POS Thermal Roll</option>
                  <option value="58mm">58mm Compact Handheld Roll</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Barcode Scanner Keystroke Gap (ms)
                </label>
                <input
                  type="number"
                  value={scannerDelay}
                  onChange={(e) => setScannerDelay(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoPrint}
                  onChange={(e) => setAutoPrint(e.target.checked)}
                  className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 bg-bg-soft border-[var(--border-soft)]"
                />
                <span className="text-xs text-white font-medium">
                  Auto-trigger browser print dialog on completing checkout
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Plan & Subscription Tab */}
        {activeTab === "plan" && (
          <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-text-primary">Current Subscription Tier</h3>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                  Your store is currently running on the {planTier.toUpperCase()} tier
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {planTier}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[var(--bg-soft)] border border-[var(--border-soft)]">
                <div className="text-xs text-[var(--text-tertiary)]">Product Catalog</div>
                <div className="text-xl font-bold text-text-primary mt-1">Unlimited</div>
              </div>
              <div className="p-4 rounded-xl bg-[var(--bg-soft)] border border-[var(--border-soft)]">
                <div className="text-xs text-[var(--text-tertiary)]">Staff Terminals</div>
                <div className="text-xl font-bold text-text-primary mt-1">5 POS Desks</div>
              </div>
              <div className="p-4 rounded-xl bg-[var(--bg-soft)] border border-[var(--border-soft)]">
                <div className="text-xs text-[var(--text-tertiary)]">GST Invoicing</div>
                <div className="text-xl font-bold text-emerald-400 mt-1">Full GSTR-1</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-text-primary text-xs font-semibold rounded-xl shadow-lg shadow-blue-500/25"
          >
            <Save className="w-4 h-4" />
            <span>Save Store Preferences</span>
          </button>
        </div>
      </form>
    </div>
  );
}
