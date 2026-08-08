import Link from "next/link";
import type { ReactNode } from "react";
import type { SessionPayload } from "@/lib/types";

type PlatformShellProps = {
  session: SessionPayload;
  activeRoute: "shops" | "metrics" | "audit";
  title: string;
  subtitle: string;
  children: ReactNode;
};

type NavItem = {
  key: PlatformShellProps["activeRoute"] | "back";
  label: string;
  href: string;
  glyph: string;
};

const navItems: readonly NavItem[] = [
  {
    key: "back",
    label: "Back to workspace",
    href: "/",
    glyph: "BWD",
  },
  {
    key: "shops",
    label: "Shops Registry",
    href: "/platform/shops",
    glyph: "SHP",
  },
  {
    key: "metrics",
    label: "Global Metrics",
    href: "/platform/metrics",
    glyph: "MET",
  },
  {
    key: "audit",
    label: "Audit Log",
    href: "/platform/audit",
    glyph: "AUD",
  },
] as const;

export function PlatformShell({
  session,
  activeRoute,
  title,
  subtitle,
  children,
}: PlatformShellProps) {
  return (
    <div className="min-h-screen px-4 py-4 md:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1500px] gap-4 lg:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="panel relative overflow-hidden rounded-[28px] border-[rgba(245,158,11,0.14)] px-5 py-5">
          <div className="absolute inset-0 gridlines opacity-20" />
          <div className="relative flex h-full flex-col">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#fbbf24,#f59e0b)] text-lg font-semibold text-white shadow-[0_16px_34px_rgba(245,158,11,0.3)]">
                PC
              </div>
              <div>
                <p className="text-lg font-semibold">Platform Cockpit</p>
                <p className="eyebrow mt-1">Admin workspace</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <p className="eyebrow px-1">Navigation</p>
                <nav className="mt-3 space-y-2">
                  {navItems.map((item) => {
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
            </div>

            <div className="panel-soft mt-6 rounded-[24px] px-4 py-4">
              <p className="eyebrow">Signed in</p>
              <p className="mt-3 text-lg font-semibold">
                {session.user.full_name || session.user.email}
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{session.user.email}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-[rgba(245,158,11,0.18)] bg-[rgba(245,158,11,0.12)] px-3 py-1 text-xs font-medium text-[var(--warning)]">
                  Platform admin
                </span>
              </div>
            </div>

            <div className="mt-auto pt-6">
              <div className="rounded-[24px] border border-[rgba(245,158,11,0.16)] bg-[rgba(77,49,9,0.64)] px-4 py-4 text-sm text-[var(--warning)]">
                Operator access only
                <p className="mt-1 text-[var(--text-secondary)]">
                  These controls affect all tenants. Every action is audited.
                </p>
              </div>
            </div>
          </div>
        </aside>

        <main className="panel relative overflow-hidden rounded-[30px] border-[rgba(245,158,11,0.14)]">
          <div className="absolute inset-0 gridlines opacity-15" />
          <div className="relative px-6 py-6 md:px-8 lg:px-10">
            <header className="flex flex-col gap-5 border-b border-[var(--border-soft)] pb-7">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[rgba(245,158,11,0.18)] bg-[rgba(245,158,11,0.08)] px-3 py-1 text-xs font-medium text-[var(--warning)]">
                      Platform cockpit
                    </span>
                    <span className="rounded-full border border-[rgba(245,158,11,0.18)] bg-[rgba(245,158,11,0.08)] px-3 py-1 text-xs font-medium text-[var(--warning)]">
                      Audited access
                    </span>
                  </div>
                  <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] md:text-5xl">
                    {title}
                  </h1>
                  <p className="mt-3 max-w-3xl text-base text-[var(--text-secondary)] md:text-lg">
                    {subtitle}
                  </p>
                </div>
              </div>
            </header>

            <div className="pt-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
