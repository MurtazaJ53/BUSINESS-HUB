"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { apiMutation } from "@/lib/admin-api";
import type { MigrationJobRun, MigrationPilotPreparationResult } from "@/lib/types";


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

async function runMigrationJobAction(
  formData: FormData,
  {
    jobType,
  }: {
    jobType: "backfill" | "shadow_compare";
  },
) {
  const shopId = getOptionalField(formData, "shopId");
  const domain = getOptionalField(formData, "domain");
  const shop = getOptionalField(formData, "shop");

  if (!shopId || !domain) {
    redirect(
      buildRedirectUrl({
        status: "error",
        action: `run-${jobType}`,
        domain,
        shop,
        message: "Missing shop or domain for migration job trigger.",
      }),
    );
  }

  try {
    const job = await apiMutation<MigrationJobRun>("/migration/jobs/?run_inline=1", {
      method: "POST",
      body: {
        shop: shopId,
        domain,
        job_type: jobType,
        payload_json: {},
      },
    });
    revalidatePath("/migration");
    redirect(
      buildRedirectUrl({
        status: "success",
        action: `run-${jobType}`,
        domain,
        shop,
        jobStatus: job.status,
        rowsScanned: String(job.rows_scanned),
        rowsWritten: String(job.rows_written),
        mismatchCount: String(job.mismatch_count),
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.replace(/\s+/g, " ").slice(0, 220)
        : "Unknown migration job failure.";
    redirect(
      buildRedirectUrl({
        status: "error",
        action: `run-${jobType}`,
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


export async function runBackfillAction(formData: FormData) {
  await runMigrationJobAction(formData, { jobType: "backfill" });
}


export async function runShadowCompareAction(formData: FormData) {
  await runMigrationJobAction(formData, { jobType: "shadow_compare" });
}


export async function runPilotPreparationAction(formData: FormData) {
  const controlId = getRequiredControlId(formData);
  const domain = getOptionalField(formData, "domain");
  const shop = getOptionalField(formData, "shop");

  try {
    const result = await apiMutation<MigrationPilotPreparationResult>(
      `/migration/domains/${controlId}/prepare-pilot/?run_inline=1`,
      {
        method: "POST",
        body: {
          payloads: {},
        },
      },
    );
    revalidatePath("/migration");
    redirect(
      buildRedirectUrl({
        status: "success",
        action: "prepare-pilot",
        domain,
        shop,
        readyForPilot: String(result.readiness.ready_for_pilot),
        blockingCount: String(result.readiness.blocking_reasons.length),
        jobsCreated: String(result.jobs.length),
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.replace(/\s+/g, " ").slice(0, 220)
        : "Unknown pilot preparation failure.";
    redirect(
      buildRedirectUrl({
        status: "error",
        action: "prepare-pilot",
        domain,
        shop,
        message,
      }),
    );
  }
}
