import { type NextRequest, NextResponse } from "next/server";
import { apiMutation } from "@/lib/admin-api";
import type { PlatformShopPayload } from "@/lib/types";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { plan_tier: string; reason: string };
    const result = await apiMutation<PlatformShopPayload>(`/platform/shops/${id}/plan/`, {
      method: "POST",
      body,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
