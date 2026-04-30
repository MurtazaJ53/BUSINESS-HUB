import type { MigrationBridgeReceipt } from "@/lib/types";

type MigrationBridgeReceiptsTableProps = {
  receipts: MigrationBridgeReceipt[];
};

export function MigrationBridgeReceiptsTable({
  receipts,
}: MigrationBridgeReceiptsTableProps) {
  return (
    <div className="panel-soft overflow-hidden rounded-[28px]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-soft)] text-left text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">
              <th className="px-5 py-4 font-medium">Domain</th>
              <th className="px-5 py-4 font-medium">Command</th>
              <th className="px-5 py-4 font-medium">Entity</th>
              <th className="px-5 py-4 font-medium">Epoch</th>
              <th className="px-5 py-4 font-medium">Origin event</th>
              <th className="px-5 py-4 font-medium">Applied</th>
            </tr>
          </thead>
          <tbody>
            {receipts.length ? (
              receipts.map((receipt) => (
                <tr key={receipt.id} className="border-b border-[rgba(152,164,189,0.08)] align-top">
                  <td className="px-5 py-4">
                    <p className="text-base font-semibold">{receipt.domain}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{receipt.shop_name}</p>
                  </td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                    {receipt.origin_system} / {receipt.command_type || "—"}
                  </td>
                  <td className="px-5 py-4 text-xs text-[var(--text-muted)]">
                    {receipt.entity_type || "—"}
                    {receipt.entity_id ? `:${receipt.entity_id}` : ""}
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-[var(--accent)]">
                    {receipt.base_domain_epoch}
                  </td>
                  <td className="px-5 py-4 text-xs text-[var(--text-muted)]">
                    {receipt.origin_event_id}
                  </td>
                  <td className="px-5 py-4 text-xs text-[var(--text-muted)]">{receipt.applied_at}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-[var(--text-secondary)]">
                  No bridge receipts returned from the Phase 2 API yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
