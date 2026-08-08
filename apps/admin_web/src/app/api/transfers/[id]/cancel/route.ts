import { proxyToApi } from "@/lib/proxy";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Only the sending shop may call a transfer off, and only before it is
  // received -- both enforced by the backend.
  return proxyToApi(
    (shopId) => `/shops/${shopId}/inventory/transfers/${id}/cancel/`,
    { method: "POST" },
  );
}
