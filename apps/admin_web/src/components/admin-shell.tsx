import Link from "next/link";
import type { ReactNode } from "react";

import { formatRole } from "@/lib/formatters";
import type { SessionPayload, ShopMembership } from "@/lib/types";

type AdminShellProps = {
  session: SessionPayload;
  activeShop: ShopMembership | null;
  activeRoute: "overview" | "inventory" | "customers" | "expenses" | "attendance";
  title: string;
  subtitle: string;
  children: ReactNode;
};

const navItems = [
  {
    key: "overview",
    label: "Overview",
    href: "/",
    glyph: "◇",
  },
  {
    key: "inventory",
    label: "Inventory",
    href: "/inventory",
    glyph: "▣",
  },
  {
    key: "customers",
    label: "Customers",
    href: "/customers",
    glyph: "◎",
  },
  {
    key: "expenses",
    label: "Expenses",
    href: "/expenses",
    glyph: "↗",
  },
  {
    key: "attendance",
    label: "Attendance",
    href: "/attendance",
    glyph: "◔",
  },
] as const;

export function AdminShell({
  session,
  activeShop,
  activeRoute,
  title,
  subtitle,
  children,
}: AdminShellProps) {
  return (
    <div className="min-h-screen px-4 py-4 md:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1600px] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="panel relative overflow-hidden rounded-[28px] px-5 py-6">
          <div className="absolute inset-0 gridlines opacity-30" />
          <div className="relative flex h-full flex-col">
            <div className="mb-8 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#5caefe,#368cff)] text-2xl font-semibold text-white shadow-[0_20px_40px_rgba(54,140,255,0.32)]">
                B
              </div>
              <div>
                <p className="text-xl font-semibold">Business Hub Pro</p>
                <p className="eyebrow mt-1">Command Grid</p>
              </div>
            </div>

            <nav className="space-y-2">
              {navItems.map((item) => {
                const active = item.key === activeRoute;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`flex items-center gap-4 rounded-[20px] px-4 py-3 transition-transform duration-150 hover:-translate-y-0.5 ${
                      active ? "nav-pill-active" : "nav-pill-idle"
                    }`}
                  >
                    <span className="text-lg">{item.glyph}</span>
                    <span className="text-base font-semibold">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="panel-soft mt-8 rounded-[24px] px-4 py-4">
              <p className="eyebrow">Active operator</p>
              <p className="mt-3 text-lg font-semibold">{session.user.full_name || session.user.email}</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{session.user.email}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-[rgba(92,174,254,0.2)] bg-[rgba(92,174,254,0.12)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
                  {activeShop ? formatRole(activeShop.role) : "Unassigned"}
                </span>
                {session.user.is_platform_admin ? (
                  <span className="rounded-full border border-[rgba(52,211,153,0.2)] bg-[rgba(52,211,153,0.12)] px-3 py-1 text-xs font-medium text-[var(--success)]">
                    Platform admin
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-auto space-y-3 pt-8">
              <div className="panel-soft rounded-[24px] px-4 py-4">
                <p className="eyebrow">Shop workspace</p>
                <p className="mt-2 text-lg font-semibold">
                  {activeShop?.shop.name ?? "No active shop selected"}
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {activeShop
                    ? `${activeShop.shop.slug} · ${activeShop.shop.currency_code} · ${activeShop.shop.timezone}`
                    : "Bootstrap a membership to continue phase 1 testing."}
                </p>
              </div>
              <div className="rounded-[24px] border border-[rgba(52,211,153,0.14)] bg-[rgba(7,40,28,0.7)] px-4 py-4 text-sm text-[var(--success)]">
                Backend linked
                <p className="mt-1 text-[var(--text-secondary)]">
                  Session, memberships, and inventory are being served by Django phase 1 APIs.
                </p>
              </div>
            </div>
          </div>
        </aside>

        <main className="panel relative overflow-hidden rounded-[32px]">
          <div className="absolute inset-0 gridlines opacity-20" />
          <div className="relative px-6 py-6 md:px-8 lg:px-10">
            <header className="flex flex-col gap-5 border-b border-[var(--border-soft)] pb-8 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="eyebrow">Phase 1 admin shell</p>
                <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] md:text-6xl">
                  {title}
                </h1>
                <p className="mt-3 max-w-2xl text-base text-[var(--text-secondary)] md:text-lg">
                  {subtitle}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-[18px] border border-[rgba(52,211,153,0.18)] bg-[rgba(8,48,32,0.78)] px-4 py-3 text-sm text-[var(--success)]">
                  Live bridge prep
                  <div className="mt-1 text-xs text-[var(--text-secondary)]">
                    Django, DRF, Redis, and Celery aligned
                  </div>
                </div>
                <div className="rounded-[18px] border border-[rgba(92,174,254,0.16)] bg-[rgba(8,18,34,0.82)] px-4 py-3 text-sm text-[var(--accent)]">
                  {activeShop?.shop.currency_code ?? "INR"}
                  <div className="mt-1 text-xs text-[var(--text-secondary)]">
                    {activeShop?.shop.timezone ?? session.user.timezone}
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
