import { AdminShell } from "@/components/admin-shell";
import { DataHealth } from "@/components/data-health";
import { getSession, resolveActiveShop } from "@/lib/admin-api";

export const metadata = {
  title: "Data health | Business Hub",
  description: "Find and fix duplicate products, impossible stock and unreachable debts",
};

export default async function DataHealthPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="data-health"
      title="Data health"
      subtitle="Wrong data quietly corrupts every report built on it"
    >
      <DataHealth />
    </AdminShell>
  );
}
