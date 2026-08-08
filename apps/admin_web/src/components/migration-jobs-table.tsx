import type { MigrationJobRun } from "@/lib/types";

type MigrationJobsTableProps = {
  jobs: MigrationJobRun[];
};

export function MigrationJobsTable({ jobs }: MigrationJobsTableProps) {
  return (
    <div className="panel-soft overflow-hidden rounded-[28px]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-soft)] text-left text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">
              <th className="px-5 py-4 font-medium">Domain</th>
              <th className="px-5 py-4 font-medium">Job</th>
              <th className="px-5 py-4 font-medium">Status</th>
              <th className="px-5 py-4 font-medium">Rows</th>
              <th className="px-5 py-4 font-medium">Mismatches</th>
              <th className="px-5 py-4 font-medium">Trace</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length ? (
              jobs.map((job) => (
                <tr key={job.id} className="border-b border-[rgba(152,164,189,0.08)] align-top">
                  <td className="px-5 py-4">
                    <p className="text-base font-semibold">{job.domain}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{job.shop_name || "Global"}</p>
                  </td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">{job.job_type}</td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">{job.status}</td>
                  <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                    {job.rows_written}/{job.rows_scanned} written
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-[var(--warning)]">{job.mismatch_count}</td>
                  <td className="px-5 py-4 text-xs text-[var(--text-muted)]">{job.trace_id || "—"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-[var(--text-secondary)]">
                  No migration jobs returned from the Phase 2 API yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
