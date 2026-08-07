import { proxyToApi } from "@/lib/proxy";

/** Mint a fresh statement link for one customer, retiring any earlier one. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToApi(
    (shopId) => `/shops/${shopId}/customers/${id}/statement-link/`,
    { method: "POST" },
  );
}

/** Revoke every live link for this customer. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToApi(
    (shopId) => `/shops/${shopId}/customers/${id}/statement-link/`,
    { method: "DELETE" },
  );
}
