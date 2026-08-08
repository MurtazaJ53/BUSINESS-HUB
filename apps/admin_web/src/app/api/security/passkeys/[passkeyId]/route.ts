import { NextResponse } from "next/server";

import { deleteUserPasskeyServer } from "@/lib/passkeys-server";

type RouteContext = {
  params: Promise<{
    passkeyId: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { passkeyId } = await context.params;
    const payload = await deleteUserPasskeyServer(passkeyId);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to remove this passkey.",
      },
      { status: 400 },
    );
  }
}
