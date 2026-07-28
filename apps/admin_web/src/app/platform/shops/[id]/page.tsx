import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPlatformShopDetail, getSession } from "@/lib/admin-api";
import { PlatformShell } from "@/components/platform-shell";
import { PlatformLifecycleDialog } from "@/components/platform-lifecycle-dialog";

export const metadata: Metadata = {
  title: "Shop Details | Platform Cockpit",
};

export default async function PlatformShopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  let shopPayload;
  let session;
  
  try {
    const results = await Promise.all([
      getPlatformShopDetail(id),
      getSession(),
    ]);
    shopPayload = results[0];
    session = results[1];
  } catch (err) {
    notFound();
  }

  return (
    <PlatformShell
      session={session}
      activeRoute="shops"
      title={shopPayload.name}
      subtitle={`Detailed management for ${shopPayload.slug}`}
    >
      <div className="space-y-6">
        <div className="panel-soft flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-[24px] px-6 py-5 border-l-4 border-l-[var(--warning)]">
          <div className="flex items-center gap-4">
            <StatusBadge status={shopPayload.status} display={shopPayload.status_display} />
            <span className="text-[var(--text-secondary)] text-sm">{shopPayload.status_reason || "No status reason provided."}</span>
          </div>
          <div>
            {shopPayload.status === "pending" && (
              <PlatformLifecycleDialog 
                shopId={shopPayload.id}
                shopName={shopPayload.name}
                action="approve"
                actionLabel="Approve Shop"
                actionDescription="Approve this shop to allow the owner to start operations."
                buttonStyle={{ backgroundColor: "var(--success)", color: "black", padding: "8px 16px", borderRadius: "12px", fontSize: "14px", fontWeight: "600" }}
              />
            )}
            {shopPayload.status === "active" && (
              <PlatformLifecycleDialog 
                shopId={shopPayload.id}
                shopName={shopPayload.name}
                action="suspend"
                actionLabel="Suspend Shop"
                actionDescription="Suspension instantly revokes access for all shop members."
                buttonStyle={{ backgroundColor: "var(--error)", color: "white", padding: "8px 16px", borderRadius: "12px", fontSize: "14px", fontWeight: "600" }}
              />
            )}
            {shopPayload.status === "suspended" && (
              <PlatformLifecycleDialog 
                shopId={shopPayload.id}
                shopName={shopPayload.name}
                action="activate"
                actionLabel="Re-activate Shop"
                actionDescription="Restore access for this workspace."
                buttonStyle={{ backgroundColor: "var(--success)", color: "black", padding: "8px 16px", borderRadius: "12px", fontSize: "14px", fontWeight: "600" }}
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="panel-soft rounded-[24px] p-6 space-y-2">
            <h2 className="eyebrow mb-4">Shop Details</h2>
            <InfoRow label="Name" value={shopPayload.name} />
            <InfoRow label="Slug" value={shopPayload.slug} />
            <InfoRow label="Legal Name" value={shopPayload.legal_name} />
            <InfoRow label="Region Code" value={shopPayload.region_code} />
            <InfoRow label="Currency" value={shopPayload.currency_code} />
            <InfoRow label="Timezone" value={shopPayload.timezone} />
            <InfoRow label="Created At" value={new Date(shopPayload.created_at).toLocaleString()} />
            <InfoRow label="Updated At" value={new Date(shopPayload.updated_at).toLocaleString()} />
          </div>

          <div className="space-y-6">
            <div className="panel-soft rounded-[24px] p-6 space-y-2">
              <h2 className="eyebrow mb-4">Ownership & Access</h2>
              <InfoRow label="Owner Name" value={shopPayload.owner_name || "N/A"} />
              <InfoRow label="Owner Email" value={shopPayload.owner_email || "N/A"} />
              <InfoRow label="Total Members" value={shopPayload.member_count.toString()} />
            </div>

            <div className="panel-soft rounded-[24px] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="eyebrow mb-1">Plan Tier</h2>
                  <div className="text-2xl font-semibold uppercase tracking-wider text-[var(--accent)]">
                    {shopPayload.plan_tier}
                  </div>
                </div>
                <PlatformLifecycleDialog 
                  shopId={shopPayload.id}
                  shopName={shopPayload.name}
                  action="plan"
                  actionLabel="Change Plan"
                  actionDescription="Modify the subscription tier for this workspace."
                  buttonStyle={{ backgroundColor: "rgba(255,255,255,0.1)", color: "white", padding: "8px 16px", borderRadius: "12px", fontSize: "14px", fontWeight: "600" }}
                  currentPlan={shopPayload.plan_tier}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </PlatformShell>
  );
}

function StatusBadge({ status, display }: { status: string; display: string }) {
  let colors = "";
  switch (status) {
    case "active":
      colors = "text-[var(--success)] border-[rgba(58,215,162,0.18)] bg-[rgba(58,215,162,0.08)]";
      break;
    case "pending":
      colors = "text-[var(--warning)] border-[rgba(245,158,11,0.18)] bg-[rgba(245,158,11,0.08)]";
      break;
    case "suspended":
      colors = "text-[var(--error)] border-[rgba(244,63,94,0.18)] bg-[rgba(244,63,94,0.08)]";
      break;
    default:
      colors = "text-[var(--text-secondary)] border-[rgba(152,164,189,0.18)] bg-[rgba(152,164,189,0.08)]";
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold uppercase tracking-wider ${colors}`}>
      <span className="h-2 w-2 rounded-full bg-current" />
      {display}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--border-soft)] py-3 last:border-0">
      <span className="text-sm font-medium text-[var(--text-secondary)]">{label}</span>
      <span className="text-sm text-[var(--text-primary)]">{value}</span>
    </div>
  );
}
