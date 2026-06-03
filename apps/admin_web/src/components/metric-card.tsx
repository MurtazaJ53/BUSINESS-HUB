import type { ReactNode } from "react";

type MetricAccent =
  | "primary"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "blue"
  | "green"
  | "rose";

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  accent?: MetricAccent;
  icon?: ReactNode;
};

const accentMap: Record<MetricAccent, string> = {
  primary: "text-[var(--primary)] border-[rgba(59,130,246,0.2)] bg-[rgba(59,130,246,0.08)]",
  success: "text-[var(--success)] border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.08)]",
  warning: "text-[var(--warning)] border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.08)]",
  error: "text-[var(--error)] border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)]",
  info: "text-[var(--info)] border-[rgba(6,182,212,0.2)] bg-[rgba(6,182,212,0.08)]",
  blue: "text-[var(--primary)] border-[rgba(59,130,246,0.2)] bg-[rgba(59,130,246,0.08)]",
  green: "text-[var(--success)] border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.08)]",
  rose: "text-[var(--error)] border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)]",
};

export function MetricCard({
  label,
  value,
  detail,
  accent = "primary",
  icon,
}: MetricCardProps) {
  return (
    <div className="panel rounded-xl px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="eyebrow mb-3">{label}</p>
          <p className="metric-value">{value}</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">{detail}</p>
        </div>
        {icon && (
          <div
            className={`rounded-lg border px-3 py-2.5 text-sm font-semibold flex items-center justify-center ${accentMap[accent]}`}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
