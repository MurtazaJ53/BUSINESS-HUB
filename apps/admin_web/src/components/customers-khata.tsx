"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Loader2,
  AlertCircle
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Customer, CustomerSummaryPayload } from "@/lib/types";

interface CustomersKhataProps {
  initialCustomers: Customer[];
  initialSummary: CustomerSummaryPayload;
  shopId: string;
}


/** Pull the timeline rows out of the API payload.
 *
 * Guarded because `setTimeline(payload.entries || [])` is a trap: when the
 * payload is an array, `.entries` is Array.prototype.entries — a truthy
 * FUNCTION — and React runs a function passed to a setter as a state updater,
 * which throws "Cannot convert undefined or null to object".
 */
function readTimelineEntries(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  const entries = (payload as { entries?: unknown })?.entries;
  return Array.isArray(entries) ? entries : [];
}

export function CustomersKhata({ initialCustomers, initialSummary, shopId }: CustomersKhataProps) {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers ?? []);
  const [summary, setSummary] = useState<CustomerSummaryPayload>(initialSummary ?? { total_customers: 0, active_credit_customers: 0, total_outstanding_balance: "0.00", total_lifetime_spend: null });
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    (initialCustomers ?? [])[0]?.id || ""
  );
  const [search, setSearch] = useState("");
  const [timeline, setTimeline] = useState<any[]>([]);
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);

  // Modal states
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isTxnModalOpen, setIsTxnModalOpen] = useState(false);
  const [txnType, setTxnType] = useState<"credit" | "debit">("credit");
  const [txnAmount, setTxnAmount] = useState("");
  const [txnDesc, setTxnDesc] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Add customer form
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newOpeningBalance, setNewOpeningBalance] = useState("0");

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || customers[0] || null;
  }, [customers, selectedCustomerId]);

  // Fetch timeline whenever selected customer changes
  useEffect(() => {
    if (!selectedCustomerId) {
      setTimeline([]);
      return;
    }
    let active = true;
    const fetchTimeline = async () => {
      setIsTimelineLoading(true);
      try {
        const res = await fetch(`/api/customers/${selectedCustomerId}/ledger`);
        if (!res.ok) throw new Error("Failed to load ledger history");
        const data = await res.json();
        if (active) {
          setTimeline(readTimelineEntries(data));
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setIsTimelineLoading(false);
      }
    };
    fetchTimeline();
    return () => {
      active = false;
    };
  }, [selectedCustomerId]);

  // Debounced search customer list
  useEffect(() => {
    let active = true;
    const fetchFilteredCustomers = async () => {
      try {
        const res = await fetch(`/api/customers?q=${encodeURIComponent(search)}`);
        if (!res.ok) throw new Error("Failed to search customers");
        const data = await res.json();
        if (active) {
          setCustomers(data);
          if (data.length > 0 && !data.some((c: Customer) => c.id === selectedCustomerId)) {
            setSelectedCustomerId(data[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    const debounce = setTimeout(fetchFilteredCustomers, 300);
    return () => {
      active = false;
      clearTimeout(debounce);
    };
  }, [search]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError("");

    const payload = {
      name: newName,
      phone: newPhone || "-",
      email: newEmail || undefined,
      notes: newNotes || "",
      opening_balance: parseFloat(newOpeningBalance) || 0,
    };

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to create customer.");
      }

      const newCust = await res.json() as Customer;
      
      // Close modal and reset fields
      setIsAddCustomerOpen(false);
      setNewName("");
      setNewPhone("");
      setNewEmail("");
      setNewNotes("");
      setNewOpeningBalance("0");

      // Refresh customers list and summary
      const updatedList = await fetch("/api/customers").then((r) => r.json());
      const updatedSummary = await fetch("/api/customers/summary").then((r) => r.json());
      
      setCustomers(updatedList);
      setSummary(updatedSummary);
      setSelectedCustomerId(newCust.id);
    } catch (err: any) {
      setSubmitError(err.message || "An error occurred while creating customer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordKhataTxn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    setIsSubmitting(true);
    setSubmitError("");

    const amt = parseFloat(txnAmount) || 0;
    const isCredit = txnType === "credit"; // repayment reduces outstanding balance (negative delta)
    const amountDelta = isCredit ? -amt : amt;

    const payload = {
      event_type: isCredit ? "payment" : "adjustment",
      amount_delta: amountDelta,
      total_spent_delta: 0,
      note: txnDesc || (isCredit ? "Repayment received" : "Manual debit adjustment"),
      occurred_at: new Date().toISOString(),
    };

    try {
      const res = await fetch(`/api/customers/${selectedCustomer.id}/ledger`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to save ledger transaction.");
      }

      // Close modal and reset fields
      setIsTxnModalOpen(false);
      setTxnAmount("");
      setTxnDesc("");

      // Refresh list, summary, and current customer timeline
      const [updatedList, updatedSummary, updatedTimeline] = await Promise.all([
        fetch("/api/customers").then((r) => r.json()),
        fetch("/api/customers/summary").then((r) => r.json()),
        fetch(`/api/customers/${selectedCustomer.id}/ledger`).then((r) => r.json()),
      ]);

      setCustomers(updatedList);
      setSummary(updatedSummary);
      setTimeline(readTimelineEntries(updatedTimeline));
    } catch (err: any) {
      setSubmitError(err.message || "An error occurred while saving ledger entry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary tracking-tight">
            Udhaar Book & Customer CRM
          </h2>
          <p className="text-xs text-[var(--text-tertiary)]">
            Manage customer directories, track outstanding credits, and log repayments
          </p>
        </div>

        <button
          onClick={() => setIsAddCustomerOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-semibold rounded-xl shadow-md shadow-blue-500/20 self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl">
          <div className="text-xs text-[var(--text-tertiary)] font-medium">Total Customers</div>
          <div className="text-2xl font-black text-text-primary font-mono mt-1">
            {summary.total_customers}
          </div>
        </div>

        <div className="p-4 bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl">
          <div className="text-xs text-[var(--text-tertiary)] font-medium">Active Udhaar Accounts</div>
          <div className="text-2xl font-black text-[var(--warning-strong)] font-mono mt-1">
            {summary.active_credit_customers}
          </div>
        </div>

        <div className="p-4 bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl">
          <div className="text-xs text-[var(--text-tertiary)] font-medium">Total Outstanding Credits</div>
          <div className="text-2xl font-black text-[var(--error-strong)] font-mono mt-1">
            {formatCurrency(parseFloat(summary.total_outstanding_balance || "0"))}
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        
        {/* Left Side: Customer List */}
        <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-[24px] p-4 flex flex-col gap-4 h-[600px]">
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--text-tertiary)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone..."
              className="w-full pl-9 pr-3 py-2 bg-bg-soft border border-[var(--border-soft)] focus:border-[var(--primary)] rounded-xl text-xs text-text-primary placeholder-[var(--text-tertiary)] outline-none"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {customers.length === 0 ? (
              <div className="text-center text-xs text-[var(--text-tertiary)] py-8">
                No customers found.
              </div>
            ) : (
              customers.map((cust) => {
                const isSelected = cust.id === selectedCustomerId;
                const outstanding = parseFloat(cust.balance || "0");
                return (
                  <button
                    key={cust.id}
                    onClick={() => setSelectedCustomerId(cust.id)}
                    className={`w-full text-left p-3 rounded-xl transition-all border flex items-center justify-between ${
                      isSelected
                        ? "bg-primary/10 border-primary/20"
                        : "bg-transparent border-transparent hover:bg-bg-soft"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-text-primary truncate">{cust.name}</div>
                      <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{cust.phone}</div>
                    </div>

                    {outstanding > 0 && (
                      <span className="text-[10px] font-bold text-[var(--error-strong)] font-mono whitespace-nowrap bg-[var(--error)]/5 px-2 py-0.5 rounded-full border border-[var(--error)]/10">
                        ₹{outstanding.toLocaleString("en-IN")}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Customer Ledger Timeline */}
        <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-[24px] p-6 flex flex-col gap-6 h-[600px]">
          {selectedCustomer ? (
            <>
              {/* Header profile details */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-soft)] pb-4">
                <div>
                  <h3 className="text-base font-bold text-text-primary">{selectedCustomer.name}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-1.5 text-xs text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                      {selectedCustomer.phone}
                    </span>
                    {selectedCustomer.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                        {selectedCustomer.email}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setTxnType("debit");
                      setIsTxnModalOpen(true);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[var(--error)]/10 hover:bg-[var(--error)]/20 text-[var(--error-strong)] rounded-xl text-xs font-semibold transition-all"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Give Credit (Udhaar)</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      setTxnType("credit");
                      setIsTxnModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[var(--success-dark)] hover:bg-[var(--success)] text-white rounded-xl text-xs font-semibold transition-all shadow-md"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>Record Repayment</span>
                  </button>
                </div>
              </div>

              {/* Outstanding metrics box */}
              <div className="grid grid-cols-2 gap-4 bg-bg-soft border border-[var(--border-soft)] rounded-2xl p-4">
                <div>
                  <div className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                    Total Outstanding Due
                  </div>
                  <div className="text-base font-black font-mono text-[var(--error-strong)] mt-0.5">
                    {formatCurrency(parseFloat(selectedCustomer.balance || "0"))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                    Lifetime Business Spend
                  </div>
                  <div className="text-base font-black font-mono text-text-primary mt-0.5">
                    {formatCurrency(parseFloat(selectedCustomer.total_spent || "0"))}
                  </div>
                </div>
              </div>

              {/* Timeline feed */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 relative">
                {isTimelineLoading && (
                  <div className="absolute inset-0 bg-surface/50 backdrop-blur-[1px] flex items-center justify-center z-10">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  </div>
                )}
                
                <div className="text-xs font-bold text-text-primary">Ledger History Timeline</div>
                {timeline.length === 0 ? (
                  <div className="text-center text-xs text-[var(--text-tertiary)] py-12">
                    No ledger transactions recorded for this customer yet.
                  </div>
                ) : (
                  <div className="relative pl-4 border-l border-[var(--border-soft)] ml-2 space-y-4 pt-1">
                    {timeline.map((entry) => {
                      const isCredit = parseFloat(entry.amount_delta) < 0;
                      const amtAbs = Math.abs(parseFloat(entry.amount_delta));
                      return (
                        <div key={entry.id} className="relative group">
                          {/* Dot indicator */}
                          <span
                            className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-[var(--surface)] ${
                              isCredit ? "bg-[var(--success)]" : "bg-[var(--error)]"
                            }`}
                          />
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-xs font-bold text-text-primary">
                                {entry.note}
                              </p>
                              <span className="text-[10px] text-[var(--text-tertiary)] block mt-0.5">
                                {formatDate(entry.occurred_at)}
                              </span>
                              {entry.actor_name && (
                                <span className="text-[9px] text-[var(--text-tertiary)] italic block mt-0.5">
                                  Logged by: {entry.actor_name}
                                </span>
                              )}
                            </div>
                            
                            <div className="text-right">
                              <span
                                className={`font-mono font-bold text-xs ${
                                  isCredit ? "text-[var(--success-strong)]" : "text-[var(--error-strong)]"
                                }`}
                              >
                                {isCredit ? "-" : "+"} ₹{amtAbs.toLocaleString("en-IN")}
                              </span>
                              <span className="block text-[9px] text-[var(--text-tertiary)] font-mono mt-0.5">
                                Bal: ₹{parseFloat(entry.running_balance || "0").toLocaleString("en-IN")}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-[var(--text-tertiary)]">
              No customer selected. Add or search for a customer to open their ledger.
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Record Transaction */}
      {isTxnModalOpen && selectedCustomer && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setIsTxnModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[var(--border-soft)] flex items-center justify-between bg-bg-soft">
              <span className="font-semibold text-sm text-text-primary">
                {txnType === "credit" ? "Record Customer Payment" : "Issue Store Credit (Udhaar)"}
              </span>
              <button
                onClick={() => setIsTxnModalOpen(false)}
                className="p-1 text-[var(--text-tertiary)] hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordKhataTxn} className="p-6 space-y-4">
              {submitError && (
                <div className="p-3 bg-[var(--error)]/10 border border-[var(--error)]/20 text-[var(--error-strong)] text-xs rounded-xl font-bold">
                  {submitError}
                </div>
              )}

              <p className="text-xs text-[var(--text-secondary)]">
                Record ledger entry for <strong className="text-text-primary">{selectedCustomer.name}</strong>.
              </p>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={txnAmount}
                  onChange={(e) => setTxnAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-base font-mono font-bold text-text-primary focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Description / Reference Note *
                </label>
                <input
                  type="text"
                  required
                  value={txnDesc}
                  onChange={(e) => setTxnDesc(e.target.value)}
                  placeholder={txnType === "credit" ? "e.g. Received via GPay" : "e.g. Credit sale of groceries"}
                  className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="pt-3 border-t border-[var(--border-soft)] flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsTxnModalOpen(false)}
                  className="px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-text-primary bg-bg-base rounded-xl disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-5 py-2 text-xs font-semibold text-white rounded-xl shadow-md flex items-center gap-1.5 disabled:opacity-50 ${
                    txnType === "credit"
                      ? "bg-[var(--success-dark)] hover:bg-[var(--success)]"
                      : "bg-[var(--error-dark)] hover:bg-[var(--error)]"
                  }`}
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{txnType === "credit" ? "Record Repayment" : "Confirm Udhaar"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Customer */}
      {isAddCustomerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setIsAddCustomerOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[var(--border-soft)] flex items-center justify-between bg-bg-soft">
              <span className="font-semibold text-sm text-text-primary">Add New Customer</span>
              <button
                onClick={() => setIsAddCustomerOpen(false)}
                className="p-1 text-[var(--text-tertiary)] hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="p-6 space-y-4">
              {submitError && (
                <div className="p-3 bg-[var(--error)]/10 border border-[var(--error)]/20 text-[var(--error-strong)] text-xs rounded-xl font-bold">
                  {submitError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Customer Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Ramesh Verma"
                  className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="e.g. name@example.com"
                    className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Opening Udhaar Balance (₹)
                </label>
                <input
                  type="number"
                  value={newOpeningBalance}
                  onChange={(e) => setNewOpeningBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Customer Notes
                </label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Loyalty details, special terms, credit policies..."
                  rows={3}
                  className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-[var(--border-soft)] flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-text-primary bg-bg-base rounded-xl disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Add Customer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
