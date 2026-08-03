"use client";

import React, { useState, useEffect } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { CommandPalette } from "@/components/command-palette";
import type { SessionUser, ShopMembership, BusinessHubPlanTier } from "@/lib/types";

type AppLayoutProps = {
  children: React.ReactNode;
  user?: SessionUser | null;
  currentShopId?: string;
  currentShopName?: string;
  planTier?: BusinessHubPlanTier;
  memberships?: ShopMembership[];
};

export function AppLayout({
  children,
  user,
  currentShopId,
  currentShopName,
  planTier,
  memberships,
}: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex">
      {/* Collapsible / Responsive Navigation Sidebar */}
      <AppSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isPlatformAdmin={user?.is_platform_admin}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 transition-all duration-200">
        {/* Top Header */}
        <AppHeader
          user={user}
          currentShopId={currentShopId}
          currentShopName={currentShopName}
          planTier={planTier}
          memberships={memberships}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        />

        {/* Dynamic Page Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

      {/* Hidden Thermal Receipt Print Target Container */}
      <div id="thermal-receipt-print-area" className="hidden" />
    </div>
  );
}
