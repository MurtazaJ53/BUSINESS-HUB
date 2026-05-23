import { NextResponse } from "next/server";

import { finishUserPasskeyRegistrationServer } from "@/lib/passkeys-server";

export async function POST(request: Request) {
  try {
    const payload = await finishUserPasskeyRegistrationServer(await request.json());
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to complete passkey registration.",
      },
      { status: 400 },
    );
  }
}
