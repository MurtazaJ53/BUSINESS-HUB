import { NextResponse } from "next/server";

import { beginUserPasskeyVerificationServer } from "@/lib/passkeys-server";

export async function POST() {
  try {
    const payload = await beginUserPasskeyVerificationServer();
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to start passkey verification.",
      },
      { status: 400 },
    );
  }
}
