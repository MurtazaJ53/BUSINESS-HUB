import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE_URL = process.env.BUSINESS_HUB_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, code, name, password } = body;
    const inviteToken = (token || code || "").trim();

    if (!inviteToken || !password) {
      return NextResponse.json(
        { error: "Invite code and password are required" },
        { status: 400 }
      );
    }

    const joinRes = await fetch(`${API_BASE_URL}/invites/accept/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        token: inviteToken,
        name: (name || "").trim(),
        password,
      }),
    });

    if (!joinRes.ok) {
      const errData = await joinRes.json().catch(() => ({}));
      const message =
        errData.detail ||
        errData.token?.[0] ||
        errData.error ||
        "Invalid or expired invite code.";
      return NextResponse.json({ error: message }, { status: joinRes.status });
    }

    const joinData = await joinRes.json();
    const accessToken = joinData.access;
    const refreshToken = joinData.refresh;
    const shopId = joinData.shop_id;

    const cookieStore = await cookies();
    const cookieOptions = {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 24 * 7,
    };

    if (accessToken) cookieStore.set("bh_access_token", accessToken, cookieOptions);
    if (refreshToken) cookieStore.set("bh_refresh_token", refreshToken, cookieOptions);
    cookieStore.set("bh_user_email", joinData.email || "", { path: "/", maxAge: 60 * 60 * 24 * 7 });
    cookieStore.set("bh_user_role", joinData.role || "staff", { path: "/", maxAge: 60 * 60 * 24 * 7 });
    if (shopId) cookieStore.set("bh_active_shop", shopId, { path: "/", maxAge: 60 * 60 * 24 * 7 });

    return NextResponse.json({
      success: true,
      shopId,
      role: joinData.role || "staff",
      defaultRoute: joinData.role === "cashier" ? "/pos" : "/",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to accept invite" },
      { status: 500 }
    );
  }
}
