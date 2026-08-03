"use client";

import React, { useState } from "react";
import {
  Users,
  Clock,
  Plus,
  Shield,
  CheckCircle2,
  Calendar,
  LogIn,
  LogOut,
  Mail,
  X,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export interface StaffMember {
  id: string;
  shop?: string;
  user_id?: string;
  full_name: string;
  email: string;
  role: "owner" | "admin" | "manager" | "cashier" | string;
  phone?: string;
  status: "active" | "invited" | "disabled" | string;
  joined_at: string;
}

export interface AttendanceRecord {
  id: string;
  staff_id: string;
  staff_name: string;
  check_in: string;
  check_out?: string;
  status: "present" | "half_day" | "absent" | string;
}

const SEED_STAFF: StaffMember[] = [
  {
    id: "staff-1",
    shop: "shop-1",
    user_id: "user-1",
    full_name: "Murtaza J",
    email: "murtaza@businesshub.com",
    role: "owner",
    phone: "+91 98100 11223",
    status: "active",
    joined_at: "2026-05-01T00:00:00Z",
  },
  {
    id: "staff-2",
    shop: "shop-1",
    user_id: "user-2",
    full_name: "Rashi Cashier",
    email: "rashi@businesshub.com",
    role: "cashier",
    phone: "+91 98200 44556",
    status: "active",
    joined_at: "2026-06-15T00:00:00Z",
  },
  {
    id: "staff-3",
    shop: "shop-1",
    user_id: "user-3",
    full_name: "Amit Sharma",
    email: "amit.inv@businesshub.com",
    role: "manager",
    phone: "+91 98300 77889",
    status: "active",
    joined_at: "2026-07-01T00:00:00Z",
  },
];

const SEED_ATTENDANCE: AttendanceRecord[] = [
  {
    id: "att-1",
    staff_id: "staff-2",
    staff_name: "Rashi Cashier",
    check_in: "2026-08-02T09:00:00Z",
    status: "present",
  },
  {
    id: "att-2",
    staff_id: "staff-3",
    staff_name: "Amit Sharma",
    check_in: "2026-08-02T09:15:00Z",
    status: "present",
  },
];

export function TeamAttendance() {
  const [staff, setStaff] = useState<StaffMember[]>(SEED_STAFF);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(SEED_ATTENDANCE);
  const [activeTab, setActiveTab] = useState<"team" | "attendance">("team");

  // Invite modal
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "manager" | "cashier">("cashier");

  // Clock in status
  const [myClockIn, setMyClockIn] = useState<string | null>("2026-08-02T09:00:00Z");

  const handleInviteStaff = (e: React.FormEvent) => {
    e.preventDefault();
    const newMember: StaffMember = {
      id: `staff-${Date.now()}`,
      shop: "shop-1",
      user_id: `user-${Date.now()}`,
      full_name: inviteName,
      email: inviteEmail,
      role: inviteRole,
      status: "active",
      joined_at: new Date().toISOString(),
    };
    setStaff((prev) => [...prev, newMember]);
    setIsInviteOpen(false);
    setInviteEmail("");
    setInviteName("");
  };

  const handleToggleClock = () => {
    if (myClockIn) {
      setMyClockIn(null);
    } else {
      setMyClockIn(new Date().toISOString());
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary tracking-tight">
            Team Members & Staff Attendance
          </h2>
          <p className="text-xs text-[var(--text-tertiary)]">
            Manage store employees, assign POS/admin role permissions, and track shift clock-ins
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleClock}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
              myClockIn
                ? "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                : "bg-emerald-600 hover:bg-emerald-500 text-white"
            }`}
          >
            {myClockIn ? (
              <>
                <LogOut className="w-4 h-4 text-amber-400" />
                <span>Clock Out of Shift</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Clock In to Shift</span>
              </>
            )}
          </button>

          <button
            onClick={() => setIsInviteOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-text-primary text-xs font-semibold rounded-xl shadow-md shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Invite Team Member</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border-soft)]">
        <button
          onClick={() => setActiveTab("team")}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "team"
              ? "border-[var(--primary)] text-white"
              : "border-transparent text-[var(--text-tertiary)] hover:text-white"
          }`}
        >
          Team Roster ({staff.length})
        </button>
        <button
          onClick={() => setActiveTab("attendance")}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "attendance"
              ? "border-[var(--primary)] text-white"
              : "border-transparent text-[var(--text-tertiary)] hover:text-white"
          }`}
        >
          Daily Shift Attendance ({attendance.length} Active)
        </button>
      </div>

      {activeTab === "team" ? (
        /* Team Table */
        <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--bg-soft)] border-b border-[var(--border-soft)] text-[var(--text-tertiary)] font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Member Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4 text-center">Store Role</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {staff.map((m) => (
                  <tr key={m.id} className="hover:bg-bg-base transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{m.full_name}</div>
                      {m.phone && (
                        <div className="text-[10px] text-[var(--text-tertiary)]">{m.phone}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[var(--text-secondary)]">{m.email}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          m.role === "owner"
                            ? "bg-purple-500/20 text-purple-300"
                            : m.role === "admin"
                            ? "bg-blue-500/20 text-blue-300"
                            : m.role === "manager"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-emerald-500/20 text-emerald-300"
                        }`}
                      >
                        {m.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300">
                        {m.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[var(--text-tertiary)]">
                      {formatDate(m.joined_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Attendance Table */
        <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--bg-soft)] border-b border-[var(--border-soft)] text-[var(--text-tertiary)] font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Shift Check-In</th>
                  <th className="py-3 px-4">Shift Check-Out</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {attendance.map((att) => (
                  <tr key={att.id} className="hover:bg-bg-base transition-colors">
                    <td className="py-3 px-4 font-semibold text-text-primary">{att.staff_name}</td>
                    <td className="py-3 px-4 text-emerald-400 font-mono">
                      {formatDate(att.check_in, true)}
                    </td>
                    <td className="py-3 px-4 text-[var(--text-tertiary)] font-mono">
                      {att.check_out ? formatDate(att.check_out, true) : "Currently on Shift"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300">
                        {att.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Invite Staff */}
      {isInviteOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsInviteOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[var(--border-soft)] flex items-center justify-between bg-[var(--bg-soft)]">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[var(--primary-light)]" />
                <span className="font-semibold text-sm text-text-primary">Invite Team Member</span>
              </div>
              <button
                onClick={() => setIsInviteOpen(false)}
                className="p-1 text-[var(--text-tertiary)] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInviteStaff} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Sunil Mehra"
                  className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="staff@example.com"
                  className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Role & Store Access
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-bg-soft border border-[var(--border-soft)] rounded-xl text-xs text-text-primary focus:outline-none"
                >
                  <option value="cashier">Cashier (POS & Sales only)</option>
                  <option value="manager">Manager (POS, Inventory, Khata, Expenses)</option>
                  <option value="admin">Store Admin (Full store configuration)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-[var(--border-soft)] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-white bg-bg-base rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-md"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
