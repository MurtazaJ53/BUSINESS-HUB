import { NextRequest } from "next/server";

import { proxyToApi } from "@/lib/proxy";

export async function GET(req: NextRequest) {
  const open = req.nextUrl.searchParams.get("open");
  const query = open === "1" ? "?open=1" : "";
  return proxyToApi((shopId) => `/shops/${shopId}/purchase-orders/${query}`);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  return proxyToApi((shopId) => `/shops/${shopId}/purchase-orders/`, {
    method: "POST",
    body,
  });
}
