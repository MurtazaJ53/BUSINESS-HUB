import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE_URL = process.env.BUSINESS_HUB_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

/**
 * Streams the backend's Tally voucher XML straight through, keeping the
 * filename it chose. This is the file a shop hands to their CA, so it must
 * arrive byte-for-byte as the backend built it — no JSON wrapping.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const cookieStore = await cookies();
    const token = cookieStore.get("bh_access_token")?.value;
    const shopId = cookieStore.get("bh_active_shop")?.value;

    if (!token || !shopId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const backendUrl = new URL(`${API_BASE_URL}/shops/${shopId}/sales/tally-export/`);
    for (const key of ["date_from", "date_to"]) {
      const value = searchParams.get(key);
      if (value) backendUrl.searchParams.set(key, value);
    }

    const res = await fetch(backendUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Backend returned ${res.status}: ${text}` },
        { status: res.status }
      );
    }

    const xml = await res.text();
    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("content-type") || "application/xml",
        "Content-Disposition":
          res.headers.get("content-disposition") || 'attachment; filename="Tally.xml"',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
