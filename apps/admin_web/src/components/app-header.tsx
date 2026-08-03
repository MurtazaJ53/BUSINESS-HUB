"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Menu,
  Search,
  ShoppingCart,
  Shield,
  LogOut,
  User,
  Radio,
  ExternalLink,
} from "lucide-react";
import { ShopSwitcher } from "@/components/shop-switcher";
import { NotificationsPopover } from "@/components/notifications-popover";
import type { SessionUser, ShopMembership, BusinessHubPlanTier } from "@/lib/types";

type AppHeaderProps = {
  user?: SessionUser | null;
  currentShopId?: string;
  currentShopName?: string;
  planTier?: BusinessHubPlanTier;
  memberships?: ShopMembership[];
  onToggleSidebar: () => void;
  onOpenCommandPalette: () => void;
};

export function AppHeader({
  user,
  currentShopId,
  currentShopName,
  planTier = "starter",
  memberships = [],
  onToggleSidebar,
  onOpenCommandPalette,
}: AppHeaderProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

  const handleLogout = async () => {
    setUserMenuOpen(false);
    // In production, clears session and redirects to /login
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[var(--border-soft)] bg-[var(--bg-base)]/85 px-4 backdrop-blur-md">
      {/* Left side: Mobile menu toggle + Shop switcher */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-strong)] transition-colors lg:hidden"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <ShopSwitcher
          currentShopId={currentShopId}
          currentShopName={currentShopName}
          planTier={planTier}
          memberships={memberships}
        />

        {/* Live WebSocket Pulse Status */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
          <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
          <span>Realtime Live</span>
        </div>
      </div>

      {/* Center / Search bar trigger */}
      <div className="flex-1 max-w-md mx-4 hidden sm:block">
        <button
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-strong)] border border-[var(--border-soft)] hover:border-[var(--border)] text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-all shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-[var(--text-tertiary)]" />
            <span>Search products, sales, khata, commands...</span>
          </div>
          <kbd className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[10px] bg-[var(--surface-strong)] text-[var(--text-secondary)] rounded border border-[var(--border-soft)]">
            Ctrl + K
          </kbd>
        </button>
      </div>

      {/* Right side: Quick POS sale + Notifications + User menu */}
      <div className="flex items-center gap-2.5">
        {/* Quick POS Sale Button */}
        <Link
          href="/pos"
          className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium text-xs shadow-md shadow-blue-500/20 transition-all active:scale-95"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>POS Terminal</span>
          <kbd className="hidden lg:inline-block px-1.5 py-0.2 text-[10px] font-mono bg-white/20 rounded">
            F2
          </kbd>
        </Link>

        {/* Notifications Popover */}
        <NotificationsPopover />

        {/* User Profile Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-[var(--surface-strong)] transition-colors"
            aria-label="User profile menu"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-semibold text-xs flex items-center justify-center shadow-sm">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-semibold text-[var(--text-primary)] leading-tight">
                {user?.full_name || "Merchant"}
              </div>
              <div className="text-[10px] text-[var(--text-tertiary)] leading-tight">
                {user?.is_platform_admin ? "Platform Admin" : "Store Manager"}
              </div>
            </div>
          </button>

          {/* User Dropdown */}
          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="p-3.5 border-b border-[var(--border-soft)] bg-[var(--bg-soft)]">
                <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                  {user?.full_name || "Signed in user"}
                </div>
                <div className="text-[11px] text-[var(--text-tertiary)] truncate">
                  {user?.email || "merchant@businesshub.com"}
                </div>
                {user?.is_platform_admin && (
                  <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold bg-purple-500/20 text-purple-300 rounded border border-purple-500/30">
                    Platform Superadmin
                  </span>
                )}
              </div>

              <div className="p-1.5 space-y-1">
                <Link
                  href="/profile"
                  onClick={() => setUserMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-strong)] rounded-xl transition-colors"
                >
                  <User className="w-4 h-4 text-[var(--text-tertiary)]" />
                  <span>My Profile</span>
                </Link>

                <Link
                  href="/security"
                  onClick={() => setUserMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-strong)] rounded-xl transition-colors"
                >
                  <Shield className="w-4 h-4 text-[var(--text-tertiary)]" />
                  <span>Security & Passkeys</span>
                </Link>

                {user?.is_platform_admin && (
                  <Link
                    href="/platform"
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs text-purple-300 hover:bg-purple-500/10 rounded-xl transition-colors font-medium"
                  >
                    <span>Platform Admin Portal</span>
                    <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
                  </Link>
                )}
              </div>

              <div className="p-1.5 border-t border-[var(--border-soft)] bg-[var(--bg-deep)]">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
