import { formatCurrency } from "@/lib/formatters";
import type { Sale } from "@/lib/types";

type SalesTableProps = {
  sales: Sale[];
  currencyCode?: string;
};

export function SalesTable({ sales, currencyCode = "INR" }: SalesTableProps) {
  return (
    <div className="panel-soft overflow-hidden rounded-[28px]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-soft)] text-left text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">
              <th className="px-5 py-4 font-medium">Receipt</th>
              <th className="px-5 py-4 font-medium">Customer</th>
              <th className="px-5 py-4 font-medium">Items</th>
              <th className="px-5 py-4 font-medium">Mode</th>
              <th className="px-5 py-4 font-medium">Date</th>
              <th className="px-5 py-4 font-medium">Total</th>
              <th className="px-5 py-4 font-medium">Due</th>
            </tr>
          </thead>
          <tbody>
            {sales.length ? (
              sales.map((sale) => (
                <tr key={sale.id} className="border-b border-[rgba(152,164,189,0.08)] align-top">
                  <td className="px-5 py-4">
                    <p className="text-base font-semibold">{sale.receipt_number}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{sale.actor_name || "System"}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium">{sale.customer_name || "Walk-in"}</p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">{sale.customer_phone || "No phone"}</p>
                  </td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                    <div>{sale.item_count} units</div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">{sale.payment_count} payment entries</div>
                  </td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">{sale.payment_mode}</td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">{sale.sale_date}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-[var(--success)]">
                    {formatCurrency(Number(sale.total_amount || 0), currencyCode)}
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-[var(--warning)]">
                    {formatCurrency(Number(sale.amount_due || 0), currencyCode)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-[var(--text-secondary)]">
                  No sales returned from the phase 1 API yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
