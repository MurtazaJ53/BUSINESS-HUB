"use client";

import React, { useState, useMemo } from "react";
import {
  Wallet,
  Plus,
  Search,
  Calendar,
  Tag,
  DollarSign,
  Receipt,
  FileSpreadsheet,
  CheckCircle2,
  X,
  PieChart,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface ExpenseRecord {
  id: string;
  shop?: string;
  title: string;
  category: string;
  amount: number;
  payment_mode: "cash" | "bank" | "upi";
  reference_number?: string;
  created_at: string;
}

const SEED_EXPENSES: ExpenseRecord[] = [
  {
    id: "exp-1",
    shop: "shop-1",
    title: "Store Electricity Bill (July)",
    category: "Utilities",
    amount: 4850.0,
    payment_mode: "upi",
    reference_number: "UPPCL-90218",
    created_at: "2026-07-25T14:00:00Z",
  },
  {
    id: "exp-2",
    shop: "shop-1",
    title: "Store Commercial Rent (July)",
    category: "Rent",
    amount: 35000.0,
    payment_mode: "bank",
    reference_number: "NEFT-889102",
    created_at: "2026-08-01T10:00:00Z",
  },
  {
    id: "exp-3",
    shop: "shop-1",
    title: "Staff Tea & Evening Refreshments",
    category: "Tea & Refreshments",
    amount: 320.0,
    payment_mode: "cash",
    created_at: "2026-08-02T16:00:00Z",
  },
  {
    id: "exp-4",
    shop: "shop-1",
    title: "Eco-friendly Packaging Bags (500 pcs)",
    category: "Packaging",
    amount: 1400.0,
    payment_mode: "cash",
    reference_number: "BILL-PKG-44",
    created_at: "2026-08-02T11:30:00Z",
  },
];

export function ExpensesManager() {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(SEED_EXPENSES);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Add Expense form
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Tea & Refreshments");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "bank" | "upi">("cash");
  const [refNum, setRefNum] = useState("");

  const categories = [
    "Rent",
    "Utilities",
    "Staff Salaries",
    "Tea & Refreshments",
    "Packaging",
    "Maintenance",
    "Logistics & Freight",
    "Municipal & Taxes",
  ];

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          e.title.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          (e.reference_number && e.reference_number.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [expenses, categoryFilter, search]);

  const metrics = useMemo(() => {
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    const cashOutflow = expenses
      .filter((e) => e.payment_mode === "cash")
      .reduce((s, e) => s + e.amount, 0);
    return { total, cashOutflow };
  }, [expenses]);

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const newExp: ExpenseRecord = {
      id: `exp-${Date.now()}`,
      shop: "shop-1",
      title,
      category,
      amount: parseFloat(amount) || 0,
      payment_mode: paymentMode,
      reference_number: refNum || undefined,
      created_at: new Date().toISOString(),
    };
    setExpenses((prev) => [newExp, ...prev]);
    setIsAddOpen(false);
    setTitle("");
    setAmount("");
    setRefNum("");
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary tracking-tight">
            Expenses & Petty Cash Register
          </h2>
          <p className="text-xs text-[var(--text-tertiary)]">
            Log overhead operating expenses, utility payments, and till cash outflows
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-[var(--surface)] border border-[var(--border-soft)] rounded-xl text-xs">
            <span className="text-[var(--text-secondary)]">Total Recorded Expenses: </span>
            <strong className="text-text-primary font-mono">{formatCurrency(metrics.total)}</strong>
          </div>

          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-text-primary text-xs font-semibold rounded-xl shadow-md shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-[var(--text-tertiary)] font-medium">
              Till Cash Outflows
            </div>
            <div className="text-2xl font-black text-amber-400 font-mono mt-1">
              {formatCurrency(metrics.cashOutflow)}
            </div>
            <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
              Deducted automatically from daily cash float
            </div>
          </div>
          <Wallet className="w-8 h-8 text-amber-400/40" />
        </div>

        <div className="p-4 bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-[var(--text-tertiary)] font-medium">
              Digital / Bank Transfers
            </div>
            <div className="text-2xl font-black text-blue-400 font-mono mt-1">
              {formatCurrency(metrics.total - metrics.cashOutflow)}
            </div>
            <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
              Paid via NEFT / RTGS / UPI
            </div>
          </div>
          <DollarSign className="w-8 h-8 text-blue-400/40" />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-[var(--text-tertiary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search expense by description or receipt reference..."
            className="w-full pl-10 pr-4 py-2 bg-bg-soft border border-[var(--border-soft)] focus:border-[var(--primary)] rounded-xl text-xs text-text-primary placeholder-[var(--text-tertiary)] outline-none"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-bg-soft border border-[var(--border-soft)] text-xs text-text-primary rounded-xl outline-none"
        >
          <option value="all">All Expense Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Expenses Table */}
      <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[var(--bg-soft)] border-b border-[var(--border-soft)] text-[var(--text-tertiary)] font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Expense Title</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-center">Payment Mode</th>
                <th className="py-3 px-4">Reference / Voucher</th>
                <th className="py-3 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)]">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-xs text-[var(--text-tertiary)]">
                    No expense entries found.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-bg-base transition-colors">
                    <td className="py-3 px-4 font-semibold text-text-primary">{exp.title}</td>
                    <td className="py-3 px-4 text-[var(--text-secondary)]">
                      <span className="px-2 py-0.5 rounded-full bg-bg-base border border-[var(--border-soft)] text-[10px]">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[var(--text-tertiary)]">
                      {formatDate(exp.created_at)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          exp.payment_mode === "cash"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-blue-500/20 text-blue-300"
                        }`}
                      >
                        {exp.payment_mode}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[var(--text-tertiary)]">
                      {exp.reference_number || "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-red-400">
                      {formatCurrency(exp.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Record Expense */}
      {isAddOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsAddOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[var(--border-soft)] flex items-center justify-between bg-[var(--bg-soft)]">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-[var(--primary-light)]" />
                <span className="font-semibold text-sm text-text-primary">Record Operating Expense</span>
              </div>
              <button
                onClick={() => setIsAddOpen(false)}
                className="p-1 text-[var(--text-tertiary)] hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Expense Description *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. July Store Electricity Bill"
                  className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="₹0.00"
                    className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none"
                  >
                    <option value="cash">Cash (From Till Float)</option>
                    <option value="upi">UPI / QR</option>
                    <option value="bank">Bank Transfer (NEFT/RTGS)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Bill / Voucher Ref #
                  </label>
                  <input
                    type="text"
                    value={refNum}
                    onChange={(e) => setRefNum(e.target.value)}
                    placeholder="e.g. UTR-8910 or Inv #12"
                    className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border-soft)] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-text-primary bg-bg-base rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-md"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
