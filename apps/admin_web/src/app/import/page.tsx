import { AdminShell } from "@/components/admin-shell";
import { SpreadsheetImport } from "@/components/spreadsheet-import";
import { getSession, resolveActiveShop } from "@/lib/admin-api";

export const metadata = {
  title: "Import from a spreadsheet | Business Hub",
  description: "Bring your existing stock list and customer list into Business Hub",
};

export default async function ImportPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="import"
      title="Import from a spreadsheet"
      subtitle="Bring your existing stock and customer lists in — any column order works"
    >
      <SpreadsheetImport />
    </AdminShell>
  );
}
