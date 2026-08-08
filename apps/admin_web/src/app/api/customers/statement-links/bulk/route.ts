import { NextRequest } from "next/server";

import { proxyToApi } from "@/lib/proxy";

/**
 * Mint statement links for a whole collection round in one request.
 *
 * Exists so the browser does not have to await the server between reminders —
 * an await before window.open loses the user gesture and the pop-up is blocked.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  return proxyToApi(
    (shopId) => `/shops/${shopId}/customers/statement-links/bulk/`,
    { method: "POST", body },
  );
}
