import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE_URL = process.env.BUSINESS_HUB_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

async function credentials() {
  const cookieStore = await cookies();
  return {
    token: cookieStore.get("bh_access_token")?.value,
    shopId: cookieStore.get("bh_active_shop")?.value,
  };
}

/** Returns {items, summary} in one call so the page cannot show a total that
 *  disagrees with the rows beneath it. */
export async function GET() {
  try {
    const { token, shopId } = await credentials();
    if (!token || !shopId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

    const [listRes, summaryRes] = await Promise.all([
      fetch(`${API_BASE_URL}/shops/${shopId}/suppliers/`, { headers, cache: "no-store" }),
      fetch(`${API_BASE_URL}/shops/${shopId}/suppliers/summary/`, { headers, cache: "no-store" }),
    ]);

    if (!listRes.ok) {
      const text = await listRes.text();
      return NextResponse.json(
        { error: `Backend returned ${listRes.status}: ${text}` },
        { status: listRes.status }
      );
    }

    const list = await listRes.json();
    const items = Array.isArray(list) ? list : (list?.results ?? []);
    // A failed summary must not hide the rows; report it as absent instead.
    const summary = summaryRes.ok ? await summaryRes.json() : null;

    return NextResponse.json({ items, summary });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { token, shopId } = await credentials();
    if (!token || !shopId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const res = await fetch(`${API_BASE_URL}/shops/${shopId}/suppliers/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { error: `Backend returned ${res.status}: ${text}` },
        { status: res.status }
      );
    }
    return NextResponse.json(JSON.parse(text));
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
