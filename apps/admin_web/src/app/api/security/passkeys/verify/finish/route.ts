import { NextResponse } from "next/server";

import { setAdminWebMfaCookie } from "@/lib/mfa";
import { finishUserPasskeyVerificationServer } from "@/lib/passkeys-server";

export async function POST(request: Request) {
  try {
    const { session, result } = await finishUserPasskeyVerificationServer(await request.json());
    await setAdminWebMfaCookie({
      userId: session.user.id,
      securityStamp: result.status.security_stamp,
      verifiedUntil: result.verified_until,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to finish passkey verification.",
      },
      { status: 400 },
    );
  }
}
