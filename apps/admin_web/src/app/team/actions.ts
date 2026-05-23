"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { apiMutation } from "@/lib/admin-api";
import { requireWorkspaceManagerAccess } from "@/lib/server-guards";
import type { WorkspaceTeamMemberPayload } from "@/lib/types";

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

export async function inviteWorkspaceMemberAction(formData: FormData) {
  const shopId = getRequiredField(formData, "shopId", "shop id");
  const email = getRequiredField(formData, "email", "team member email");
  const role = getRequiredField(formData, "role", "target role");
  const fullName = getOptionalField(formData, "fullName");
  const phone = getOptionalField(formData, "phone");

  try {
    await requireWorkspaceManagerAccess(shopId, "Workspace team invite");
    const result = await apiMutation<WorkspaceTeamMemberPayload>(`/shops/${shopId}/team/`, {
      method: "POST",
      body: {
        email,
        full_name: fullName,
        phone,
        role,
      },
    });

    revalidatePath("/");
    revalidatePath("/team");
    redirect(
      buildRedirectUrl({
        status: "success",
        action: "invite",
        member: result.member_email,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.replace(/\s+/g, " ").slice(0, 220)
        : "Unknown team invite failure.";
    redirect(
      buildRedirectUrl({
        status: "error",
        action: "invite",
        member: email,
        message,
      }),
    );
  }
}

export async function updateWorkspaceMemberAction(formData: FormData) {
  const shopId = getRequiredField(formData, "shopId", "shop id");
  const membershipId = getRequiredField(formData, "membershipId", "membership id");
  const role = getOptionalField(formData, "role");
  const status = getOptionalField(formData, "status");
  const member = getOptionalField(formData, "member");

  try {
    await requireWorkspaceManagerAccess(shopId, "Workspace team update");
    const body: Record<string, string> = {};
    if (role) {
      body.role = role;
    }
    if (status) {
      body.status = status;
    }
    const result = await apiMutation<WorkspaceTeamMemberPayload>(
      `/shops/${shopId}/team/${membershipId}/`,
      {
        method: "PATCH",
        body,
      },
    );

    revalidatePath("/");
    revalidatePath("/team");
    redirect(
      buildRedirectUrl({
        status: "success",
        action: "update",
        member: result.member_email,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.replace(/\s+/g, " ").slice(0, 220)
        : "Unknown team update failure.";
    redirect(
      buildRedirectUrl({
        status: "error",
        action: "update",
        member,
        message,
      }),
    );
  }
}
