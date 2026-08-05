import { redirect } from "next/navigation";

/**
 * Retired.
 *
 * This page sold a three-tier starter/growth/pro model with plan *requests*,
 * which is not how Business Hub bills. There is one Pro plan sold over four
 * durations with a 30-day trial — see /billing. Two pages quoting different
 * prices to the same shopkeeper is worse than one, so this forwards.
 *
 * The previous implementation is in git history (commit 4fafd86) if the tiered
 * model ever comes back.
 */
export default function PlanPage() {
  redirect("/billing");
}
