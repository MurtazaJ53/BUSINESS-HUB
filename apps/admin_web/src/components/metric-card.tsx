import type { ReactNode } from "react";

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  accent?: "blue" | "green" | "rose";
  icon?: ReactNode;
};

const accentMap = {
  blue: "text-[var(--accent)] border-[rgba(92,174,254,0.18)] bg-[rgba(9,18,34,0.82)]",
  green: "text-[var(--success)] border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.82)]",
  rose: "text-[var(--warning)] border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.82)]",
};

export function MetricCard({
  label,
  value,
  detail,
  accent = "blue",
  icon,
}: MetricCardProps) {
  return (
    <div className="panel-soft rounded-[26px] px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{label}</p>
          <p className="metric-value mt-5">{value}</p>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">{detail}</p>
        </div>
        <div
          className={`rounded-[18px] border px-4 py-3 text-sm font-semibold ${accentMap[accent]}`}
        >
          {icon ?? "*"}
        </div>
      </div>
    </div>
  );
}
