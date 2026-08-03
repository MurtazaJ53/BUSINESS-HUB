"use client";

import React, { useState } from "react";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Users,
  CheckCheck,
  Sliders,
  Sparkles,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: "warning" | "success" | "info";
  is_read: boolean;
  created_at: string;
}

const SEED_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-1",
    title: "Low Stock Warning",
    message: "Cadbury Dairy Milk Silk 150g is running low (4 units remaining in shelf).",
    type: "warning",
    is_read: false,
    created_at: "2026-08-02T11:30:00Z",
  },
  {
    id: "notif-2",
    title: "Khata Udhaar Payment Received",
    message: "Rajesh Kumar settled ₹3,000.00 via UPI QR code.",
    type: "success",
    is_read: false,
    created_at: "2026-08-02T10:45:00Z",
  },
  {
    id: "notif-3",
    title: "Shift Attendance",
    message: "Rashi Cashier clocked into POS Terminal Desk #1.",
    type: "info",
    is_read: true,
    created_at: "2026-08-02T09:00:00Z",
  },
  {
    id: "notif-4",
    title: "Day Close Register Reconciled",
    message: "August 1st day-close register closed with ₹18,400.00 cash float matched.",
    type: "info",
    is_read: true,
    created_at: "2026-08-01T21:15:00Z",
  },
];

export function NotificationsFeed() {
  const [notifications, setNotifications] = useState<NotificationItem[]>(SEED_NOTIFICATIONS);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleToggleRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: !n.is_read } : n))
    );
  };

  const filtered = notifications.filter((n) => {
    if (filter === "unread") return !n.is_read;
    return true;
  });

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Store Notifications & Alerts</h2>
          <p className="text-xs text-[var(--text-tertiary)]">
            Real-time stock alerts, khata receipts, shift check-ins, and system notices
          </p>
        </div>

        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface-strong)] hover:bg-[var(--surface)] border border-[var(--border-soft)] text-xs text-white rounded-xl transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Mark all read</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border-soft)]">
        <button
          onClick={() => setFilter("all")}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
            filter === "all"
              ? "border-[var(--primary)] text-white"
              : "border-transparent text-[var(--text-tertiary)] hover:text-white"
          }`}
        >
          All Activity ({notifications.length})
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            filter === "unread"
              ? "border-[var(--primary)] text-white"
              : "border-transparent text-[var(--text-tertiary)] hover:text-white"
          }`}
        >
          <span>Unread Alerts</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-blue-500 text-white">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Feed List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="p-12 text-center bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl">
            <Bell className="w-8 h-8 text-[var(--text-disabled)] mx-auto mb-2" />
            <p className="text-xs text-[var(--text-tertiary)]">No unread notifications.</p>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => handleToggleRead(item.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-4 ${
                !item.is_read
                  ? "bg-[var(--surface-strong)] border-blue-500/30 shadow-md"
                  : "bg-[var(--surface)] border-[var(--border-soft)] opacity-80"
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  item.type === "warning"
                    ? "bg-amber-500/10 text-amber-400"
                    : item.type === "success"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-blue-500/10 text-blue-400"
                }`}
              >
                {item.type === "warning" ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : item.type === "success" ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Bell className="w-5 h-5" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-white">{item.title}</h4>
                  <span className="text-[10px] text-[var(--text-tertiary)] font-mono">
                    {formatDate(item.created_at, true)}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">{item.message}</p>
              </div>

              {!item.is_read && (
                <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 self-center" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
