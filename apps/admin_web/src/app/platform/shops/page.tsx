import type { Metadata } from "next";
import { getPlatformShops, getSession } from "@/lib/admin-api";
import { PlatformShell } from "@/components/platform-shell";
import { PlatformShopTable } from "@/components/platform-shop-table";

export const metadata: Metadata = {
  title: "Shops Registry | Platform Cockpit",
};

export default async function PlatformShopsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const status = params.status || "";
  const q = params.q || "";
  const plan = params.plan || "";
  const pageStr = params.page || "1";
  
  const [session, shopsPayload] = await Promise.all([
    getSession(),
    getPlatformShops({ status, q, plan, page: pageStr }),
  ]);

  return (
    <PlatformShell
      session={session}
      activeRoute="shops"
      title="Shops Registry"
      subtitle="Manage all tenant workspaces on the platform."
    >
      <PlatformShopTable
        shops={shopsPayload.results}
        count={shopsPayload.count}
        currentPage={parseInt(pageStr, 10)}
        currentStatus={status}
        currentQ={q}
        currentPlan={plan}
      />
    </PlatformShell>
  );
}
