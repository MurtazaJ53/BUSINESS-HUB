import { NextResponse } from "next/server";

import { getUserPasskeysServer } from "@/lib/passkeys-server";

export async function GET() {
  try {
    const passkeys = await getUserPasskeysServer();
    return NextResponse.json({ passkeys });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load registered passkeys.",
      },
      { status: 403 },
    );
  }
}
