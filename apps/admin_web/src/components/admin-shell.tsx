import Link from "next/link";
import type { ReactNode } from "react";

import { formatRole } from "@/lib/formatters";
import type { SessionPayload, ShopMembership } from "@/lib/types";

type AdminShellProps = {
  session: SessionPayload;
  activeShop: ShopMembership | null;
  activeRoute:
    | "overview"
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

function canSeeOperations(role: ShopMembership["role"] | null) {
  return role === "owner" || role === "admin";
}

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
      return canSeeOperations(workspaceRole);
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
  children,
}: AdminShellProps) {
  const navSections = getSectionedNav(session, activeShop);
  const workspaceRole = getWorkspaceRole(activeShop);
  const workspaceRoleLabel = workspaceRole ? formatRole(workspaceRole) : "Unassigned";

  return (
    <div className="min-h-screen px-4 py-4 md:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1500px] gap-4 lg:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="panel relative overflow-hidden rounded-[28px] px-5 py-5">
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
              </div>
            </div>

            <div className="mt-auto space-y-3 pt-6">
              <div className="surface-muted rounded-[24px] px-4 py-4">
                <p className="eyebrow">Active workspace</p>
                <p className="mt-2 text-lg font-semibold">
                  {activeShop?.shop.name ?? "No active shop selected"}
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {activeShop
                    ? `${activeShop.shop.slug} | ${activeShop.shop.currency_code} | ${activeShop.shop.timezone}`
                    : "Add a shop membership to unlock the curated web workspace."}
                </p>
              </div>
              <div className="rounded-[24px] border border-[rgba(58,215,162,0.16)] bg-[rgba(9,42,31,0.64)] px-4 py-4 text-sm text-[var(--success)]">
                Backend connected
                <p className="mt-1 text-[var(--text-secondary)]">
                  Shop data is coming through the Business Hub API, not a raw ERP screen.
                </p>
              </div>
            </div>
          </div>
        </aside>

        <main className="panel relative overflow-hidden rounded-[30px]">
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

            <div className="pt-8">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
