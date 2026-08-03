import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE_URL = process.env.BUSINESS_HUB_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("date_from") || "";
    const dateTo = searchParams.get("date_to") || "";
    const membershipId = searchParams.get("membership_id") || "";
    const status = searchParams.get("status") || "";
    const q = searchParams.get("q") || "";

    const cookieStore = await cookies();
    const token = cookieStore.get("bh_access_token")?.value;
    const shopId = cookieStore.get("bh_active_shop")?.value;

    if (!token || !shopId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const backendUrl = new URL(`${API_BASE_URL}/shops/${shopId}/attendance/summary/`);
    if (dateFrom) backendUrl.searchParams.set("date_from", dateFrom);
    if (dateTo) backendUrl.searchParams.set("date_to", dateTo);
    if (membershipId) backendUrl.searchParams.set("membership_id", membershipId);
    if (status) backendUrl.searchParams.set("status", status);
    if (q) backendUrl.searchParams.set("q", q);

    const res = await fetch(backendUrl.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Backend returned ${res.status}: ${text}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
