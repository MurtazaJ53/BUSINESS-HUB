import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete("bh_access_token");
  cookieStore.delete("bh_refresh_token");
  cookieStore.delete("bh_user_email");
  cookieStore.delete("bh_user_role");
  cookieStore.delete("bh_active_shop");
  cookieStore.delete("bh_pos_unlocked");

  return NextResponse.json({ success: true, redirect: "/login" });
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete("bh_access_token");
  cookieStore.delete("bh_refresh_token");
  cookieStore.delete("bh_user_email");
  cookieStore.delete("bh_user_role");
  cookieStore.delete("bh_active_shop");
  cookieStore.delete("bh_pos_unlocked");

  return NextResponse.redirect(new URL("/login", req.url));
}
