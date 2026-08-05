"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, MessageCircle, PhoneOff, RefreshCw } from "lucide-react";

import { buildKhataReminder, whatsAppLink } from "@/lib/khata-reminder";
import { formatCurrency } from "@/lib/utils";

type Debtor = {
  id: string;
  name: string;
  phone: string;
  has_phone: boolean;
  balance: string;
  last_reminded_at: string | null;
  days_since_reminder: number | null;
  reminded_today: boolean;
  is_overdue: boolean;
};

type DebtorPayload = {
  overdue_after_days: number;
  total_outstanding: string;
  unreachable_count: number;
  items: Debtor[];
};

function num(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = parseFloat(String(value ?? "0"));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Mirrors `KhataDebtor.reminderStatus` in the mobile app. */
function reminderStatus(debtor: Debtor): string {
  if (debtor.reminded_today) return "Reminded today";
  const days = debtor.days_since_reminder;
  if (days === null) return "Never reminded";
  if (days === 1) return "Reminded yesterday";
  return `Reminded ${days} days ago`;
}

export function KhataCollection({
  shopName,
  upiVpa,
}: {
  shopName: string;
  upiVpa: string;
}) {
  const [data, setData] = useState<DebtorPayload | null>(null);
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/khata/debtors");
      if (!res.ok) throw new Error(`Could not load the khata list (${res.status})`);
      setData(await res.json());
    } catch (err: any) {
      setError(err?.message || "Something went wrong loading the list.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const all = useMemo(() => data?.items ?? [], [data]);
  const shown = onlyOverdue ? all.filter((d) => d.is_overdue) : all;
  const chaseable = all.filter((d) => d.has_phone && !d.reminded_today).length;

  /**
   * Open WhatsApp, then record the reminder.
   *
   * The mark only happens once the message window actually opened, matching
   * the phone: marking first would let a blocked pop-up quietly convince the
   * owner they had chased someone they hadn't.
   */
  const remind = async (debtor: Debtor) => {
    const message = buildKhataReminder({
      shopName,
      customerName: debtor.name,
      balance: num(debtor.balance),
      upiVpa,
    });
    const link = whatsAppLink(debtor.phone, message);
    if (!link) {
      setError(`${debtor.name} has no usable mobile number.`);
      return;
    }

    const opened = window.open(link, "_blank", "noopener,noreferrer");
    if (!opened) {
      setError(
        "Your browser blocked the WhatsApp window. Allow pop-ups for this site, then try again."
      );
      return;
    }

    setMarking(debtor.id);
    try {
      const res = await fetch(`/api/khata/remind/${debtor.id}`, { method: "POST" });
      if (!res.ok) throw new Error(`Could not record the reminder (${res.status})`);
      await load();
    } catch (err: any) {
      // The message did go out, so say exactly that rather than implying it
      // failed — otherwise the owner sends it twice.
      setError(
        `WhatsApp opened for ${debtor.name}, but recording the reminder failed. ` +
          `They may show as un-chased. (${err?.message || "unknown error"})`
      );
    } finally {
      setMarking(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 rounded-xl border border-border-soft bg-surface px-4 py-2.5 text-xs font-extrabold text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={onlyOverdue}
            onChange={(e) => setOnlyOverdue(e.target.checked)}
            className="w-4 h-4 accent-[var(--primary)]"
          />
          Only overdue ({data?.overdue_after_days ?? 7}+ days)
        </label>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-border-soft bg-surface px-4 py-2 text-xs font-extrabold text-text-secondary hover:text-text-primary disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-[var(--error)]/30 bg-[var(--error)]/10 px-5 py-4 text-sm font-semibold text-[var(--error-strong)]">
          {error}
        </div>
      )}

      {data && all.length > 0 && (
        <div className="rounded-[28px] border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-6 sm:p-7">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-text-tertiary">
            Money out on udhaar
          </p>
          <p className="mt-1 text-3xl sm:text-4xl font-[900] tracking-tight text-[var(--warning-strong)]">
            {formatCurrency(num(data.total_outstanding))}
          </p>
          <p className="mt-2 text-xs font-semibold text-text-secondary">
            {all.length} customer{all.length === 1 ? "" : "s"} owe you
            {chaseable > 0 && ` · ${chaseable} can be chased today`}
            {data.unreachable_count > 0 &&
              ` · ${data.unreachable_count} with no mobile number`}
          </p>
          {!upiVpa.trim() && (
            <p className="mt-3 text-xs font-semibold text-text-tertiary">
              Add your UPI ID in Business details to include a one-tap pay link in
              every reminder.
            </p>
          )}
        </div>
      )}

      {loading && !data ? null : shown.length === 0 ? (
        <div className="rounded-[28px] border border-border-soft bg-surface px-6 py-12 text-center">
          <CheckCircle2 className="w-9 h-9 mx-auto text-[var(--success-strong)]" />
          <p className="mt-3 text-sm font-black text-text-primary">
            {all.length === 0 ? "Nobody owes you anything" : "Nothing overdue"}
          </p>
          <p className="mt-1 text-xs font-semibold text-text-secondary">
            {all.length === 0
              ? "Credit sales appear here automatically."
              : "Everyone with a balance has been chased in the last week."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((debtor) => (
            <div
              key={debtor.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-border-soft bg-surface px-4 py-3.5"
            >
              <div className="flex-1 min-w-[12rem]">
                <p className="truncate text-sm font-bold text-text-primary">
                  {debtor.name}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                      debtor.reminded_today
                        ? "bg-[var(--success)]/15 text-[var(--success-strong)]"
                        : debtor.is_overdue
                          ? "bg-[var(--error)]/15 text-[var(--error-strong)]"
                          : "bg-[var(--warning)]/15 text-[var(--warning-strong)]"
                    }`}
                  >
                    {reminderStatus(debtor)}
                  </span>
                  {!debtor.has_phone && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-text-tertiary">
                      <PhoneOff className="w-3 h-3" />
                      No mobile number
                    </span>
                  )}
                </div>
              </div>
              <span className="text-sm font-[900] text-text-primary">
                {formatCurrency(num(debtor.balance))}
              </span>
              <button
                type="button"
                onClick={() => void remind(debtor)}
                disabled={!debtor.has_phone || marking === debtor.id}
                title={
                  debtor.reminded_today
                    ? "Already reminded today — sending again risks annoying them."
                    : undefined
                }
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-extrabold disabled:opacity-40 ${
                  debtor.reminded_today
                    ? "border border-border-soft text-text-secondary"
                    : "bg-[var(--primary)] text-white"
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                {marking === debtor.id
                  ? "Saving…"
                  : debtor.reminded_today
                    ? "Remind again"
                    : "Remind"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
