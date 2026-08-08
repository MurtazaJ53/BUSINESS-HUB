import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

const API_BASE_URL = process.env.BUSINESS_HUB_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

/** The backend caps a batch at 1000 rows, so send in chunks under that. */
const CHUNK_SIZE = 500;

const TARGETS = {
  products: { path: "inventory/bulk/", key: "items" },
  customers: { path: "customers/bulk/", key: "customers" },
} as const;

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("bh_access_token")?.value;
    const shopId = cookieStore.get("bh_active_shop")?.value;
    if (!token || !shopId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const kind = body?.kind as keyof typeof TARGETS;
    const rows = body?.rows;
    const target = TARGETS[kind];

    if (!target) {
      return NextResponse.json({ error: `Unknown import kind: ${kind}` }, { status: 400 });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Nothing to import." }, { status: 400 });
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: unknown[] = [];

    // Sequential, not parallel: the backend matches each row against existing
    // items to avoid creating duplicates, and concurrent batches could both
    // miss the same match and create two copies.
    for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
      const chunk = rows.slice(start, start + CHUNK_SIZE);
      const res = await fetch(`${API_BASE_URL}/shops/${shopId}/${target.path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ [target.key]: chunk }),
      });

      const text = await res.text();
      if (!res.ok) {
        // Report what already landed rather than implying nothing happened.
        return NextResponse.json(
          {
            error: `Import stopped after ${created + updated} row(s): ${text}`,
            created,
            updated,
            skipped,
            errors,
          },
          { status: res.status }
        );
      }

      const result = JSON.parse(text);
      created += result.created ?? 0;
      updated += result.updated ?? 0;
      skipped += result.skipped ?? 0;
      if (Array.isArray(result.errors)) errors.push(...result.errors);
    }

    return NextResponse.json({ created, updated, skipped, errors: errors.slice(0, 20) });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, "Internal server error") },
      { status: 500 }
    );
  }
}
