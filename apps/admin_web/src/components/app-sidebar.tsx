"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Clock,
  Package,
  Boxes,
  Users,
  Truck,
  DollarSign,
  UserCheck,
  BarChart3,
  RefreshCw,
  Activity,
  MessageSquare,
  ShieldCheck,
  Building2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers,
} from "lucide-react";

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  isPlatformOnly?: boolean;
};

type NavGroup = {
  groupTitle: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    groupTitle: "Commerce & Sales",
    items: [
      { title: "Dashboard", href: "/", icon: LayoutDashboard },
      { title: "POS Terminal", href: "/pos", icon: ShoppingCart, badge: "F2" },
      { title: "Sales & Invoices", href: "/sales", icon: Receipt },
      { title: "Day Close", href: "/day-close", icon: Clock },
    ],
  },
  {
    groupTitle: "Operations",
    items: [
      { title: "Inventory & Stock", href: "/inventory", icon: Package },
      { title: "Categories", href: "/inventory/categories", icon: Boxes },
      { title: "Customers & Khata", href: "/customers", icon: Users },
      { title: "Purchases & Inwards", href: "/purchases", icon: Truck },
      { title: "Expenses", href: "/expenses", icon: DollarSign },
      { title: "Staff & Attendance", href: "/attendance", icon: UserCheck },
    ],
  },
  {
    groupTitle: "Analytics & Sync",
    items: [
      { title: "Reports & P&L", href: "/reports", icon: BarChart3 },
      { title: "ERPNext Bridge", href: "/erpnext", icon: RefreshCw },
      { title: "Pulse Health", href: "/pulse", icon: Activity },
    ],
  },
  {
    groupTitle: "Team & Governance",
    items: [
      { title: "Team Chat", href: "/chat", icon: MessageSquare },
      { title: "Team & Roles", href: "/team", icon: Layers },
      { title: "Security & Passkeys", href: "/security", icon: ShieldCheck },
      {
        title: "Platform Admin",
        href: "/platform",
        icon: Building2,
        isPlatformOnly: true,
      },
    ],
  },
];

type AppSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  isPlatformAdmin?: boolean;
};

export function AppSidebar({
  isOpen,
  onClose,
  isPlatformAdmin = false,
}: AppSidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 flex flex-col bg-[var(--bg-base)] border-r border-[var(--border-soft)] transition-all duration-200 ease-in-out ${
          isCollapsed ? "w-20" : "w-64"
        } ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-[var(--border-soft)]">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-bold shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-sm text-[var(--text-primary)] tracking-tight">
                  Business Hub
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)] font-medium">
                  Cloud Enterprise POS
                </span>
              </div>
            )}
          </Link>

          {/* Desktop Collapse Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-strong)] transition-colors"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation Item Groups */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {NAV_GROUPS.map((group) => {
            // Filter out platform-only items if not admin
            const visibleItems = group.items.filter(
              (item) => !item.isPlatformOnly || isPlatformAdmin
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.groupTitle} className="space-y-1">
                {!isCollapsed && (
                  <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                    {group.groupTitle}
                  </div>
                )}

                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => {
                        if (window.innerWidth < 1024) onClose();
                      }}
                      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                        active
                          ? "bg-[var(--primary)] text-white shadow-md shadow-blue-500/20 font-semibold"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-strong)]"
                      } ${isCollapsed ? "justify-center" : ""}`}
                      title={isCollapsed ? item.title : undefined}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                          active
                            ? "text-white"
                            : "text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]"
                        }`}
                      />

                      {!isCollapsed && (
                        <span className="flex-1 truncate">{item.title}</span>
                      )}

                      {!isCollapsed && item.badge && (
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                            active
                              ? "bg-white/20 text-white"
                              : "bg-[var(--surface-strong)] text-[var(--text-tertiary)] border border-[var(--border-soft)]"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer Info */}
        {!isCollapsed && (
          <div className="p-3 border-t border-[var(--border-soft)] bg-[var(--bg-deep)]">
            <div className="flex items-center justify-between text-[11px] text-[var(--text-tertiary)] px-2">
              <span>v3.4 Production</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
