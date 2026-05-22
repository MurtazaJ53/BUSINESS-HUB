"use client";

import { useState } from "react";

import {
  formatPlanTier,
  getPlanCompareSnapshot,
  getPlanUnlockNext,
} from "@/lib/plans";
import type { BusinessHubPlanTier } from "@/lib/types";

type WorkspacePlanCardProps = {
  shopName: string;
  planTier: BusinessHubPlanTier;
};

function getPlanAction(planTier: BusinessHubPlanTier) {
  switch (planTier) {
    case "starter":
      return {
        title: "Ready for daily operations?",
        body: "Growth is the next clean step when the shop needs expenses, attendance, and light supplier workflows without turning into a menu-heavy ERP.",
        buttonLabel: "Copy Growth upgrade brief",
        targetPlan: "Growth",
      };
    case "growth":
      return {
        title: "Need deeper owner control?",
        body: "Pro is the next step when the owner needs stronger finance summaries, richer reports, and advanced support surfaces.",
        buttonLabel: "Copy Pro upgrade brief",
        targetPlan: "Pro",
      };
    case "pro":
      return {
        title: "Keep Pro focused",
        body: "This workspace already has the highest curated plan. The main job now is keeping deeper controls limited to the right owners and admins.",
        buttonLabel: "Copy plan summary",
        targetPlan: "Pro",
      };
  }
}

function buildPlanBrief(shopName: string, planTier: BusinessHubPlanTier) {
  const compare = getPlanCompareSnapshot(planTier);
  const unlockNext = getPlanUnlockNext(planTier);
  const action = getPlanAction(planTier);

  return [
    "Business Hub workspace plan brief",
    `Workspace: ${shopName}`,
    `Current plan: ${formatPlanTier(planTier)}`,
    `Recommended next plan: ${action.targetPlan}`,
    "",
    `${compare.currentLabel}:`,
    ...compare.currentLines.map((line) => `- ${line}`),
    "",
    `${compare.nextLabel}:`,
    ...compare.nextLines.map((line) => `- ${line}`),
    "",
    "Upgrade posture:",
    `- ${unlockNext.title}`,
    `- ${unlockNext.body}`,
  ].join("\n");
}

export function WorkspacePlanCard({
  shopName,
  planTier,
}: WorkspacePlanCardProps) {
  const compare = getPlanCompareSnapshot(planTier);
  const unlockNext = getPlanUnlockNext(planTier);
  const action = getPlanAction(planTier);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(buildPlanBrief(shopName, planTier));
    setCopied(true);
  }

  return (
    <div className="panel-soft rounded-[28px] px-6 py-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="eyebrow">Workspace plan</p>
          <h2 className="mt-3 text-2xl font-bold">
            {formatPlanTier(planTier)} keeps this workspace curated
          </h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Show owners what is included right now, what the next plan unlocks,
            and give them a clean brief they can forward without exposing
            back-office complexity.
          </p>
        </div>
        <span className="rounded-full border border-[rgba(245,158,11,0.18)] bg-[rgba(77,49,9,0.34)] px-3 py-1 text-xs font-medium text-[var(--warning)]">
          {formatPlanTier(planTier)} plan
        </span>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="surface-muted rounded-[22px] px-4 py-4">
          <p className="eyebrow">{compare.currentLabel}</p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
            {compare.currentLines.map((line) => (
              <li key={line}>- {line}</li>
            ))}
          </ul>
        </div>
        <div className="surface-muted rounded-[22px] px-4 py-4">
          <p className="eyebrow">{compare.nextLabel}</p>
          <h3 className="mt-3 text-lg font-bold text-[var(--text-primary)]">
            {unlockNext.title}
          </h3>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
            {compare.nextLines.map((line) => (
              <li key={line}>- {line}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">
            {unlockNext.body}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-[22px] border border-[rgba(71,176,255,0.12)] bg-[rgba(10,18,32,0.7)] px-4 py-4">
        <p className="eyebrow">Owner action</p>
        <h3 className="mt-3 text-lg font-bold text-[var(--text-primary)]">
          {action.title}
        </h3>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
          {action.body}
        </p>
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center justify-center rounded-full border border-[rgba(71,176,255,0.16)] bg-[rgba(71,176,255,0.12)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(71,176,255,0.18)]"
          >
            {action.buttonLabel}
          </button>
          <span className="text-sm text-[var(--text-secondary)]">
            {copied
              ? "Plan brief copied. Share it with the Business Hub team."
              : "Copy the brief so the owner can request the next plan cleanly."}
          </span>
        </div>
      </div>
    </div>
  );
}
