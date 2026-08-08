import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { LabelPrinter } from "@/components/label-printer";
import { getSession, resolveActiveShop } from "@/lib/admin-api";

export const metadata = {
  title: "Barcode Labels | Business Hub",
  description: "Print price tags and barcode labels for your stock",
};

export default async function LabelsPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="labels"
      title="Barcode labels"
      subtitle="Print price tags your scanner can read at the counter."
    >
      {!activeShop ? (
        <EmptyState
          title="No shop membership found"
          body="This account is signed in, but there is no active shop membership yet."
        />
      ) : (
        <LabelPrinter shopName={activeShop.shop.name} />
      )}
    </AdminShell>
  );
}
