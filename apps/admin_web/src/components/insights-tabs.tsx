"use client";

import { useState } from "react";
import { Activity, PackageX, ShoppingBasket, Users } from "lucide-react";

import { BusinessPulse } from "@/components/business-pulse";
import { DeadStock } from "@/components/dead-stock";
import { ReorderList } from "@/components/reorder-list";
import { StaffPerformance } from "@/components/staff-performance";

type TabKey = "pulse" | "dead-stock" | "reorder" | "staff";

const TABS: { key: TabKey; label: string; icon: typeof Activity; hint: string }[] = [
  { key: "pulse", label: "Business pulse", icon: Activity, hint: "Money kept, and what earned it" },
  { key: "dead-stock", label: "Dead stock", icon: PackageX, hint: "Cash sitting on the shelf" },
  { key: "reorder", label: "Buying list", icon: ShoppingBasket, hint: "What to reorder today" },
  { key: "staff", label: "Team", icon: Users, hint: "Who is selling, and how" },
];

export function InsightsTabs({ shopName }: { shopName: string }) {
  const [tab, setTab] = useState<TabKey>("pulse");
  const active = TABS.find((t) => t.key === tab) ?? TABS[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-extrabold transition-colors ${
              tab === key
                ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary-hover)]"
                : "border-border-soft bg-surface text-text-secondary hover:text-text-primary"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <p className="text-xs font-semibold text-text-tertiary">{active.hint}</p>

      {tab === "pulse" && <BusinessPulse />}
      {tab === "dead-stock" && <DeadStock />}
      {tab === "reorder" && <ReorderList shopName={shopName} />}
      {tab === "staff" && <StaffPerformance />}
    </div>
  );
}
