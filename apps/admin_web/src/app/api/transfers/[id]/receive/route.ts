import { proxyToApi } from "@/lib/proxy";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // The active shop must be the destination; the backend rejects it otherwise,
  // so a manager cannot confirm delivery of goods addressed to another branch.
  return proxyToApi(
    (shopId) => `/shops/${shopId}/inventory/transfers/${id}/receive/`,
    { method: "POST" },
  );
}
