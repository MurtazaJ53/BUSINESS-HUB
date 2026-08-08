import { NextRequest } from "next/server";

import { proxyToApi } from "@/lib/proxy";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return proxyToApi((shopId) => `/shops/${shopId}/inventory/transfers/${query}`);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  return proxyToApi((shopId) => `/shops/${shopId}/inventory/transfers/`, {
    method: "POST",
    body,
  });
}
