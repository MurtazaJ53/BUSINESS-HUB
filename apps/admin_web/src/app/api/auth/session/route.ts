import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(_req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("bh_access_token")?.value;
  const email = cookieStore.get("bh_user_email")?.value;
  const role = cookieStore.get("bh_user_role")?.value || "owner";
  const shopId = cookieStore.get("bh_active_shop")?.value;
  const posUnlocked = cookieStore.get("bh_pos_unlocked")?.value === "true";

  if (!token && !email && !posUnlocked) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      email: email || "user@businesshub.local",
      role,
      is_platform_admin: role === "platform_admin",
    },
    activeShopId: shopId || null,
    role,
  });
}
