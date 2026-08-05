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

const accentMap: Record<MetricAccent, { bg: string; text: string; border: string }> = {
  primary: { bg: "bg-[#0EA5E9]/10", text: "text-[#0284C7]", border: "border-[#0EA5E9]/20" },
  blue: { bg: "bg-[#0EA5E9]/10", text: "text-[#0284C7]", border: "border-[#0EA5E9]/20" },
  success: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  green: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  warning: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  error: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  rose: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  info: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
};

export function MetricCard({
  label,
  value,
  detail,
  accent = "primary",
  icon,
}: MetricCardProps) {
  const styles = accentMap[accent] || accentMap.primary;

  return (
    <div className="bg-white border border-[var(--border-soft)] rounded-[24px] p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
            {label}
          </p>
          <p className="text-2xl sm:text-3xl font-[900] text-[#0F172A] tracking-tight">
            {value}
          </p>
          <p className="mt-2 text-xs font-semibold text-[var(--text-secondary)] leading-relaxed">
            {detail}
          </p>
        </div>
        {icon && (
          <div
            className={`w-11 h-11 rounded-2xl border flex items-center justify-center text-xs font-black shadow-sm ${styles.bg} ${styles.text} ${styles.border}`}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
