"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { apiMutation } from "@/lib/admin-api";
import type {
  MigrationGoLiveCheckpointEvent,
  MigrationJobRun,
  MigrationLaunchCheckpointEvent,
  MigrationPhaseCheckpointEvent,
  MigrationPilotPreparationResult,
  MigrationPilotVerificationResult,
  MigrationRolloutCheckpointEvent,
  MigrationShopCheckpointEvent,
} from "@/lib/types";


function getRequiredControlId(formData: FormData): string {
  const controlId = String(formData.get("controlId") || "").trim();
  if (!controlId) {
    throw new Error("Missing migration control id.");
  }
  return controlId;
}

function getRequiredEventId(formData: FormData): string {
  const eventId = String(formData.get("eventId") || "").trim();
  if (!eventId) {
    throw new Error("Missing reconciliation event id.");
  }
  return eventId;
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

async function runReconciliationAction(
  formData: FormData,
  {
    nextStatus,
    action,
    resolutionNote,
  }: {
    nextStatus: "acknowledged" | "resolved" | "open";
    action: string;
    resolutionNote: string;
  },
) {
  const eventId = getRequiredEventId(formData);
  const domain = getOptionalField(formData, "domain");
  const shop = getOptionalField(formData, "shop");
  const issue = getOptionalField(formData, "issue");

  try {
    await apiMutation(`/migration/reconciliation/${eventId}/`, {
      method: "PATCH",
      body: {
        status: nextStatus,
        resolution_note: resolutionNote,
      },
    });
    revalidatePath("/migration");
    redirect(
      buildRedirectUrl({
        status: "success",
        action,
        domain,
        shop,
        issue,
        reconciliationStatus: nextStatus,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.replace(/\s+/g, " ").slice(0, 220)
        : "Unknown reconciliation action failure.";
    redirect(
      buildRedirectUrl({
        status: "error",
        action,
        domain,
        shop,
        issue,
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


export async function runPilotVerificationAction(formData: FormData) {
  const controlId = getRequiredControlId(formData);
  const domain = getOptionalField(formData, "domain");
  const shop = getOptionalField(formData, "shop");

  try {
    const result = await apiMutation<MigrationPilotVerificationResult>(
      `/migration/domains/${controlId}/verify-pilot/?run_inline=1`,
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
        action: "verify-pilot",
        domain,
        shop,
        healthy: String(result.healthy),
        requiresRollback: String(result.requires_rollback),
        operationalVerdict: result.operational_verdict,
        mismatchCount: String(result.latest_compare_mismatches),
        criticalCount: String(result.open_critical_events),
        summary: result.summary,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.replace(/\s+/g, " ").slice(0, 220)
        : "Unknown pilot verification failure.";
    redirect(
      buildRedirectUrl({
        status: "error",
        action: "verify-pilot",
        domain,
        shop,
        message,
      }),
    );
  }
}


export async function recordShopCheckpointAction(formData: FormData) {
  const shopId = getOptionalField(formData, "shopId");
  const shop = getOptionalField(formData, "shop");
  const decision = getOptionalField(formData, "decision");

  if (!shopId || !decision) {
    redirect(
      buildRedirectUrl({
        status: "error",
        action: "shop-checkpoint",
        shop,
        message: "Missing shop or checkpoint decision.",
      }),
    );
  }

  try {
    const result = await apiMutation<MigrationShopCheckpointEvent>(
      "/migration/pilot-shop-checkpoints/",
      {
        method: "POST",
        body: {
          shop: shopId,
          decision,
        },
      },
    );
    revalidatePath("/migration");
    redirect(
      buildRedirectUrl({
        status: "success",
        action: "shop-checkpoint",
        shop,
        decision: result.decision,
        shopCheckpointStatus: result.overall_status_snapshot,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.replace(/\s+/g, " ").slice(0, 220)
        : "Unknown shop checkpoint failure.";
    redirect(
      buildRedirectUrl({
        status: "error",
        action: "shop-checkpoint",
        shop,
        decision,
        message,
      }),
    );
  }
}


export async function recordPhaseCheckpointAction(formData: FormData) {
  const phase = getOptionalField(formData, "phase") || "phase_3";
  const decision = getOptionalField(formData, "decision");

  if (!decision) {
    redirect(
      buildRedirectUrl({
        status: "error",
        action: "phase-checkpoint",
        message: "Missing phase checkpoint decision.",
      }),
    );
  }

  try {
    const result = await apiMutation<MigrationPhaseCheckpointEvent>(
      "/migration/phase-checkpoints/",
      {
        method: "POST",
        body: {
          phase,
          decision,
        },
      },
    );
    revalidatePath("/migration");
    redirect(
      buildRedirectUrl({
        status: "success",
        action: "phase-checkpoint",
        phase: result.phase,
        decision: result.decision,
        phaseCheckpointStatus: result.overall_status_snapshot,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.replace(/\s+/g, " ").slice(0, 220)
        : "Unknown phase checkpoint failure.";
    redirect(
      buildRedirectUrl({
        status: "error",
        action: "phase-checkpoint",
        phase,
        decision,
        message,
      }),
    );
  }
}


export async function recordLaunchCheckpointAction(formData: FormData) {
  const phase = getOptionalField(formData, "phase") || "phase_5";
  const decision = getOptionalField(formData, "decision");

  if (!decision) {
    redirect(
      buildRedirectUrl({
        status: "error",
        action: "launch-checkpoint",
        message: "Missing launch checkpoint decision.",
      }),
    );
  }

  try {
    const result = await apiMutation<MigrationLaunchCheckpointEvent>(
      "/migration/launch-checkpoints/",
      {
        method: "POST",
        body: {
          phase,
          decision,
        },
      },
    );
    revalidatePath("/migration");
    redirect(
      buildRedirectUrl({
        status: "success",
        action: "launch-checkpoint",
        phase: result.phase,
        decision: result.decision,
        launchCheckpointStatus: result.overall_status_snapshot,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.replace(/\s+/g, " ").slice(0, 220)
        : "Unknown launch checkpoint failure.";
    redirect(
      buildRedirectUrl({
        status: "error",
        action: "launch-checkpoint",
        phase,
        decision,
        message,
      }),
    );
  }
}


export async function recordGoLiveCheckpointAction(formData: FormData) {
  const phase = getOptionalField(formData, "phase") || "phase_6";
  const decision = getOptionalField(formData, "decision");

  if (!decision) {
    redirect(
      buildRedirectUrl({
        status: "error",
        action: "go-live-checkpoint",
        message: "Missing go-live checkpoint decision.",
      }),
    );
  }

  try {
    const result = await apiMutation<MigrationGoLiveCheckpointEvent>(
      "/migration/go-live-checkpoints/",
      {
        method: "POST",
        body: {
          phase,
          decision,
        },
      },
    );
    revalidatePath("/migration");
    redirect(
      buildRedirectUrl({
        status: "success",
        action: "go-live-checkpoint",
        phase: result.phase,
        decision: result.decision,
        goLiveCheckpointStatus: result.overall_status_snapshot,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.replace(/\s+/g, " ").slice(0, 220)
        : "Unknown go-live checkpoint failure.";
    redirect(
      buildRedirectUrl({
        status: "error",
        action: "go-live-checkpoint",
        phase,
        decision,
        message,
      }),
    );
  }
}


export async function recordRolloutCheckpointAction(formData: FormData) {
  const phase = getOptionalField(formData, "phase") || "phase_7";
  const decision = getOptionalField(formData, "decision");

  if (!decision) {
    redirect(
      buildRedirectUrl({
        status: "error",
        action: "rollout-checkpoint",
        message: "Missing rollout checkpoint decision.",
      }),
    );
  }

  try {
    const result = await apiMutation<MigrationRolloutCheckpointEvent>(
      "/migration/rollout-checkpoints/",
      {
        method: "POST",
        body: {
          phase,
          decision,
        },
      },
    );
    revalidatePath("/migration");
    redirect(
      buildRedirectUrl({
        status: "success",
        action: "rollout-checkpoint",
        phase: result.phase,
        decision: result.decision,
        rolloutCheckpointStatus: result.overall_status_snapshot,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.replace(/\s+/g, " ").slice(0, 220)
        : "Unknown rollout checkpoint failure.";
    redirect(
      buildRedirectUrl({
        status: "error",
        action: "rollout-checkpoint",
        phase,
        decision,
        message,
      }),
    );
  }
}


export async function acknowledgeReconciliationAction(formData: FormData) {
  await runReconciliationAction(formData, {
    nextStatus: "acknowledged",
    action: "reconciliation-acknowledge",
    resolutionNote: "Acknowledged from the migration console for operator follow-up.",
  });
}


export async function resolveReconciliationAction(formData: FormData) {
  await runReconciliationAction(formData, {
    nextStatus: "resolved",
    action: "reconciliation-resolve",
    resolutionNote: "Resolved from the migration console after operator review.",
  });
}


export async function reopenReconciliationAction(formData: FormData) {
  await runReconciliationAction(formData, {
    nextStatus: "open",
    action: "reconciliation-reopen",
    resolutionNote: "Reopened from the migration console.",
  });
}
