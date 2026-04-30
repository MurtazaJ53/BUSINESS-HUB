import { formatCurrency } from "@/lib/formatters";
import type { SalePaymentRecord } from "@/lib/types";

type PaymentsTableProps = {
  payments: SalePaymentRecord[];
  currencyCode?: string;
};

export function PaymentsTable({ payments, currencyCode = "INR" }: PaymentsTableProps) {
  return (
    <div className="panel-soft overflow-hidden rounded-[28px]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-soft)] text-left text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">
              <th className="px-5 py-4 font-medium">Receipt</th>
              <th className="px-5 py-4 font-medium">Customer</th>
              <th className="px-5 py-4 font-medium">Method</th>
              <th className="px-5 py-4 font-medium">Amount</th>
              <th className="px-5 py-4 font-medium">Reference</th>
              <th className="px-5 py-4 font-medium">Captured by</th>
            </tr>
          </thead>
          <tbody>
            {payments.length ? (
              payments.map((payment) => (
                <tr key={payment.id} className="border-b border-[rgba(152,164,189,0.08)] align-top">
                  <td className="px-5 py-4">
                    <p className="text-base font-semibold">{payment.receipt_number}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{payment.occurred_at}</p>
                  </td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">{payment.customer_name || "Walk-in"}</td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">{payment.payment_method}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-[var(--accent)]">
                    {formatCurrency(Number(payment.amount || 0), currencyCode)}
                  </td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">{payment.reference_code || "—"}</td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">{payment.actor_name || "System"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-[var(--text-secondary)]">
                  No payments returned from the phase 1 API yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
