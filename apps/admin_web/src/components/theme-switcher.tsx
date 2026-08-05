"use client";

import React, { useEffect, useState } from "react";
import { Sun, Moon, Monitor, Check } from "lucide-react";

type Theme = "light" | "dark" | "system";

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>("system");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Read preference on load
    const savedTheme = (localStorage.getItem("theme") as Theme) || "system";
    setTheme(savedTheme);
  }, []);

  const updateTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    setIsOpen(false);

    const root = document.documentElement;
    if (newTheme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.setAttribute("data-theme", isDark ? "dark" : "light");
    } else {
      root.setAttribute("data-theme", newTheme);
    }
  };

  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, [theme]);

  const activeIcon = () => {
    if (theme === "light") return <Sun className="w-4 h-4 text-[#F59E0B]" />;
    if (theme === "dark") return <Moon className="w-4 h-4 text-[#38BDF8]" />;
    return <Monitor className="w-4 h-4 text-[var(--text-secondary)]" />;
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-xl bg-white dark:bg-[#1E293B] border border-[var(--border-soft)] dark:border-[#2E3A52] text-[var(--text-secondary)] dark:text-[var(--text-tertiary)] hover:bg-[#F8FAFC] dark:hover:bg-[#151B2C] transition-all flex items-center justify-center shadow-sm"
        title="Switch theme"
      >
        {activeIcon()}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-40 rounded-2xl bg-white dark:bg-[#1E293B] border border-[var(--border-soft)] dark:border-[#2E3A52] p-1.5 shadow-lg z-50 animate-in fade-in slide-in-from-top-2 duration-100">
            <button
              onClick={() => updateTheme("light")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                theme === "light"
                  ? "bg-[#0EA5E9]/10 text-[#0284C7] dark:text-[#38BDF8]"
                  : "text-[#475569] dark:text-[var(--border)] hover:bg-[#F8FAFC] dark:hover:bg-[#151B2C]"
              }`}
            >
              <div className="flex items-center gap-2">
                <Sun className="w-3.5 h-3.5" />
                <span>Light</span>
              </div>
              {theme === "light" && <Check className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => updateTheme("dark")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                theme === "dark"
                  ? "bg-[#0EA5E9]/10 text-[#0284C7] dark:text-[#38BDF8]"
                  : "text-[#475569] dark:text-[var(--border)] hover:bg-[#F8FAFC] dark:hover:bg-[#151B2C]"
              }`}
            >
              <div className="flex items-center gap-2">
                <Moon className="w-3.5 h-3.5" />
                <span>Dark</span>
              </div>
              {theme === "dark" && <Check className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => updateTheme("system")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                theme === "system"
                  ? "bg-[#0EA5E9]/10 text-[#0284C7] dark:text-[#38BDF8]"
                  : "text-[#475569] dark:text-[var(--border)] hover:bg-[#F8FAFC] dark:hover:bg-[#151B2C]"
              }`}
            >
              <div className="flex items-center gap-2">
                <Monitor className="w-3.5 h-3.5" />
                <span>System</span>
              </div>
              {theme === "system" && <Check className="w-3.5 h-3.5" />}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
