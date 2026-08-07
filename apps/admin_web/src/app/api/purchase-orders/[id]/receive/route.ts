import { NextRequest } from "next/server";

import { proxyToApi } from "@/lib/proxy";

/** Book in a delivery. The backend turns it into an ordinary purchase. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  return proxyToApi((shopId) => `/shops/${shopId}/purchase-orders/${id}/receive/`, {
    method: "POST",
    body,
  });
}
