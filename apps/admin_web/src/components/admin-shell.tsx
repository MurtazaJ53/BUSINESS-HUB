"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Receipt,
  TrendingDown,
  Clock,
  BarChart3,
  Settings,
  Shield,
  Truck,
  MessageSquare,
  LogOut,
  Store,
  CreditCard,
  Layers,
  Bell,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

import { formatRole } from "@/lib/formatters";
import { canAccessAttendance, canAccessExpenses, formatPlanTier } from "@/lib/plans";
import { canAccessPaymentsWorkspace, canManageWorkspace } from "@/lib/roles";
import type { SessionPayload, ShopMembership } from "@/lib/types";

type AdminShellProps = {
  session: SessionPayload;
  activeShop: ShopMembership | null;
  activeRoute:
    | "notifications"
    | "overview"
    | "pos"
    | "inventory"
    | "customers"
    | "sales"
    | "expenses"
    | "attendance"
    | "reports"
    | "suppliers"
    | "purchases"
    | "chat"
    | "settings"
    | "pulse"
    | "team"
    | "security"
    | "sessions"
    | "audit"
    | "plan"
    | "payments"
    | "migration"
    | "erpnext"
    | "platform";
  title: string;
  subtitle: string;
  surfaceMode?: "product" | "internal";
  children: ReactNode;
};

export function AdminShell({
  session,
  activeShop,
  activeRoute,
  title,
  subtitle,
  surfaceMode = "product",
  children,
}: AdminShellProps) {
  const router = useRouter();
  const workspaceRole = activeShop?.role ?? null;
  const workspaceRoleLabel =
    activeShop?.role_label ?? (workspaceRole ? formatRole(workspaceRole) : "Staff");
  const workspacePlanLabel = activeShop ? formatPlanTier(activeShop.shop.plan_tier) : "Growth";
  const isPlatformAdmin = session.user.is_platform_admin;

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore network errors on logout
    }
    router.push("/login");
    router.refresh();
  };

  // APK Core navigation items
  const mainNav = [
    { key: "overview", label: "Home", href: "/", icon: LayoutDashboard },
    { key: "inventory", label: "Stock", href: "/inventory", icon: Package },
    { key: "customers", label: "Clients", href: "/customers", icon: Users },
    { key: "sales", label: "History", href: "/sales", icon: Receipt },
    { key: "pos", label: "POS", href: "/pos", icon: ShoppingCart, highlight: true },
  ];

  const adminNav = [
    { key: "settings", label: "Business details", href: "/settings", icon: Settings },
    { key: "team", label: "Staff & PINs", href: "/team", icon: Users },
    { key: "attendance", label: "Attendance", href: "/attendance", icon: Clock },
    { key: "expenses", label: "Expenses", href: "/expenses", icon: TrendingDown },
    { key: "suppliers", label: "Suppliers & purchases", href: "/suppliers", icon: Truck },
    { key: "migration", label: "Import & migration", href: "/migration", icon: Layers },
    { key: "security", label: "Security", href: "/security", icon: ShieldCheck },
  ];

  const advancedNav = [
    ...(isPlatformAdmin
      ? [{ key: "platform", label: "Admin tools", href: "/platform/shops", icon: Shield }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-[#EEF2F6] text-[#0F172A] flex flex-col">
      {/* Top Bar matching APK Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] px-4 lg:px-8 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          
          {/* Logo & Store Selector */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#38BDF8] to-[#0284C7] flex items-center justify-center shadow-[0_4px_12px_rgba(14,165,233,0.3)]">
                <Store className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-base font-black text-[#0F172A] tracking-tight hidden sm:inline">
                  Business Hub
                </span>
                <span className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                  Cloud POS
                </span>
              </div>
            </Link>

            {activeShop && (
              <div className="hidden md:flex items-center gap-2 ml-4 pl-4 border-l border-[#E2E8F0]">
                <div className="px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-[#0F172A]">{activeShop.shop.name}</span>
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-[#0EA5E9]/10 text-[#0284C7] uppercase">
                    {workspacePlanLabel}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions & Profile */}
          <div className="flex items-center gap-2.5">
            <Link
              href="/pos"
              className="px-4 py-2 bg-gradient-to-r from-[#38BDF8] to-[#0284C7] hover:from-[#0EA5E9] hover:to-[#0369A1] text-white rounded-xl text-xs font-extrabold shadow-[0_4px_14px_rgba(14,165,233,0.3)] flex items-center gap-1.5 transition-all"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:inline">OPEN POS TERMINAL</span>
              <span className="sm:hidden">POS</span>
            </Link>

            <Link
              href="/notifications"
              className="p-2 rounded-xl bg-[#F8FAFC] hover:bg-[#EEF2F6] border border-[#E2E8F0] text-[#64748B] transition-colors relative"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#0EA5E9]" />
            </Link>



            {/* Profile pill */}
            <div className="flex items-center gap-2 pl-2 border-l border-[#E2E8F0]">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#0EA5E9] to-[#38BDF8] text-white text-xs font-black flex items-center justify-center shadow-sm">
                {(session.user.full_name || session.user.email || "U").charAt(0).toUpperCase()}
              </div>
              <div className="hidden xl:block text-left">
                <p className="text-xs font-bold text-[#0F172A] leading-tight truncate max-w-[120px]">
                  {session.user.full_name || session.user.email}
                </p>
                <p className="text-[10px] font-semibold text-[#64748B] capitalize">
                  {workspaceRoleLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 text-[#94A3B8] hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors ml-1"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout Grid */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)] gap-6">
        
        {/* Left Sidebar Navigation matching APK tabs */}
        <aside className="hidden lg:flex flex-col gap-6">
          
          {/* Main App Navigation Panel (Core Workflows) */}
          <div className="bg-white border border-[#E2E8F0] rounded-[24px] p-3.5 shadow-sm space-y-1">
            <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#94A3B8]">
              Core Workflows
            </div>
            {mainNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeRoute === item.key;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? "bg-[#0EA5E9] text-white shadow-[0_4px_12px_rgba(14,165,233,0.3)]"
                      : item.highlight
                      ? "bg-[#0EA5E9]/10 text-[#0284C7] hover:bg-[#0EA5E9]/20"
                      : "text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : ""}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Shop Administration Panel (Manage) */}
          <div className="bg-white border border-[#E2E8F0] rounded-[24px] p-3.5 shadow-sm space-y-1">
            <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#94A3B8]">
              Manage
            </div>
            {adminNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeRoute === item.key;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? "bg-[#0EA5E9] text-white shadow-[0_4px_12px_rgba(14,165,233,0.3)]"
                      : "text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Advanced Panel (Pulse, devices, operations) */}
          {advancedNav.length > 0 && (
            <div className="bg-white border border-[#E2E8F0] rounded-[24px] p-3.5 shadow-sm space-y-1">
              <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#94A3B8]">
                Advanced
              </div>
              {advancedNav.map((item) => {
                const Icon = item.icon;
                const isActive = activeRoute === item.key;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? "bg-[#0EA5E9] text-white shadow-[0_4px_12px_rgba(14,165,233,0.3)]"
                        : "text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Connected Server Card */}
          <div className="bg-gradient-to-br from-white to-[#F0F9FF] border border-[#BAE6FD] rounded-[24px] p-4 text-xs">
            <div className="flex items-center gap-2 text-[#0284C7] font-extrabold mb-1">
              <span className="w-2 h-2 rounded-full bg-[#0EA5E9] animate-pulse" />
              <span>Backend Connected</span>
            </div>
            <p className="text-[11px] text-[#64748B] leading-relaxed">
              Real-time POS sync active. Currency: <b>{activeShop?.shop.currency_code || "INR"}</b>
            </p>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 flex flex-col min-w-0">
          
          {/* Header Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-[28px] p-6 sm:p-7 shadow-sm mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-extrabold bg-[#0EA5E9]/10 text-[#0284C7] mb-2 uppercase">
                <Store className="w-3.5 h-3.5" />
                <span>{activeShop?.shop.name || "Business Hub"}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-[900] text-[#0F172A] tracking-tight">
                {title}
              </h1>
              <p className="text-xs sm:text-sm font-medium text-[#64748B] mt-1">
                {subtitle}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl text-right">
                <span className="block text-[10px] font-bold text-[#94A3B8] uppercase">Timezone</span>
                <span className="text-xs font-extrabold text-[#0F172A]">
                  {activeShop?.shop.timezone || "Asia/Kolkata"}
                </span>
              </div>
              <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl text-right">
                <span className="block text-[10px] font-bold text-[#94A3B8] uppercase">Currency</span>
                <span className="text-xs font-extrabold text-[#0284C7]">
                  {activeShop?.shop.currency_code || "INR"}
                </span>
              </div>
            </div>
          </div>

          {/* Child Page Rendering */}
          <div className="flex-1">{children}</div>
        </main>
      </div>
    </div>
  );
}
