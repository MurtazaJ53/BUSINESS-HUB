"use client";

import React, { useState, useMemo } from "react";
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  FileText,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Customer } from "@/lib/types";

export interface KhataTransaction {
  id: string;
  customer_id: string;
  amount: number;
  type: "credit" | "debit";
  description: string;
  balance_after: number;
  created_at: string;
}

const SEED_CUSTOMERS: Customer[] = [
  {
    id: "cust-1",
    name: "Ramesh Verma",
    phone: "+91 98234 56780",
    email: "ramesh.v@example.com",
    address: "B-402 Shanti Towers, MG Road, Sector 14",
    balance_amount: 14500.0,
    credit_limit: 20000.0,
    is_active: true,
    total_spend: 86400.0,
    last_order_at: "2026-08-01T14:30:00Z",
    created_at: "2026-06-10T10:00:00Z",
  },
  {
    id: "cust-2",
    name: "Priya Sharma",
    phone: "+91 98111 22334",
    email: "priya.s@example.com",
    address: "12 Green Park Extension",
    balance_amount: 0.0,
    credit_limit: 15000.0,
    is_active: true,
    total_spend: 34200.0,
    last_order_at: "2026-08-02T10:15:00Z",
    created_at: "2026-07-01T11:00:00Z",
  },
  {
    id: "cust-3",
    name: "Anil Kumar Gupta",
    phone: "+91 98765 11223",
    email: "anil.gupta@enterprise.in",
    address: "Plot 45, Udyog Vihar Phase 4",
    balance_amount: 8200.0,
    credit_limit: 10000.0,
    is_active: true,
    total_spend: 145000.0,
    last_order_at: "2026-07-29T16:45:00Z",
    created_at: "2026-05-15T09:00:00Z",
  },
];

const SEED_KHATA: Record<string, KhataTransaction[]> = {
  "cust-1": [
    {
      id: "txn-1",
      customer_id: "cust-1",
      amount: 18000.0,
      type: "debit",
      description: "Monthly Grocery Udhaar Order #INV-8912",
      balance_after: 18000.0,
      created_at: "2026-07-15T12:00:00Z",
    },
    {
      id: "txn-2",
      customer_id: "cust-1",
      amount: 5000.0,
      type: "credit",
      description: "UPI Payment received (UTR: 89012389)",
      balance_after: 13000.0,
      created_at: "2026-07-20T17:30:00Z",
    },
    {
      id: "txn-3",
      customer_id: "cust-1",
      amount: 1500.0,
      type: "debit",
      description: "Beverages & Dairy Bill #INV-90234",
      balance_after: 14500.0,
      created_at: "2026-08-01T14:30:00Z",
    },
  ],
};

export function CustomersKhata() {
  const [customers, setCustomers] = useState<Customer[]>(SEED_CUSTOMERS);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("cust-1");
  const [search, setSearch] = useState("");
  const [khataLedger, setKhataLedger] = useState<Record<string, KhataTransaction[]>>(SEED_KHATA);

  // Modal states
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isTxnModalOpen, setIsTxnModalOpen] = useState(false);
  const [txnType, setTxnType] = useState<"credit" | "debit">("credit");
  const [txnAmount, setTxnAmount] = useState("");
  const [txnDesc, setTxnDesc] = useState("");

  // Add customer form
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newCreditLimit, setNewCreditLimit] = useState("10000");

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || customers[0];
  }, [customers, selectedCustomerId]);

  const activeTransactions = useMemo(() => {
    return (selectedCustomer && khataLedger[selectedCustomer.id]) || [];
  }, [selectedCustomer, khataLedger]);

  const totalOutstandingKhata = useMemo(() => {
    return customers.reduce((sum, c) => sum + (c.balance_amount || 0), 0);
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  }, [customers, search]);

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    const newCust: Customer = {
      id: `cust-${Date.now()}`,
      name: newName,
      phone: newPhone,
      email: newEmail || undefined,
      address: newAddress || undefined,
      balance_amount: 0,
      credit_limit: parseFloat(newCreditLimit) || 10000,
      is_active: true,
      total_spend: 0,
      created_at: new Date().toISOString(),
    };
    setCustomers((prev) => [newCust, ...prev]);
    setSelectedCustomerId(newCust.id);
    setIsAddCustomerOpen(false);
    setNewName("");
    setNewPhone("");
    setNewEmail("");
    setNewAddress("");
  };

  const handleRecordKhataTxn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const amt = parseFloat(txnAmount) || 0;
    const isCredit = txnType === "credit"; // Payment in reduces due balance
    const currentBal = selectedCustomer.balance_amount || 0;
    const newBal = isCredit ? Math.max(0, currentBal - amt) : currentBal + amt;

    const newTxn: KhataTransaction = {
      id: `txn-${Date.now()}`,
      customer_id: selectedCustomer.id,
      amount: amt,
      type: txnType,
      description: txnDesc || (isCredit ? "Payment received" : "Credit sale (Udhaar)"),
      balance_after: newBal,
      created_at: new Date().toISOString(),
    };

    setKhataLedger((prev) => ({
      ...prev,
      [selectedCustomer.id]: [newTxn, ...(prev[selectedCustomer.id] || [])],
    }));

    setCustomers((prev) =>
      prev.map((c) =>
        c.id === selectedCustomer.id
          ? {
              ...c,
              balance_amount: newBal,
            }
          : c
      )
    );

    setIsTxnModalOpen(false);
    setTxnAmount("");
    setTxnDesc("");
  };

  const handleSendWhatsAppReminder = () => {
    if (!selectedCustomer || !selectedCustomer.phone) return;
    const phone = selectedCustomer.phone.replace(/[^0-9]/g, "");
    const msg = encodeURIComponent(
      `Dear ${selectedCustomer.name},\n\nYour outstanding balance with our store is ${formatCurrency(
        selectedCustomer.balance_amount || 0
      )}.\nPlease pay via UPI or visit the store.\n\nThank you!`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary tracking-tight">
            Customers & Khata Ledger (Udhaar Book)
          </h2>
          <p className="text-xs text-[var(--text-tertiary)]">
            Manage customer credit accounts, track receivables, and send WhatsApp payment reminders
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 text-xs">
            <span className="text-[var(--text-secondary)]">Total Market Receivables:</span>
            <span className="font-bold text-amber-400 font-mono">
              {formatCurrency(totalOutstandingKhata)}
            </span>
          </div>

          <button
            onClick={() => setIsAddCustomerOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-text-primary text-xs font-semibold rounded-xl shadow-md shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>New Customer</span>
          </button>
        </div>
      </div>

      {/* 2-Column Split: Customer List on Left, Active Ledger on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (List): 5 Cols */}
        <div className="lg:col-span-5 bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-xl flex flex-col h-[650px]">
          <div className="p-3 border-b border-[var(--border-soft)] bg-[var(--bg-soft)]">
            <div className="relative">
              <Search className="w-4 h-4 text-[var(--text-tertiary)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or phone..."
                className="w-full pl-9 pr-3 py-2 bg-[var(--surface)] border border-[var(--border-soft)] focus:border-[var(--primary)] rounded-xl text-xs text-text-primary placeholder-[var(--text-tertiary)] outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-soft)]">
            {filteredCustomers.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--text-tertiary)]">
                No customers found.
              </div>
            ) : (
              filteredCustomers.map((cust) => (
                <button
                  key={cust.id}
                  onClick={() => setSelectedCustomerId(cust.id)}
                  className={`w-full p-3.5 text-left flex items-start justify-between gap-3 transition-colors ${
                    selectedCustomerId === cust.id
                      ? "bg-blue-500/10 border-l-4 border-[var(--primary)]"
                      : "hover:bg-bg-base"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-xs text-text-primary truncate">{cust.name}</div>
                    <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                      {cust.phone || "No phone"}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`text-xs font-mono font-bold ${
                        (cust.balance_amount || 0) > 0 ? "text-amber-400" : "text-emerald-400"
                      }`}
                    >
                      {formatCurrency(cust.balance_amount || 0)}
                    </div>
                    <div className="text-[9px] text-[var(--text-tertiary)] uppercase font-semibold">
                      {(cust.balance_amount || 0) > 0 ? "Due" : "Settled"}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Column (Customer Profile & Ledger): 7 Cols */}
        <div className="lg:col-span-7 space-y-6">
          {selectedCustomer ? (
            <>
              {/* Customer Banner Card */}
              <div className="p-5 bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-text-primary">{selectedCustomer.name}</h3>
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/20 text-emerald-300">
                        Active Account
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-tertiary)] mt-1.5">
                      {selectedCustomer.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-[var(--primary-light)]" />
                          <span>{selectedCustomer.phone}</span>
                        </div>
                      )}
                      {selectedCustomer.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-[var(--primary-light)]" />
                          <span>{selectedCustomer.email}</span>
                        </div>
                      )}
                    </div>
                    {selectedCustomer.address && (
                      <div className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] mt-1">
                        <MapPin className="w-3 h-3 text-[var(--text-disabled)] shrink-0" />
                        <span>{selectedCustomer.address}</span>
                      </div>
                    )}
                  </div>

                  {/* WhatsApp Reminder Trigger */}
                  {(selectedCustomer.balance_amount || 0) > 0 && (
                    <button
                      onClick={handleSendWhatsAppReminder}
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-text-primary rounded-xl text-xs font-semibold transition-all shadow-md active:scale-95"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send WhatsApp Reminder</span>
                    </button>
                  )}
                </div>

                {/* Financial Health Row */}
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[var(--border-soft)]">
                  <div className="p-3 bg-bg-soft rounded-xl border border-[var(--border-soft)]">
                    <div className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">
                      Outstanding Due
                    </div>
                    <div
                      className={`text-base font-black font-mono mt-0.5 ${
                        (selectedCustomer.balance_amount || 0) > 0
                          ? "text-amber-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {formatCurrency(selectedCustomer.balance_amount || 0)}
                    </div>
                  </div>

                  <div className="p-3 bg-bg-soft rounded-xl border border-[var(--border-soft)]">
                    <div className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">
                      Credit Limit
                    </div>
                    <div className="text-base font-black font-mono text-text-primary mt-0.5">
                      {formatCurrency(selectedCustomer.credit_limit || 0)}
                    </div>
                  </div>

                  <div className="p-3 bg-bg-soft rounded-xl border border-[var(--border-soft)]">
                    <div className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">
                      Lifetime Spend
                    </div>
                    <div className="text-base font-black font-mono text-blue-400 mt-0.5">
                      {formatCurrency(selectedCustomer.total_spend || 0)}
                    </div>
                  </div>
                </div>

                {/* Quick Transaction Action Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      setTxnType("credit");
                      setIsTxnModalOpen(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-semibold text-xs rounded-xl transition-colors"
                  >
                    <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                    <span>Record Payment Received (Jama)</span>
                  </button>

                  <button
                    onClick={() => {
                      setTxnType("debit");
                      setIsTxnModalOpen(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 font-semibold text-xs rounded-xl transition-colors"
                  >
                    <ArrowUpRight className="w-4 h-4 text-red-400" />
                    <span>Give Credit Sale (Udhaar)</span>
                  </button>
                </div>
              </div>

              {/* Transaction Ledger Table */}
              <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-xl">
                <div className="p-4 border-b border-[var(--border-soft)] bg-[var(--bg-soft)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[var(--primary-light)]" />
                    <span className="font-semibold text-xs text-text-primary">Khata Ledger History</span>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[var(--bg-soft)] border-b border-[var(--border-soft)] text-[var(--text-tertiary)] font-semibold uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4">Description / Reference</th>
                        <th className="py-2.5 px-4 text-center">Type</th>
                        <th className="py-2.5 px-4 text-right">Amount</th>
                        <th className="py-2.5 px-4 text-right">Balance After</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-soft)]">
                      {activeTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-[var(--text-tertiary)]">
                            No ledger entries found for this customer.
                          </td>
                        </tr>
                      ) : (
                        activeTransactions.map((txn) => (
                          <tr key={txn.id} className="hover:bg-bg-base">
                            <td className="py-2.5 px-4 text-[var(--text-tertiary)]">
                              {formatDate(txn.created_at, true)}
                            </td>
                            <td className="py-2.5 px-4 text-text-primary font-medium">
                              {txn.description}
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                  txn.type === "credit"
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : "bg-red-500/20 text-red-300"
                                }`}
                              >
                                {txn.type === "credit" ? "Payment In" : "Udhaar Given"}
                              </span>
                            </td>
                            <td
                              className={`py-2.5 px-4 text-right font-mono font-bold ${
                                txn.type === "credit" ? "text-emerald-400" : "text-red-400"
                              }`}
                            >
                              {txn.type === "credit" ? "-" : "+"}
                              {formatCurrency(txn.amount)}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-[var(--text-secondary)]">
                              {formatCurrency(txn.balance_after)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-xs text-[var(--text-tertiary)]">
              Select a customer to view their profile and ledger.
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL: Record Khata Entry (Jama / Udhaar)                 */}
      {/* ========================================================= */}
      {isTxnModalOpen && selectedCustomer && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsTxnModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[var(--border-soft)] flex items-center justify-between bg-[var(--bg-soft)]">
              <div className="flex items-center gap-2">
                {txnType === "credit" ? (
                  <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                ) : (
                  <ArrowUpRight className="w-5 h-5 text-red-400" />
                )}
                <span className="font-semibold text-sm text-text-primary">
                  {txnType === "credit"
                    ? "Record Payment Received (Jama)"
                    : "Give Credit Sale (Udhaar)"}
                </span>
              </div>
              <button
                onClick={() => setIsTxnModalOpen(false)}
                className="p-1 text-[var(--text-tertiary)] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordKhataTxn} className="p-6 space-y-4">
              <div className="p-3 bg-bg-soft rounded-xl border border-[var(--border-soft)] text-xs">
                <span className="text-[var(--text-tertiary)]">Customer: </span>
                <strong className="text-white">{selectedCustomer.name}</strong>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={txnAmount}
                  onChange={(e) => setTxnAmount(e.target.value)}
                  placeholder="₹0.00"
                  className="w-full px-4 py-2.5 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-base font-mono font-bold text-text-primary focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Description / Note
                </label>
                <input
                  type="text"
                  value={txnDesc}
                  onChange={(e) => setTxnDesc(e.target.value)}
                  placeholder={
                    txnType === "credit"
                      ? "e.g. Cash payment or UPI UTR #8912"
                      : "e.g. Rice & Cooking Oil items"
                  }
                  className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-[var(--border-soft)] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsTxnModalOpen(false)}
                  className="px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-white bg-bg-base rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-xs font-semibold text-text-primary rounded-xl shadow-md ${
                    txnType === "credit"
                      ? "bg-emerald-600 hover:bg-emerald-500"
                      : "bg-red-600 hover:bg-red-500"
                  }`}
                >
                  Confirm Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Add New Customer                                   */}
      {/* ========================================================= */}
      {isAddCustomerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsAddCustomerOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[var(--border-soft)] flex items-center justify-between bg-[var(--bg-soft)]">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[var(--primary-light)]" />
                <span className="font-semibold text-sm text-text-primary">Add New Customer</span>
              </div>
              <button
                onClick={() => setIsAddCustomerOpen(false)}
                className="p-1 text-[var(--text-tertiary)] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Customer Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Vikramaditya Singh"
                  className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+91 98765 00000"
                    className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Credit Limit (₹)
                  </label>
                  <input
                    type="number"
                    value={newCreditLimit}
                    onChange={(e) => setNewCreditLimit(e.target.value)}
                    placeholder="10000"
                    className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="Street / Flat / Colony"
                  className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-[var(--border-soft)] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-white bg-bg-base rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-md"
                >
                  Create Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
