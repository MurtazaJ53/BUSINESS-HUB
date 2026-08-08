import type { MigrationDomainControl } from "@/lib/types";

type MigrationControlsTableProps = {
  controls: MigrationDomainControl[];
};

export function MigrationControlsTable({ controls }: MigrationControlsTableProps) {
  return (
    <div className="panel-soft overflow-hidden rounded-[28px]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-soft)] text-left text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">
              <th className="px-5 py-4 font-medium">Shop</th>
              <th className="px-5 py-4 font-medium">Domain</th>
              <th className="px-5 py-4 font-medium">Write master</th>
              <th className="px-5 py-4 font-medium">Bridge</th>
              <th className="px-5 py-4 font-medium">Cutover</th>
              <th className="px-5 py-4 font-medium">Epoch</th>
            </tr>
          </thead>
          <tbody>
            {controls.length ? (
              controls.map((control) => (
                <tr key={control.id} className="border-b border-[rgba(152,164,189,0.08)] align-top">
                  <td className="px-5 py-4">
                    <p className="text-base font-semibold">{control.shop_name}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{control.shop_slug}</p>
                  </td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">{control.domain}</td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">{control.write_master}</td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">{control.bridge_mode}</td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">{control.cutover_status}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-[var(--accent)]">{control.current_epoch}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-[var(--text-secondary)]">
                  No migration domain controls returned from the Phase 2 API yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
