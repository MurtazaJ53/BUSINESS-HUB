import { NextResponse } from "next/server";

import { beginUserPasskeyRegistrationServer } from "@/lib/passkeys-server";

export async function POST() {
  try {
    const payload = await beginUserPasskeyRegistrationServer();
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to start passkey registration.",
      },
      { status: 400 },
    );
  }
}
