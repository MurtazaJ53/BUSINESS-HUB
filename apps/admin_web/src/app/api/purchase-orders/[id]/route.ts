import { proxyToApi } from "@/lib/proxy";

/** Cancel an order. Anything already received stays received. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToApi((shopId) => `/shops/${shopId}/purchase-orders/${id}/`, {
    method: "DELETE",
  });
}
