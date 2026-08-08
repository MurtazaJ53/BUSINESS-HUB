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
  primary: { bg: "bg-[var(--primary)]/10", text: "text-[var(--primary-hover)]", border: "border-[var(--primary)]/20" },
  blue: { bg: "bg-[var(--primary)]/10", text: "text-[var(--primary-hover)]", border: "border-[var(--primary)]/20" },
  success: { bg: "bg-[var(--success)]/10", text: "text-[var(--success-strong)]", border: "border-[var(--success)]/30" },
  green: { bg: "bg-[var(--success)]/10", text: "text-[var(--success-strong)]", border: "border-[var(--success)]/30" },
  warning: { bg: "bg-[var(--warning)]/10", text: "text-[var(--warning-strong)]", border: "border-[var(--warning)]/30" },
  error: { bg: "bg-[var(--error)]/10", text: "text-[var(--error-strong)]", border: "border-[var(--error)]/30" },
  rose: { bg: "bg-[var(--error)]/10", text: "text-[var(--error-strong)]", border: "border-[var(--error)]/30" },
  info: { bg: "bg-[var(--info)]/10", text: "text-[var(--info-strong)]", border: "border-[var(--info)]/30" },
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
    <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-[24px] p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
            {label}
          </p>
          <p className="text-2xl sm:text-3xl font-[900] text-[var(--text-primary)] tracking-tight">
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
