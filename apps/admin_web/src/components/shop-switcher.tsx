"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Store,
  Check,
  ChevronsUpDown,
  Plus,
  KeyRound,
} from "lucide-react";
import type { ShopMembership, BusinessHubPlanTier } from "@/lib/types";

type ShopSwitcherProps = {
  currentShopId?: string;
  currentShopName?: string;
  planTier?: BusinessHubPlanTier;
  memberships?: ShopMembership[];
};

export function ShopSwitcher({
  currentShopId,
  currentShopName = "Business Hub Store",
  planTier = "starter",
  memberships = [],
}: ShopSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSelectShop = (shopId: string) => {
    setIsOpen(false);
    // In production, switches active shop context cookie/header or query param
    router.push(`/?shop=${shopId}`);
    router.refresh();
  };

  const getPlanBadge = (tier: BusinessHubPlanTier) => {
    switch (tier) {
      case "pro":
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
            PRO
          </span>
        );
      case "growth":
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
            GROWTH
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-[var(--success)]/20 text-[var(--success)] border border-[var(--success)]/30">
            STARTER
          </span>
        );
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Switcher Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-strong)] border border-[var(--border-soft)] hover:border-[var(--border)] transition-all max-w-[240px] text-left"
      >
        <div className="p-1.5 rounded-lg bg-blue-500/10 text-[var(--primary-light)] shrink-0">
          <Store className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
              {currentShopName}
            </span>
            {getPlanBadge(planTier)}
          </div>
          <div className="text-[10px] text-[var(--text-tertiary)] truncate">
            Active Workspace
          </div>
        </div>
        <ChevronsUpDown className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="p-3 border-b border-[var(--border-soft)] bg-[var(--bg-soft)]">
            <div className="text-xs font-semibold text-[var(--text-primary)]">
              Your Workspaces
            </div>
            <div className="text-[11px] text-[var(--text-tertiary)]">
              Switch between shops or register a new one
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto p-1.5 space-y-1">
            {memberships.length === 0 ? (
              <div className="px-3 py-2 text-xs text-[var(--text-secondary)] flex items-center justify-between rounded-lg bg-[var(--surface-strong)]">
                <span className="truncate">{currentShopName}</span>
                <Check className="w-4 h-4 text-[var(--primary-light)]" />
              </div>
            ) : (
              memberships.map((m) => {
                const shopId = typeof m.shop === "string" ? m.shop : m.shop.id;
                const shopName = typeof m.shop === "string" ? m.shop : m.shop.name;
                const isCurrent = shopId === currentShopId || shopName === currentShopName;
                return (
                  <button
                    key={m.id}
                    onClick={() => handleSelectShop(shopId)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                      isCurrent
                        ? "bg-[var(--surface-strong)] text-[var(--text-primary)] font-semibold"
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface-strong)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <div className="truncate">
                      <div className="truncate">{shopName || "Shop " + shopId.slice(0, 8)}</div>
                      <div className="text-[10px] text-[var(--text-tertiary)] capitalize">
                        Role: {m.role}
                      </div>
                    </div>
                    {isCurrent && <Check className="w-4 h-4 text-[var(--primary-light)] shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="p-2 border-t border-[var(--border-soft)] bg-[var(--bg-deep)] space-y-1">
            <button
              onClick={() => {
                setIsOpen(false);
                router.push("/register?new_shop=1");
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--primary-light)] hover:bg-[var(--surface-strong)] rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Shop</span>
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                router.push("/invite/join");
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-strong)] rounded-lg transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Join with Team Code</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
