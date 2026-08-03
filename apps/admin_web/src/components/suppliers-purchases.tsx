"use client";

import React, { useState, useMemo } from "react";
import {
  Truck,
  Plus,
  Search,
  Phone,
  Building,
  FileCheck,
  Calendar,
  DollarSign,
  CheckCircle2,
  X,
  ArrowRight,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface SupplierRecord {
  id: string;
  shop?: string;
  name: string;
  contact_person?: string;
  phone: string;
  email?: string;
  gstin?: string;
  address?: string;
  balance_due: number;
  created_at: string;
}

export interface PurchaseOrderRecord {
  id: string;
  shop?: string;
  supplier_id: string;
  supplier_name: string;
  invoice_number: string;
  total_amount: number;
  paid_amount: number;
  status: "received" | "draft" | "ordered" | "cancelled" | string;
  items_count: number;
  created_at: string;
}

const SEED_SUPPLIERS: SupplierRecord[] = [
  {
    id: "sup-1",
    shop: "shop-1",
    name: "National FMCG Distributors Ltd",
    contact_person: "Manoj Agarwal",
    phone: "+91 98450 12345",
    email: "manoj@nationalfmcg.com",
    gstin: "27AABCN8921R1ZX",
    address: "Godown 4, Transport Nagar, Phase 2",
    balance_due: 42000.0,
    created_at: "2026-05-10T10:00:00Z",
  },
  {
    id: "sup-2",
    shop: "shop-1",
    name: "Golden Grain Mills & Agri Trading",
    contact_person: "Surendra Seth",
    phone: "+91 98220 99887",
    email: "orders@goldengrain.in",
    gstin: "27AAACG4412Q1ZR",
    address: "Grain Market Yard, Gate 3",
    balance_due: 0.0,
    created_at: "2026-06-01T10:00:00Z",
  },
];

const SEED_PURCHASES: PurchaseOrderRecord[] = [
  {
    id: "po-101",
    shop: "shop-1",
    supplier_id: "sup-1",
    supplier_name: "National FMCG Distributors Ltd",
    invoice_number: "INV-NF-8921",
    total_amount: 54000.0,
    paid_amount: 12000.0,
    status: "received",
    items_count: 8,
    created_at: "2026-07-28T11:00:00Z",
  },
  {
    id: "po-102",
    shop: "shop-1",
    supplier_id: "sup-2",
    supplier_name: "Golden Grain Mills & Agri Trading",
    invoice_number: "PO-GG-3301",
    total_amount: 32500.0,
    paid_amount: 32500.0,
    status: "received",
    items_count: 4,
    created_at: "2026-08-01T09:30:00Z",
  },
];

export function SuppliersPurchases() {
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>(SEED_SUPPLIERS);
  const [purchases, setPurchases] = useState<PurchaseOrderRecord[]>(SEED_PURCHASES);
  const [activeTab, setActiveTab] = useState<"purchases" | "suppliers">("purchases");
  const [search, setSearch] = useState("");

  // Modals
  const [isNewPoOpen, setIsNewPoOpen] = useState(false);
  const [isNewSupplierOpen, setIsNewSupplierOpen] = useState(false);

  // New PO form
  const [poSupplierId, setPoSupplierId] = useState(suppliers[0]?.id || "");
  const [poInvoiceNo, setPoInvoiceNo] = useState("");
  const [poTotalAmount, setPoTotalAmount] = useState("");
  const [poPaidAmount, setPoPaidAmount] = useState("");

  // New Supplier form
  const [supName, setSupName] = useState("");
  const [supContact, setSupContact] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supGstin, setSupGstin] = useState("");
  const [supAddress, setSupAddress] = useState("");

  const totalPayables = useMemo(() => {
    return suppliers.reduce((sum, s) => sum + (s.balance_due || 0), 0);
  }, [suppliers]);

  const handleCreatePo = (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find((s) => s.id === poSupplierId);
    const total = parseFloat(poTotalAmount) || 0;
    const paid = parseFloat(poPaidAmount) || 0;
    const due = total - paid;

    const newPo: PurchaseOrderRecord = {
      id: `po-${Date.now()}`,
      shop: "shop-1",
      supplier_id: poSupplierId,
      supplier_name: sup?.name || "Supplier",
      invoice_number: poInvoiceNo || `PO-${Date.now().toString().slice(-4)}`,
      total_amount: total,
      paid_amount: paid,
      status: "received",
      items_count: 1,
      created_at: new Date().toISOString(),
    };

    setPurchases((prev) => [newPo, ...prev]);

    // Update supplier balance
    if (due > 0 && sup) {
      setSuppliers((prev) =>
        prev.map((s) =>
          s.id === sup.id ? { ...s, balance_due: (s.balance_due || 0) + due } : s
        )
      );
    }

    setIsNewPoOpen(false);
    setPoInvoiceNo("");
    setPoTotalAmount("");
    setPoPaidAmount("");
  };

  const handleCreateSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    const newSup: SupplierRecord = {
      id: `sup-${Date.now()}`,
      shop: "shop-1",
      name: supName,
      contact_person: supContact,
      phone: supPhone,
      gstin: supGstin,
      address: supAddress,
      balance_due: 0,
      created_at: new Date().toISOString(),
    };
    setSuppliers((prev) => [newSup, ...prev]);
    setIsNewSupplierOpen(false);
    setSupName("");
    setSupContact("");
    setSupPhone("");
    setSupGstin("");
    setSupAddress("");
  };

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Suppliers & Inward Purchase Orders
          </h2>
          <p className="text-xs text-[var(--text-tertiary)]">
            Manage vendor accounts, record inventory deliveries, and monitor payables
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-xs">
            <span className="text-[var(--text-secondary)]">Total Vendor Payables:</span>
            <span className="font-bold text-red-400 font-mono">
              {formatCurrency(totalPayables)}
            </span>
          </div>

          <button
            onClick={() => setIsNewPoOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-semibold rounded-xl shadow-md shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Record Inward PO</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border-soft)]">
        <button
          onClick={() => setActiveTab("purchases")}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "purchases"
              ? "border-[var(--primary)] text-white"
              : "border-transparent text-[var(--text-tertiary)] hover:text-white"
          }`}
        >
          Purchase Inwards ({purchases.length})
        </button>
        <button
          onClick={() => setActiveTab("suppliers")}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "suppliers"
              ? "border-[var(--primary)] text-white"
              : "border-transparent text-[var(--text-tertiary)] hover:text-white"
          }`}
        >
          Supplier Directory ({suppliers.length})
        </button>
      </div>

      {activeTab === "purchases" ? (
        /* Purchase Orders Table */
        <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--bg-soft)] border-b border-[var(--border-soft)] text-[var(--text-tertiary)] font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Invoice / PO #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Total Inward</th>
                  <th className="py-3 px-4 text-right">Paid Amount</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {purchases.map((po) => {
                  const due = po.total_amount - po.paid_amount;
                  return (
                    <tr key={po.id} className="hover:bg-[var(--surface-strong)] transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-white">
                        {po.invoice_number}
                      </td>
                      <td className="py-3 px-4 text-[var(--text-tertiary)]">
                        {formatDate(po.created_at)}
                      </td>
                      <td className="py-3 px-4 text-white font-medium">{po.supplier_name}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300">
                          {po.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-white font-semibold">
                        {formatCurrency(po.total_amount)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-400">
                        {formatCurrency(po.paid_amount)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span className={due > 0 ? "text-red-400" : "text-[var(--text-tertiary)]"}>
                          {formatCurrency(due)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Supplier Directory Table */
        <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-xl space-y-4 p-4">
          <div className="flex justify-end">
            <button
              onClick={() => setIsNewSupplierOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface-strong)] hover:bg-[var(--surface)] border border-[var(--border-soft)] text-xs text-white rounded-xl"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Supplier</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {suppliers.map((sup) => (
              <div
                key={sup.id}
                className="p-4 bg-[var(--bg-soft)] border border-[var(--border-soft)] rounded-xl space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">{sup.name}</h4>
                    <div className="text-[11px] text-[var(--text-tertiary)]">
                      Contact: {sup.contact_person || "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-red-400">
                      {formatCurrency(sup.balance_due || 0)}
                    </div>
                    <div className="text-[9px] uppercase font-semibold text-[var(--text-tertiary)]">
                      Payable Due
                    </div>
                  </div>
                </div>

                <div className="text-xs text-[var(--text-secondary)] space-y-1 pt-2 border-t border-[var(--border-soft)]">
                  {sup.phone && <div>Phone: {sup.phone}</div>}
                  {sup.gstin && <div>GSTIN: {sup.gstin}</div>}
                  {sup.address && <div>Address: {sup.address}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: Record Inward PO */}
      {isNewPoOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsNewPoOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[var(--border-soft)] flex items-center justify-between bg-[var(--bg-soft)]">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-[var(--primary-light)]" />
                <span className="font-semibold text-sm text-white">Record Inward Delivery</span>
              </div>
              <button
                onClick={() => setIsNewPoOpen(false)}
                className="p-1 text-[var(--text-tertiary)] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePo} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Supplier *
                </label>
                <select
                  value={poSupplierId}
                  onChange={(e) => setPoSupplierId(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-deep)] border border-[var(--border-soft)] rounded-xl text-xs text-white focus:outline-none"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Vendor Invoice / Challan Number *
                </label>
                <input
                  type="text"
                  required
                  value={poInvoiceNo}
                  onChange={(e) => setPoInvoiceNo(e.target.value)}
                  placeholder="e.g. INV-2026-901"
                  className="w-full px-3 py-2 bg-[var(--bg-deep)] border border-[var(--border-soft)] rounded-xl text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Total Inward Bill (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={poTotalAmount}
                    onChange={(e) => setPoTotalAmount(e.target.value)}
                    placeholder="₹0.00"
                    className="w-full px-3 py-2 bg-[var(--bg-deep)] border border-[var(--border-soft)] rounded-xl text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Amount Paid Today (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={poPaidAmount}
                    onChange={(e) => setPoPaidAmount(e.target.value)}
                    placeholder="₹0.00"
                    className="w-full px-3 py-2 bg-[var(--bg-deep)] border border-[var(--border-soft)] rounded-xl text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border-soft)] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewPoOpen(false)}
                  className="px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-white bg-[var(--surface-strong)] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-md"
                >
                  Record Inward Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add New Supplier */}
      {isNewSupplierOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsNewSupplierOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[var(--border-soft)] flex items-center justify-between bg-[var(--bg-soft)]">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-[var(--primary-light)]" />
                <span className="font-semibold text-sm text-white">Add New Supplier</span>
              </div>
              <button
                onClick={() => setIsNewSupplierOpen(false)}
                className="p-1 text-[var(--text-tertiary)] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Supplier / Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  placeholder="e.g. Royal Spices & Herbs"
                  className="w-full px-3 py-2 bg-[var(--bg-deep)] border border-[var(--border-soft)] rounded-xl text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={supContact}
                    onChange={(e) => setSupContact(e.target.value)}
                    placeholder="Manoj"
                    className="w-full px-3 py-2 bg-[var(--bg-deep)] border border-[var(--border-soft)] rounded-xl text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={supPhone}
                    onChange={(e) => setSupPhone(e.target.value)}
                    placeholder="+91 98000 00000"
                    className="w-full px-3 py-2 bg-[var(--bg-deep)] border border-[var(--border-soft)] rounded-xl text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  GSTIN
                </label>
                <input
                  type="text"
                  value={supGstin}
                  onChange={(e) => setSupGstin(e.target.value)}
                  placeholder="27AABCR..."
                  className="w-full px-3 py-2 bg-[var(--bg-deep)] border border-[var(--border-soft)] rounded-xl text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  placeholder="Market Godown Address"
                  className="w-full px-3 py-2 bg-[var(--bg-deep)] border border-[var(--border-soft)] rounded-xl text-xs text-white focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-[var(--border-soft)] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewSupplierOpen(false)}
                  className="px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-white bg-[var(--surface-strong)] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-md"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
