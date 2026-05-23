"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { apiMutation } from "@/lib/admin-api";
import { requireWorkspaceManagerAccess } from "@/lib/server-guards";
import type { WorkspaceAccessSessionPayload } from "@/lib/types";

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
  return `/sessions?${searchParams.toString()}`;
}

function getSafeErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error
    ? error.message.replace(/\s+/g, " ").slice(0, 220)
    : fallback;
}

export async function updateWorkspaceSessionAction(formData: FormData) {
  const shopId = getRequiredField(formData, "shopId", "shop id");
  const sessionId = getRequiredField(formData, "sessionId", "session id");
  const action = getRequiredField(formData, "action", "action");
  const device = getOptionalField(formData, "device");
  const note = getOptionalField(formData, "note");
  let result: WorkspaceAccessSessionPayload | null = null;

  try {
    await requireWorkspaceManagerAccess(shopId, "Workspace session control");
    result = await apiMutation<WorkspaceAccessSessionPayload>(
      `/shops/${shopId}/sessions/${sessionId}/`,
      {
        method: "PATCH",
        body: {
          action,
          note,
        },
      },
    );
  } catch (error) {
    const message = getSafeErrorMessage(error, "Unknown workspace session failure.");
    redirect(
      buildRedirectUrl({
        status: "error",
        action,
        device,
        message,
      }),
    );
  }

  revalidatePath("/");
  revalidatePath("/sessions");
  revalidatePath("/audit");
  redirect(
    buildRedirectUrl({
      status: "success",
      action,
      device: result?.device_label ?? device,
    }),
  );
}
