"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { apiMutation } from "@/lib/admin-api";
import { requireWorkspaceManagerAccess, requireWorkspaceOwnerAccess } from "@/lib/server-guards";
import type {
  WorkspaceOwnershipTransferPayload,
  WorkspaceTeamMemberPayload,
} from "@/lib/types";

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
  return `/team?${searchParams.toString()}`;
}

function getSafeErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error
    ? error.message.replace(/\s+/g, " ").slice(0, 220)
    : fallback;
}

export async function inviteWorkspaceMemberAction(formData: FormData) {
  const shopId = getRequiredField(formData, "shopId", "shop id");
  const email = getRequiredField(formData, "email", "team member email");
  const role = getRequiredField(formData, "role", "target role");
  const fullName = getOptionalField(formData, "fullName");
  const phone = getOptionalField(formData, "phone");
  let result: WorkspaceTeamMemberPayload | null = null;

  try {
    await requireWorkspaceManagerAccess(shopId, "Workspace team invite");
    result = await apiMutation<WorkspaceTeamMemberPayload>(`/shops/${shopId}/team/`, {
      method: "POST",
      body: {
        email,
        full_name: fullName,
        phone,
        role,
      },
    });
  } catch (error) {
    const message = getSafeErrorMessage(error, "Unknown team invite failure.");
    redirect(
      buildRedirectUrl({
        status: "error",
        action: "invite",
        member: email,
        message,
      }),
    );
  }

  revalidatePath("/");
  revalidatePath("/team");
  redirect(
    buildRedirectUrl({
      status: "success",
      action: "invite",
      member: result?.member_email ?? email,
    }),
  );
}

export async function updateWorkspaceMemberAction(formData: FormData) {
  const shopId = getRequiredField(formData, "shopId", "shop id");
  const membershipId = getRequiredField(formData, "membershipId", "membership id");
  const role = getOptionalField(formData, "role");
  const status = getOptionalField(formData, "status");
  const member = getOptionalField(formData, "member");
  let result: WorkspaceTeamMemberPayload | null = null;

  try {
    await requireWorkspaceManagerAccess(shopId, "Workspace team update");
    const body: Record<string, string> = {};
    if (role) {
      body.role = role;
    }
    if (status) {
      body.status = status;
    }
    result = await apiMutation<WorkspaceTeamMemberPayload>(
      `/shops/${shopId}/team/${membershipId}/`,
      {
        method: "PATCH",
        body,
      },
    );
  } catch (error) {
    const message = getSafeErrorMessage(error, "Unknown team update failure.");
    redirect(
      buildRedirectUrl({
        status: "error",
        action: "update",
        member,
        message,
      }),
    );
  }

  revalidatePath("/");
  revalidatePath("/team");
  redirect(
    buildRedirectUrl({
      status: "success",
      action: "update",
      member: result?.member_email ?? member,
    }),
  );
}

export async function transferWorkspaceOwnershipAction(formData: FormData) {
  const shopId = getRequiredField(formData, "shopId", "shop id");
  const targetMembershipId = getRequiredField(formData, "targetMembershipId", "target member");
  const previousOwnerRole = getOptionalField(formData, "previousOwnerRole") || "admin";
  const confirmationText = getRequiredField(formData, "confirmationText", "confirmation text");
  let result: WorkspaceOwnershipTransferPayload | null = null;

  try {
    await requireWorkspaceOwnerAccess(shopId, "Workspace ownership transfer");
    result = await apiMutation<WorkspaceOwnershipTransferPayload>(
      `/shops/${shopId}/team/transfer-ownership/`,
      {
        method: "POST",
        body: {
          target_membership_id: targetMembershipId,
          previous_owner_role: previousOwnerRole,
          confirmation_text: confirmationText,
        },
      },
    );
  } catch (error) {
    const message = getSafeErrorMessage(error, "Unknown ownership transfer failure.");
    redirect(
      buildRedirectUrl({
        status: "error",
        action: "transfer",
        message,
      }),
    );
  }

  revalidatePath("/");
  revalidatePath("/team");
  redirect(
    buildRedirectUrl({
      status: "success",
      action: "transfer",
      member: result?.new_owner_email ?? "",
    }),
  );
}
