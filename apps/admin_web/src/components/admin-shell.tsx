import Link from "next/link";
import type { ReactNode } from "react";

import { formatRole } from "@/lib/formatters";
import { canAccessAttendance, canAccessExpenses, formatPlanTier } from "@/lib/plans";
import { canAccessPaymentsWorkspace, canManageWorkspace } from "@/lib/roles";
import type { SessionPayload, ShopMembership } from "@/lib/types";

type AdminShellProps = {
  session: SessionPayload;
  activeShop: ShopMembership | null;
  activeRoute:
    | "overview"
    | "pulse"
    | "team"
    | "security"
    | "sessions"
    | "audit"
    | "plan"
    | "inventory"
    | "customers"
    | "sales"
    | "payments"
    | "expenses"
    | "attendance"
    | "migration"
    | "erpnext";
  title: string;
  subtitle: string;
  surfaceMode?: "product" | "internal";
  children: ReactNode;
};

type NavItem = {
  key: AdminShellProps["activeRoute"];
  label: string;
  href: string;
  glyph: string;
  group: "core" | "operations" | "internal";
};

const navItems: readonly NavItem[] = [
  {
    key: "overview",
    label: "Overview",
    href: "/",
    glyph: "OVR",
    group: "core",
  },
  {
    key: "inventory",
    label: "Inventory",
    href: "/inventory",
    glyph: "INV",
    group: "core",
  },
  {
    key: "customers",
    label: "Customers",
    href: "/customers",
    glyph: "CUS",
    group: "core",
  },
  {
    key: "sales",
    label: "Sales",
    href: "/sales",
    glyph: "SAL",
    group: "core",
  },
  {
    key: "pulse",
    label: "Pulse",
    href: "/pulse",
    glyph: "PLS",
    group: "operations",
  },
  {
    key: "security",
    label: "Security",
    href: "/security",
    glyph: "MFA",
    group: "operations",
  },
  {
    key: "team",
    label: "Team",
    href: "/team",
    glyph: "TEM",
    group: "operations",
  },
  {
    key: "sessions",
    label: "Sessions",
    href: "/sessions",
    glyph: "SES",
    group: "operations",
  },
  {
    key: "audit",
    label: "Audit",
    href: "/audit",
    glyph: "AUD",
    group: "operations",
  },
  {
    key: "plan",
    label: "Workspace plan",
    href: "/plan",
    glyph: "PLN",
    group: "operations",
  },
  {
    key: "payments",
    label: "Payments",
    href: "/payments",
    glyph: "PAY",
    group: "operations",
  },
  {
    key: "expenses",
    label: "Expenses",
    href: "/expenses",
    glyph: "EXP",
    group: "operations",
  },
  {
    key: "attendance",
    label: "Attendance",
    href: "/attendance",
    glyph: "ATT",
    group: "operations",
  },
  {
    key: "migration",
    label: "Migration",
    href: "/migration",
    glyph: "MIG",
    group: "internal",
  },
  {
    key: "erpnext",
    label: "ERPNext",
    href: "/erpnext",
    glyph: "ERP",
    group: "internal",
  },
] as const;

function getWorkspaceRole(activeShop: ShopMembership | null) {
  return activeShop?.role ?? null;
}

function getSectionedNav(
  session: SessionPayload,
  activeShop: ShopMembership | null,
): Array<{ label: string; items: NavItem[] }> {
  const workspaceRole = getWorkspaceRole(activeShop);

  const visibleItems = navItems.filter((item) => {
    if (item.group === "internal") {
      return session.user.is_platform_admin;
    }

    if (item.group === "operations") {
      if (item.key === "security") {
        return session.user.is_platform_admin || canManageWorkspace(workspaceRole);
      }

      if (!canManageWorkspace(workspaceRole)) {
        return false;
      }

      if (item.key === "payments") {
        return canAccessPaymentsWorkspace(workspaceRole);
      }

      if (item.key === "expenses") {
        return canAccessExpenses(activeShop);
      }

      if (item.key === "attendance") {
        return canAccessAttendance(activeShop);
      }

      return true;
    }

    return true;
  });

  const groups: Array<{ label: string; group: NavItem["group"] }> = [
    { label: "Daily work", group: "core" },
    { label: "Operations", group: "operations" },
    { label: "Internal tools", group: "internal" },
  ];

  return groups
    .map((group) => ({
      label: group.label,
      items: visibleItems.filter((item) => item.group === group.group),
    }))
    .filter((section) => section.items.length > 0);
}

export function AdminShell({
  session,
  activeShop,
  activeRoute,
  title,
  subtitle,
  surfaceMode = "product",
  children,
}: AdminShellProps) {
  const navSections = getSectionedNav(session, activeShop);
  const workspaceRole = getWorkspaceRole(activeShop);
  const workspaceRoleLabel = activeShop?.role_label ?? (workspaceRole ? formatRole(workspaceRole) : "Unassigned");
  const workspaceRoleSummary = activeShop?.role_summary ?? "Choose a workspace to see role scope.";
  const isInternal = surfaceMode === "internal";
  const workspacePlanLabel = activeShop ? formatPlanTier(activeShop.shop.plan_tier) : "Growth";

  return (
    <div className="min-h-screen px-4 py-4 md:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1500px] gap-4 lg:grid-cols-[270px_minmax(0,1fr)]">
        <aside
          className={`panel relative overflow-hidden rounded-[28px] px-5 py-5 ${
            isInternal ? "border-[rgba(255,138,106,0.14)]" : ""
          }`}
        >
          <div className="absolute inset-0 gridlines opacity-20" />
          <div className="relative flex h-full flex-col">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#47b0ff,#218cff)] text-lg font-semibold text-white shadow-[0_16px_34px_rgba(33,140,255,0.3)]">
                BH
              </div>
              <div>
                <p className="text-lg font-semibold">Business Hub</p>
                <p className="eyebrow mt-1">Admin workspace</p>
              </div>
            </div>

            <div className="space-y-5">
              {navSections.map((section) => (
                <div key={section.label}>
                  <p className="eyebrow px-1">{section.label}</p>
                  <nav className="mt-3 space-y-2">
                    {section.items.map((item) => {
                      const active = item.key === activeRoute;
                      return (
                        <Link
                          key={item.key}
                          href={item.href}
                          className={`flex items-center gap-4 rounded-[18px] px-4 py-3 transition-transform duration-150 hover:-translate-y-0.5 ${
                            active ? "nav-pill-active" : "nav-pill-idle"
                          }`}
                        >
                          <span className="text-xs font-bold tracking-[0.24em] text-[var(--text-muted)]">
                            {item.glyph}
                          </span>
                          <span className="text-base font-semibold">{item.label}</span>
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              ))}
            </div>

            <div className="panel-soft mt-6 rounded-[24px] px-4 py-4">
              <p className="eyebrow">Signed in</p>
              <p className="mt-3 text-lg font-semibold">
                {session.user.full_name || session.user.email}
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{session.user.email}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-[rgba(71,176,255,0.16)] bg-[rgba(71,176,255,0.12)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
                  {workspaceRoleLabel}
                </span>
                {session.user.is_platform_admin ? (
                  <span className="rounded-full border border-[rgba(58,215,162,0.18)] bg-[rgba(58,215,162,0.12)] px-3 py-1 text-xs font-medium text-[var(--success)]">
                    Platform admin
                  </span>
                ) : null}
                <span className="rounded-full border border-[rgba(245,158,11,0.18)] bg-[rgba(77,49,9,0.34)] px-3 py-1 text-xs font-medium text-[var(--warning)]">
                  {workspacePlanLabel} plan
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                {workspaceRoleSummary}
              </p>
            </div>

            <div className="mt-auto space-y-3 pt-6">
              <div className="surface-muted rounded-[24px] px-4 py-4">
                <p className="eyebrow">Active workspace</p>
                <p className="mt-2 text-lg font-semibold">
                  {activeShop?.shop.name ?? "No active shop selected"}
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {activeShop
                    ? `${activeShop.shop.slug} | ${workspacePlanLabel} | ${activeShop.shop.currency_code} | ${activeShop.shop.timezone}`
                    : "Add a shop membership to unlock the curated web workspace."}
                </p>
              </div>
              {isInternal ? (
                <div className="rounded-[24px] border border-[rgba(255,138,106,0.16)] bg-[rgba(44,18,14,0.64)] px-4 py-4 text-sm text-[var(--warning)]">
                  Internal only
                  <p className="mt-1 text-[var(--text-secondary)]">
                    These controls affect platform migration, ERP sync, and rollout safety.
                  </p>
                </div>
              ) : null}
              <div className="rounded-[24px] border border-[rgba(58,215,162,0.16)] bg-[rgba(9,42,31,0.64)] px-4 py-4 text-sm text-[var(--success)]">
                Backend connected
                <p className="mt-1 text-[var(--text-secondary)]">
                  Shop data is coming through the Business Hub API, not a raw ERP screen.
                </p>
              </div>
            </div>
          </div>
        </aside>

        <main
          className={`panel relative overflow-hidden rounded-[30px] ${
            isInternal ? "border-[rgba(255,138,106,0.14)]" : ""
          }`}
        >
          <div className="absolute inset-0 gridlines opacity-15" />
          <div className="relative px-6 py-6 md:px-8 lg:px-10">
            <header className="flex flex-col gap-5 border-b border-[var(--border-soft)] pb-7">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[rgba(71,176,255,0.14)] bg-[rgba(71,176,255,0.08)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
                      {activeShop?.shop.slug ?? "No workspace"}
                    </span>
                    <span className="rounded-full border border-[rgba(152,164,189,0.12)] bg-[rgba(9,14,22,0.52)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
                      {workspaceRoleLabel} workspace
                    </span>
                    {activeShop ? (
                      <span className="rounded-full border border-[rgba(245,158,11,0.18)] bg-[rgba(77,49,9,0.34)] px-3 py-1 text-xs font-medium text-[var(--warning)]">
                        {workspacePlanLabel} plan
                      </span>
                    ) : null}
                    {isInternal ? (
                      <span className="rounded-full border border-[rgba(255,138,106,0.18)] bg-[rgba(44,18,14,0.56)] px-3 py-1 text-xs font-medium text-[var(--warning)]">
                        Internal control plane
                      </span>
                    ) : null}
                  </div>
                  <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] md:text-5xl">
                    {title}
                  </h1>
                  <p className="mt-3 max-w-3xl text-base text-[var(--text-secondary)] md:text-lg">
                    {subtitle}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[340px]">
                  <div className="surface-muted rounded-[20px] px-4 py-4 text-sm text-[var(--text-secondary)]">
                    Currency
                    <div className="mt-1 text-base font-semibold text-[var(--text-primary)]">
                      {activeShop?.shop.currency_code ?? "INR"}
                    </div>
                  </div>
                  <div className="surface-muted rounded-[20px] px-4 py-4 text-sm text-[var(--text-secondary)]">
                    Time zone
                    <div className="mt-1 text-base font-semibold text-[var(--text-primary)]">
                      {activeShop?.shop.timezone ?? session.user.timezone}
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <div className="pt-8">
              {isInternal ? (
                <div className="mb-6 rounded-[24px] border border-[rgba(255,138,106,0.16)] bg-[rgba(44,18,14,0.52)] px-5 py-4 text-sm text-[var(--warning)]">
                  <div className="font-semibold text-[var(--text-primary)]">
                    Internal tools are separated from the normal product workspace.
                  </div>
                  <p className="mt-2 text-[var(--text-secondary)]">
                    Use these pages for platform operations, migration governance, and ERP engine
                    management, not normal owner or manager workflows.
                  </p>
                </div>
              ) : null}
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
