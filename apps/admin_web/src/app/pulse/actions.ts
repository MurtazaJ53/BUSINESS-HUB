"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { apiMutation } from "@/lib/admin-api";
import { requireWorkspaceManagerAccess } from "@/lib/server-guards";
import type { WorkspacePulseSignal } from "@/lib/types";

function getRequiredField(formData: FormData, key: string, label: string): string {
  const value = String(formData.get(key) || "").trim();
  if (!value) {
    throw new Error(`Missing ${label}.`);
  }
  return value;
}

function getOptionalField(formData: FormData, key: string): string {
  return String(formData.get(key) || "").trim();
}

function buildRedirectUrl(params: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  return `/pulse?${searchParams.toString()}`;
}

function getSafeErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error
    ? error.message.replace(/\s+/g, " ").slice(0, 220)
    : fallback;
}

export async function updatePulseSignalAction(formData: FormData) {
  const shopId = getRequiredField(formData, "shopId", "shop id");
  const signalId = getRequiredField(formData, "signalId", "signal id");
  const action = getRequiredField(formData, "action", "action");
  const title = getOptionalField(formData, "title");
  const note = getOptionalField(formData, "note");
  let result: WorkspacePulseSignal | null = null;

  try {
    await requireWorkspaceManagerAccess(shopId, "Workspace pulse control");
    result = await apiMutation<WorkspacePulseSignal>(
      `/shops/${shopId}/projections/pulse/signals/${signalId}/`,
      {
        method: "PATCH",
        body: {
          action,
          note,
        },
      },
    );
  } catch (error) {
    const message = getSafeErrorMessage(error, "Unknown pulse control failure.");
    redirect(
      buildRedirectUrl({
        status: "error",
        action,
        title,
        message,
      }),
    );
  }

  revalidatePath("/");
  revalidatePath("/pulse");
  revalidatePath("/audit");
  redirect(
    buildRedirectUrl({
      status: "success",
      action,
      title: result?.title ?? title,
    }),
  );
}
