"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { apiMutation } from "@/lib/admin-api";
import { requireWorkspaceManagerAccess } from "@/lib/server-guards";
import type { ShopPlanRequestPayload } from "@/lib/types";

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
  return `/plan?${searchParams.toString()}`;
}

export async function requestPlanUpgradeAction(formData: FormData) {
  const shopId = getRequiredField(formData, "shopId", "shop id");
  const shopSlug = getOptionalField(formData, "shopSlug");
  const requestedPlanTier = getRequiredField(
    formData,
    "requestedPlanTier",
    "requested plan tier",
  );
  const requestNote = getOptionalField(formData, "requestNote");

  try {
    await requireWorkspaceManagerAccess(shopId, "Workspace plan request");
    const result = await apiMutation<ShopPlanRequestPayload>(`/shops/${shopId}/plan-requests/`, {
      method: "POST",
      body: {
        requested_plan_tier: requestedPlanTier,
        request_note: requestNote,
        context_json: {
          source_surface: "admin_web_plan",
        },
      },
    });

    revalidatePath("/");
    revalidatePath("/plan");
    redirect(
      buildRedirectUrl({
        status: "success",
        requestedPlanTier: result.requested_plan_tier,
        requestStatus: result.status,
        shop: shopSlug,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.replace(/\s+/g, " ").slice(0, 220)
        : "Unknown plan request failure.";
    redirect(
      buildRedirectUrl({
        status: "error",
        requestedPlanTier,
        shop: shopSlug,
        message,
      }),
    );
  }
}
