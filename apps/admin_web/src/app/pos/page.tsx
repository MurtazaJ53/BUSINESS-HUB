import { PosTerminal } from "@/components/pos-terminal";
import { AppLayout } from "@/components/app-layout";
import { getSafeSession } from "@/lib/session-helper";

export const metadata = {
  title: "POS Terminal | Business Hub",
  description: "High-speed retail point of sale and billing terminal",
};

export default async function PosPage() {
  const { user, currentShopId, currentShopName, planTier, memberships } =
    await getSafeSession();

  return (
    <AppLayout
      user={user}
      currentShopId={currentShopId}
      currentShopName={currentShopName}
      planTier={planTier}
      memberships={memberships}
    >
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Retail POS Terminal
            </h1>
            <p className="text-xs text-[var(--text-tertiary)]">
              Fast barcode scanning, dynamic GST calculation, split tender & instant thermal printing
            </p>
          </div>
        </div>

        <PosTerminal
          shopName={currentShopName}
          cashierName={user?.full_name || "Cashier #1"}
        />
      </div>
    </AppLayout>
  );
}
