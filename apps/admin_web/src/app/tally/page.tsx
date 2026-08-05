import { AdminShell } from "@/components/admin-shell";
import { TallyExport } from "@/components/tally-export";
import { getSession, resolveActiveShop } from "@/lib/admin-api";

export const metadata = {
  title: "Accountant export | Business Hub",
  description: "Export sales as Tally-importable vouchers for your CA",
};

export default async function TallyPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="tally"
      title="Accountant export"
      subtitle="Hand your CA a file they can import straight into Tally"
    >
      <TallyExport />
    </AdminShell>
  );
}
