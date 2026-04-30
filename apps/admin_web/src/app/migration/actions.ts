"use server";

import { revalidatePath } from "next/cache";

import { apiMutation } from "@/lib/admin-api";


function getRequiredControlId(formData: FormData): string {
  const controlId = String(formData.get("controlId") || "").trim();
  if (!controlId) {
    throw new Error("Missing migration control id.");
  }
  return controlId;
}


export async function promoteReadyAction(formData: FormData) {
  const controlId = getRequiredControlId(formData);
  await apiMutation(`/migration/domains/${controlId}/promote-ready/`, { method: "POST" });
  revalidatePath("/migration");
}


export async function promotePrimaryAction(formData: FormData) {
  const controlId = getRequiredControlId(formData);
  await apiMutation(`/migration/domains/${controlId}/promote-primary/`, { method: "POST" });
  revalidatePath("/migration");
}


export async function rollbackPilotAction(formData: FormData) {
  const controlId = getRequiredControlId(formData);
  await apiMutation(`/migration/domains/${controlId}/rollback/`, { method: "POST" });
  revalidatePath("/migration");
}
