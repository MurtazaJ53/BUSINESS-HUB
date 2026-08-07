import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_BASE_URL =
  process.env.BUSINESS_HUB_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

/**
 * Stream the shop's data export straight through to the browser.
 *
 * Not built on lib/proxy.ts, which parses the body as JSON to re-wrap it.
 * This response is a file download that can be large, and the point is to
 * hand it over untouched with its filename intact.
 */
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("bh_access_token")?.value;
  const shopId = cookieStore.get("bh_active_shop")?.value;

  if (!token || !shopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const res = await fetch(`${API_BASE_URL}/shops/${shopId}/export/`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json(
      {
        error:
          res.status === 403
            ? "Only the shop owner can export all of the shop's data."
            : `The server returned ${res.status}.`,
      },
      { status: res.status },
    );
  }

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": "application/json",
      // Carry the server's filename through, so the download is named after
      // the shop and the date rather than "export".
      "Content-Disposition":
        res.headers.get("content-disposition") ??
        'attachment; filename="business-hub-export.json"',
    },
  });
}
