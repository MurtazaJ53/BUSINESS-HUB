import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}



export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pin } = body;

    if (!pin || pin.length < 4) {
      return NextResponse.json(
        { error: "Please enter a valid 4-digit PIN" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const activeShop = cookieStore.get("bh_active_shop")?.value;
    const currentEmail = cookieStore.get("bh_user_email")?.value || "pos.terminal@businesshub.local";

    // Set PIN session / cashier role
    cookieStore.set("bh_pos_unlocked", "true", { path: "/", maxAge: 60 * 60 * 12 });
    cookieStore.set("bh_user_role", "cashier", { path: "/", maxAge: 60 * 60 * 12 });
    if (!cookieStore.get("bh_user_email")?.value) {
      cookieStore.set("bh_user_email", currentEmail, { path: "/", maxAge: 60 * 60 * 12 });
    }

    return NextResponse.json({
      success: true,
      role: "cashier",
      shopId: activeShop,
      defaultRoute: "/pos",
    });
  } catch (err) {
    return NextResponse.json(
      { error: errorMessage(err, "Failed to authenticate PIN") },
      { status: 500 }
    );
  }
}
