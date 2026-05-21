import type { ShopDomainState } from "@/lib/types";

type DomainPilotSignoffCardProps = {
  domainState: ShopDomainState;
  domainLabel: string;
};

function getTone(status: ShopDomainState["pilot_signoff_status"]) {
  switch (status) {
    case "production_safe":
      return {
        shell:
          "border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.72)]",
        badge:
          "border-[rgba(52,211,153,0.18)] bg-[rgba(7,33,25,0.82)] text-[var(--success)]",
        label: "Healthy",
      };
    case "ready_for_cutover":
      return {
        shell:
          "border-[rgba(92,174,254,0.18)] bg-[rgba(9,18,34,0.72)]",
        badge:
          "border-[rgba(92,174,254,0.18)] bg-[rgba(9,18,34,0.82)] text-[var(--accent)]",
        label: "Ready",
      };
    case "rollback_recommended":
      return {
        shell:
          "border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.72)]",
        badge:
          "border-[rgba(251,113,133,0.18)] bg-[rgba(40,12,19,0.82)] text-[var(--warning)]",
        label: "Needs attention",
      };
    case "monitoring":
      return {
        shell:
          "border-[rgba(250,204,21,0.18)] bg-[rgba(38,30,7,0.72)]",
        badge:
          "border-[rgba(250,204,21,0.18)] bg-[rgba(38,30,7,0.82)] text-[#facc15]",
        label: "Monitoring",
      };
    default:
      return {
        shell:
          "border-[rgba(152,164,189,0.16)] bg-[rgba(13,18,28,0.62)]",
        badge:
          "border-[rgba(152,164,189,0.18)] bg-[rgba(18,21,32,0.82)] text-[var(--text-secondary)]",
        label: "Pending",
      };
  }
}

export function DomainPilotSignoffCard({
  domainState,
  domainLabel,
}: DomainPilotSignoffCardProps) {
  if (!domainState.control_present) {
    return null;
  }

  const tone = getTone(domainState.pilot_signoff_status);

  return (
    <div className={`rounded-[18px] border px-4 py-4 ${tone.shell}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            {domainLabel} domain health
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
            {domainState.pilot_recommended_action ?? "No extra domain action is needed right now."}
          </p>
        </div>
        <div
          className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${tone.badge}`}
        >
          {tone.label}
        </div>
      </div>

      <p className="mt-3 text-sm text-[var(--text-secondary)]">
        {domainState.pilot_signoff_summary ??
          "No health summary is available for this domain yet."}
      </p>

      <div className="mt-3 text-xs text-[var(--text-muted)]">
        latest check
        {" "}
        <span className="font-mono text-[var(--text-secondary)]">
          {domainState.pilot_latest_verify_result ?? "not-run"}
        </span>
      </div>
    </div>
  );
}
