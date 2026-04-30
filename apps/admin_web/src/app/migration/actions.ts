"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { apiMutation } from "@/lib/admin-api";


function getRequiredControlId(formData: FormData): string {
  const controlId = String(formData.get("controlId") || "").trim();
  if (!controlId) {
    throw new Error("Missing migration control id.");
  }
  return controlId;
}

function getOptionalField(formData: FormData, key: string): string {
  return String(formData.get(key) || "").trim();
}

function buildRedirectUrl(params: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  return `/migration?${searchParams.toString()}`;
}

async function runPilotAction(
  formData: FormData,
  {
    pathBuilder,
    action,
  }: {
    pathBuilder: (controlId: string) => string;
    action: string;
  },
) {
  const controlId = getRequiredControlId(formData);
  const domain = getOptionalField(formData, "domain");
  const shop = getOptionalField(formData, "shop");

  try {
    await apiMutation(pathBuilder(controlId), { method: "POST" });
    revalidatePath("/migration");
    redirect(
      buildRedirectUrl({
        status: "success",
        action,
        domain,
        shop,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.replace(/\s+/g, " ").slice(0, 220)
        : "Unknown migration action failure.";
    redirect(
      buildRedirectUrl({
        status: "error",
        action,
        domain,
        shop,
        message,
      }),
    );
  }
}


export async function promoteReadyAction(formData: FormData) {
  await runPilotAction(formData, {
    pathBuilder: (controlId) => `/migration/domains/${controlId}/promote-ready/`,
    action: "promote-ready",
  });
}


export async function promotePrimaryAction(formData: FormData) {
  await runPilotAction(formData, {
    pathBuilder: (controlId) => `/migration/domains/${controlId}/promote-primary/`,
    action: "promote-primary",
  });
}


export async function rollbackPilotAction(formData: FormData) {
  await runPilotAction(formData, {
    pathBuilder: (controlId) => `/migration/domains/${controlId}/rollback/`,
    action: "rollback",
  });
}
