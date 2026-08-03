import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE_URL = process.env.BUSINESS_HUB_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("bh_access_token")?.value;
    const shopId = cookieStore.get("bh_active_shop")?.value;

    if (!token || !shopId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const res = await fetch(`${API_BASE_URL}/shops/${shopId}/expenses/${id}/`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Backend returned ${res.status}: ${text}` }, { status: res.status });
    }

    return new Response(null, { status: 204 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
