import React, { useState } from 'react';
import { 
  Users, Clock, CreditCard, Calendar, Search, ChevronRight, Clock3,
  UserPlus, Filter, DollarSign, Download, Clock9, Lock, Unlock,
  Send, Trash2, MessageCircle, Edit3, ShieldCheck, Ticket, PlusCircle,
  Share2, Package, ShoppingCart, TrendingUp, AlertTriangle, BarChart3,
  ShieldAlert, Check, CheckCircle2, Loader2, X, ChevronDown
} from 'lucide-react';
import { doc, deleteDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { verifyAdminPin } from '@/lib/admin';
import { useSqlQuery } from '@/db/hooks';
import { useBusinessStore } from '@/lib/useBusinessStore';
import { getRolePermissions, normalizePermissionMatrix } from '@/lib/permissions';
import { formatCurrency, cn } from '@/lib/utils';
import { Staff, Action, Module, PermissionMatrix, Attendance } from '@/lib/types';
import { shareInviteWhatsApp, sendWhatsAppInvite } from '@/lib/whatsapp';
import { showToast } from '@/lib/toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { usePermission } from '@/hooks/usePermission';

// --- 🛡️ PERMISSION ENGINE CONFIG ---
const APP_MODULES: { id: Module; label: string; icon: any; actions: Action[] }[] = [
  { id: 'inventory', label: 'Inventory', icon: Package, actions: ['view', 'create', 'edit', 'delete', 'view_cost'] },
  { id: 'sales', label: 'Sales Hub', icon: ShoppingCart, actions: ['view', 'create', 'void_sale', 'override_price', 'view_profit'] },
  { id: 'customers', label: 'Customers', icon: Users, actions: ['view', 'create', 'edit', 'delete', 'approve_credit'] },
  { id: 'expenses', label: 'Expenses', icon: TrendingUp, actions: ['view', 'create', 'delete'] },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, actions: ['view', 'export'] },
  { id: 'team', label: 'Team Portal', icon: Users, actions: ['view', 'edit', 'view_cost'] },
  { id: 'settings', label: 'Settings', icon: ShieldAlert, actions: ['view', 'edit'] },
];

const PermissionTable = ({ permissions = {}, onChange }: { permissions: PermissionMatrix, onChange: (p: PermissionMatrix) => void }) => {
  const columns: { id: Action; label: string }[] = [
    { id: 'view', label: 'View' }, { id: 'create', label: 'Add' }, { id: 'edit', label: 'Edit' },
    { id: 'delete', label: 'Delete' }, { id: 'void_sale', label: 'Void' }, { id: 'override_price', label: 'Price' },
    { id: 'export', label: 'Export' }, { id: 'view_cost', label: 'Cost' }, { id: 'view_profit', label: 'Profit' },
    { id: 'approve_credit', label: 'Credit' }
  ];

  const handleToggle = (modId: Module, actId: Action) => {
    const next = { ...permissions };
    const mod = { ...(next[modId] || {}) };
    if (mod[actId]) delete mod[actId];
    else mod[actId] = actId === 'override_price' ? { max: 1000 } : true;
    next[modId] = mod;
    onChange(next);
  };

  const handleLimitChange = (modId: Module, limit: number) => {
    const next = { ...permissions };
    const mod = { ...(next[modId] || {}) };
    mod.override_price = { max: limit };
    next[modId] = mod;
    onChange(next);
  };

  return (
    <div className="relative overflow-x-auto no-scrollbar rounded-[1.5rem] border border-border bg-background shadow-inner">
      <table className="w-full text-left border-collapse min-w-[700px]">
        <thead className="sticky top-0 z-20 bg-accent/90 backdrop-blur-md border-b border-border">
          <tr>
            <th className="py-5 px-6 text-[10px] font-black first:rounded-tl-2xl uppercase tracking-widest text-muted-foreground bg-accent sticky left-0 z-30 border-r border-border/50 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.15)]">System Sector</th>
            {columns.map(col => (
              <th key={col.id} className="py-5 px-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {APP_MODULES.map(mod => (
            <tr key={mod.id} className="group/row hover:bg-accent/30 transition-colors">
              <td className="py-4 px-6 font-black text-xs text-foreground bg-accent/30 sticky left-0 z-10 border-r border-border/50 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.15)] backdrop-blur-sm">
                <div className="flex items-center gap-4">
                  <div className="h-8 w-8 rounded-xl bg-background border border-border flex items-center justify-center text-muted-foreground group-hover/row:text-primary transition-all shadow-sm">
                    <mod.icon className="h-4 w-4" />
                  </div>
                  {mod.label}
                </div>
              </td>
              {columns.map(col => {
                const isSupported = mod.actions.includes(col.id);
                const isActive = !!(permissions[mod.id] || {})[col.id];
                
                return (
                  <td key={col.id} className="py-2 px-1">
                    <div className="flex flex-col items-center justify-center gap-2">
                      {isSupported ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggle(mod.id, col.id)}
                            className={cn(
                              "relative inline-flex h-4 w-9 shrink-0 cursor-pointer items-center rounded-full border border-border/50 transition-colors duration-200 focus:outline-none",
                              isActive ? "bg-primary border-primary shadow-[0_0_10px_rgba(var(--primary),0.3)]" : "bg-accent/50 hover:bg-accent"
                            )}
                          >
                            <span
                              className={cn(
                                "pointer-events-none inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow-sm transition duration-200",
                                isActive ? "translate-x-5" : "translate-x-1"
                              )}
                            />
                          </button>
                          
                          {col.id === 'override_price' && isActive && (
                            <div className="relative group/limit animate-in slide-in-from-top-1 mt-1">
                              <input 
                                type="number"
                                placeholder="Limit"
                                value={typeof (permissions[mod.id] || {})[col.id] === 'object' ? ((permissions[mod.id] || {})[col.id] as any).max : ''}
                                onChange={(e) => handleLimitChange(mod.id, Number(e.target.value))}
                                className="w-16 bg-background border border-border rounded-lg py-1 text-[9px] font-black text-center focus:outline-none focus:ring-1 focus:ring-primary shadow-sm text-foreground"
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="h-1.5 w-1.5 rounded-full bg-border/20" />
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background pointer-events-none opacity-40" />
    </div>
  );
};

// --- 🚀 MAIN TEAM PORTAL ---
type AnalyticsRangePreset = 'today' | 'yesterday' | 'last7' | 'this_month' | 'last_month' | 'this_year';
type AnalyticsRange = {
  preset: AnalyticsRangePreset;
  start: string;
  end: string;
  label: string;
  shortLabel: string;
  dayCount: number;
  includesToday: boolean;
};

const ANALYTICS_RANGE_OPTIONS: Array<{ id: AnalyticsRangePreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 Days' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'this_year', label: 'This Year' },
];

const PAYOUT_METHOD_OPTIONS = [
  { id: 'CASH', label: 'Cash' },
  { id: 'UPI', label: 'UPI' },
  { id: 'BANK', label: 'Bank' },
  { id: 'CARD', label: 'Card' },
  { id: 'OTHER', label: 'Other' },
] as const;

const padDatePart = (value: number) => String(value).padStart(2, '0');

const toDateKey = (date: Date) => {
  const safe = new Date(date);
  safe.setHours(0, 0, 0, 0);
  return `${safe.getFullYear()}-${padDatePart(safe.getMonth() + 1)}-${padDatePart(safe.getDate())}`;
};

const dateFromKey = (dateKey: string) => {
  const [year, month, day] = dateKey.slice(0, 10).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const getDateDiffInDays = (startKey: string, endKey: string) => {
  const start = dateFromKey(startKey);
  const end = dateFromKey(endKey);
  const diff = end.getTime() - start.getTime();
  return Math.max(1, Math.round(diff / 86400000) + 1);
};

const buildAnalyticsRange = (preset: AnalyticsRangePreset, anchorDate = new Date()): AnalyticsRange => {
  const anchor = new Date(anchorDate);
  anchor.setHours(0, 0, 0, 0);

  let start = new Date(anchor);
  let end = new Date(anchor);
  let label = 'Today';
  let shortLabel = 'Today';

  switch (preset) {
    case 'yesterday':
      start = new Date(anchor);
      start.setDate(start.getDate() - 1);
      end = new Date(start);
      label = `Yesterday - ${toDateKey(start)}`;
      shortLabel = 'Yesterday';
      break;
    case 'last7':
      start = new Date(anchor);
      start.setDate(start.getDate() - 6);
      label = `${toDateKey(start)} to ${toDateKey(end)}`;
      shortLabel = 'Last 7 Days';
      break;
    case 'this_month':
      start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      label = anchor.toLocaleString('default', { month: 'long', year: 'numeric' });
      shortLabel = 'This Month';
      break;
    case 'last_month':
      start = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
      end = new Date(anchor.getFullYear(), anchor.getMonth(), 0);
      label = start.toLocaleString('default', { month: 'long', year: 'numeric' });
      shortLabel = 'Last Month';
      break;
    case 'this_year':
      start = new Date(anchor.getFullYear(), 0, 1);
      label = `${anchor.getFullYear()} Annual View`;
      shortLabel = 'This Year';
      break;
    case 'today':
    default:
      label = `Today - ${toDateKey(anchor)}`;
      shortLabel = 'Today';
      break;
  }

  const startKey = toDateKey(start);
  const endKey = toDateKey(end);
  return {
    preset,
    start: startKey,
    end: endKey,
    label,
    shortLabel,
    dayCount: getDateDiffInDays(startKey, endKey),
    includesToday: startKey <= toDateKey(anchor) && endKey >= toDateKey(anchor),
  };
};

const isDateInRange = (dateValue: string | undefined, range: AnalyticsRange) => {
  if (!dateValue) return false;
  const dateKey = dateValue.slice(0, 10);
  return dateKey >= range.start && dateKey <= range.end;
};

const getLatestAttendanceRecord = (entries: Attendance[]) => (
  entries.reduce<Attendance | null>((latest, entry) => {
    if (!latest) return entry;
    const latestKey = `${latest.date}|${latest.clockOut || latest.clockIn || '00:00'}`;
    const entryKey = `${entry.date}|${entry.clockOut || entry.clockIn || '00:00'}`;
    return entryKey > latestKey ? entry : latest;
  }, null)
);

const getStaffPeriodMetrics = (
  entries: Attendance[],
  salary: number,
  standardWorkingHours: number,
  range: AnalyticsRange,
) => {
  const fullDays = entries.filter((entry) => entry.status === 'PRESENT').length;
  const halfDays = entries.filter((entry) => entry.status === 'HALF_DAY').length;
  const absentDays = entries.filter((entry) => entry.status === 'ABSENT').length;
  const leaveDays = entries.filter((entry) => entry.status === 'LEAVE').length;
  const effectiveDays = fullDays + (halfDays * 0.5);
  const totalHours = entries.reduce((sum, entry) => sum + Number(entry.totalHours || 0), 0);
  const overtimeHours = entries.reduce((sum, entry) => sum + Number(entry.overtime || 0), 0);
  const bonusTotal = entries.reduce((sum, entry) => sum + Number(entry.bonus || 0), 0);
  const safeStandardHours = standardWorkingHours || 9;
  const dailyRate = salary / 30;
  const hourlyRate = dailyRate / safeStandardHours;
  const overtimePay = overtimeHours * hourlyRate;
  const earned = Math.round((effectiveDays * dailyRate) + overtimePay + bonusTotal);

  return {
    recordCount: entries.length,
    fullDays,
    halfDays,
    absentDays,
    leaveDays,
    effectiveDays,
    totalHours: Number(totalHours.toFixed(1)),
    overtimeHours: Number(overtimeHours.toFixed(1)),
    bonusTotal: Math.round(bonusTotal),
    overtimePay: Math.round(overtimePay),
    earned,
    baseSalary: salary,
    yieldPct: Math.min(999, Math.round((effectiveDays / Math.max(1, range.dayCount)) * 100)),
    latestRecord: getLatestAttendanceRecord(entries),
  };
};

export default function Team() {
  const { addExpense, upsertStaff, recordAttendance, role, shop, updateShop, deleteStaff, invitations, shopId: storeShopId, currentStaff } = useBusinessStore();
  
  // 📊 Local Database Telemetry
  const staff = useSqlQuery<Staff>('SELECT * FROM staff WHERE tombstone = 0 ORDER BY name ASC', [], ['staff']);
  const staffPrivate = useSqlQuery<any>('SELECT * FROM staff_private WHERE tombstone = 0', [], ['staff_private']);
  const attendance = useSqlQuery<Attendance>('SELECT * FROM attendance WHERE tombstone = 0', [], ['attendance']);
  const expenses = useSqlQuery<any>('SELECT * FROM expenses WHERE tombstone = 0 ORDER BY date DESC', [], ['expenses']);
  
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthRange = buildAnalyticsRange('this_month');

  // 🎛️ UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'roster' | 'attendance' | 'payroll'>('roster');
  const [attendanceRangePreset, setAttendanceRangePreset] = useState<AnalyticsRangePreset>('today');
  const [payrollRangePreset, setPayrollRangePreset] = useState<AnalyticsRangePreset>('this_month');
  
  // Modals
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [newStaffPermissions, setNewStaffPermissions] = useState<PermissionMatrix>({});
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [confirmRemoveStaff, setConfirmRemoveStaff] = useState<Staff | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [generatingInvite, setGeneratingInvite] = useState(false);

  const [manualEntryStaff, setManualEntryStaff] = useState<Staff | null>(null);
  const [manualTimes, setManualTimes] = useState<any>({ date: today, clockIn: '09:00', clockOut: '18:00', status: 'PRESENT', overtime: 0, bonus: 0 });
  
  const [payoutStaff, setPayoutStaff] = useState<Staff | null>(null);
  const [isAdvanceMode, setIsAdvanceMode] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('Sales Associate');
  const [showAdvancedAccess, setShowAdvancedAccess] = useState(false);

  const [customAmount, setCustomAmount] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState<(typeof PAYOUT_METHOD_OPTIONS)[number]['id']>('CASH');
  const [payoutReference, setPayoutReference] = useState('');

  // 🔒 Permissions
  const canViewPayroll = usePermission('team', 'view_cost');
  const canEditTeam = usePermission('team', 'edit');
  const attendanceRange = buildAnalyticsRange(attendanceRangePreset);
  const payrollRange = buildAnalyticsRange(payrollRangePreset);
  const standardWorkingHours = shop?.standardWorkingHours || 9;
  const currentMonthPayoutMode = payrollRangePreset === 'this_month';

  const filteredStaff = staff.filter((s: Staff) => {
    if (!canEditTeam) return currentStaff ? s.id === currentStaff.id : false;
    return s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.phone.includes(searchTerm);
  });

  // 🧮 Payroll Engine
  const calculateStaffSalary = (staffMember: Staff, range: AnalyticsRange) => {
    const scopedAttendance = attendance.filter((entry: Attendance) => entry.staffId === staffMember.id && isDateInRange(entry.date, range));
    const privateData = staffPrivate.find((p: any) => p.id === staffMember.id);
    return getStaffPeriodMetrics(scopedAttendance, privateData?.salary || 0, standardWorkingHours, range);
  };

  const totalPayroll = staff.reduce((sum: number, staffMember: Staff) => sum + calculateStaffSalary(staffMember, currentMonthRange).earned, 0);
  const attendanceInsights = filteredStaff.map((staffMember: Staff) => ({
    staff: staffMember,
    metrics: calculateStaffSalary(staffMember, attendanceRange),
  }));
  const payrollInsights = filteredStaff.map((staffMember: Staff) => {
    const metrics = calculateStaffSalary(staffMember, payrollRange);
    const paidAmount = expenses
      .filter((expense: any) =>
        (expense.category === 'Staff Salary' || expense.category === 'Advance Salary') &&
        expense.description?.includes(staffMember.name) &&
        isDateInRange(expense.date, payrollRange))
      .reduce((sum: number, expense: any) => sum + Number(expense.amount || 0), 0);

    return { staff: staffMember, metrics, paidAmount };
  });
  const attendanceTotals = attendanceInsights.reduce((summary, entry) => ({
    loggedStaff: summary.loggedStaff + (entry.metrics.recordCount > 0 ? 1 : 0),
    effectiveDays: summary.effectiveDays + entry.metrics.effectiveDays,
    trackedHours: summary.trackedHours + entry.metrics.totalHours,
    overtimeHours: summary.overtimeHours + entry.metrics.overtimeHours,
    bonuses: summary.bonuses + entry.metrics.bonusTotal,
  }), {
    loggedStaff: 0,
    effectiveDays: 0,
    trackedHours: 0,
    overtimeHours: 0,
    bonuses: 0,
  });
  const payrollTotals = payrollInsights.reduce((summary, entry) => ({
    earned: summary.earned + entry.metrics.earned,
    paid: summary.paid + entry.paidAmount,
    overtime: summary.overtime + entry.metrics.overtimePay,
    bonus: summary.bonus + entry.metrics.bonusTotal,
    activeStaff: summary.activeStaff + (entry.metrics.recordCount > 0 ? 1 : 0),
    yieldSum: summary.yieldSum + entry.metrics.yieldPct,
  }), {
    earned: 0,
    paid: 0,
    overtime: 0,
    bonus: 0,
    activeStaff: 0,
    yieldSum: 0,
  });
  const payrollAverageYield = payrollInsights.length ? Math.round(payrollTotals.yieldSum / payrollInsights.length) : 0;

  // --- 💡 HELPERS ---
  const startAdding = () => {
    setSelectedRole('Sales Associate');
    setEditingStaff(null);
    setShowAdvancedAccess(false);
    setNewStaffPermissions(getRolePermissions('Sales Associate'));
    setIsAddingStaff(true);
  };

  const startEditing = (s: Staff) => {
    setSelectedRole(s.role);
    setShowAdvancedAccess(false);
    setEditingStaff({
      ...s,
      permissions: normalizePermissionMatrix(s.permissions, getRolePermissions(s.role)),
    });
  };

  const payoutSummary = payoutStaff ? calculateStaffSalary(payoutStaff, currentMonthRange) : null;
  const payoutReleasedAmount = payoutStaff
    ? expenses
      .filter((expense: any) =>
        (expense.category === 'Staff Salary' || expense.category === 'Advance Salary') &&
        expense.description?.includes(payoutStaff.name) &&
        isDateInRange(expense.date, currentMonthRange))
      .reduce((sum: number, expense: any) => sum + Number(expense.amount || 0), 0)
    : 0;

  // --- 🎨 RENDER ---
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 bg-background text-foreground min-h-[80vh]">
      
      {/* 🚀 HEADER & GLOBAL ACTIONS */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1 text-foreground">Human Resources</h1>
          <p className="text-muted-foreground font-semibold text-xs tracking-wider uppercase">Roster • Telemetry • Payroll</p>
        </div>
        <div className="flex items-center gap-3">
          {canViewPayroll && (
            <div className="bg-card border border-border px-5 py-3 rounded-2xl flex items-center gap-4 shadow-sm">
              <div className="h-10 w-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                 <DollarSign className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Est. Liability</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(totalPayroll)}</p>
              </div>
            </div>
          )}
          {canEditTeam && (
            <button onClick={startAdding} className="premium-gradient text-primary-foreground px-6 py-4 rounded-2xl font-bold text-[11px] uppercase tracking-widest flex items-center gap-2 shadow-md hover:shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all">
              <UserPlus className="h-4 w-4" /> Enlist Member
            </button>
          )}
        </div>
      </div>

      {/* 🧭 NAVIGATION TABS */}
      <div className="flex bg-card border border-border p-1.5 rounded-2xl w-fit shadow-sm">
        {[
          { id: 'roster', label: 'Roster Matrix', icon: Users, hideForStaff: !canEditTeam },
          { id: 'attendance', label: 'Telemetry Log', icon: Calendar },
          { id: 'payroll', label: canViewPayroll ? 'Payroll Center' : 'My Earnings', icon: CreditCard }
        ].filter((t: any) => !t.hideForStaff).map((t: any) => (
          <button
            key={t.id} onClick={() => setActiveSubTab(t.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-300",
              activeSubTab === t.id
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Staff Access Engine */}
      {canEditTeam && (
        <div className="bg-card p-6 rounded-[2rem] border border-border flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm">
              <Ticket className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Staff Access Engine</h3>
              <div className="flex items-center gap-3">
                <p className="text-2xl font-bold tracking-tighter text-foreground">
                  {generatingInvite ? (
                    <span className="flex items-center gap-2 text-primary animate-pulse">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Generating...
                    </span>
                  ) : (
                    invitations[0]?.code || 'No Active Code'
                  )}
                </p>
                {invitations[0] && !generatingInvite && (
                  <span className="bg-emerald-500/10 text-emerald-500 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border border-emerald-500/20 shadow-sm">Active Hub</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={async () => {
                if (!storeShopId) return;
                setGeneratingInvite(true);
                try {
                  const deletePromises = invitations.map((inv: any) => 
                    deleteDoc(doc(db, `shops/${storeShopId}/invitations`, inv.id))
                  );
                  await Promise.all(deletePromises);

                  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
                  await setDoc(doc(db, `shops/${storeShopId}/invitations`, code), {
                    code,
                    createdAt: new Date().toISOString()
                  });
                  await updateDoc(doc(db, 'shops', storeShopId), { inviteCode: code });
                  showToast('New Code Active & Old Codes Purged');
                } catch (e) {
                  console.error(e);
                } finally {
                  setGeneratingInvite(false);
                }
              }}
              disabled={generatingInvite}
              className="bg-primary text-primary-foreground px-4 py-3 rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
            >
              <PlusCircle className="h-4 w-4 group-hover:rotate-90 transition-transform" /> Generate New
            </button>

            {invitations[0] && (
              <button
                onClick={() => shareInviteWhatsApp(invitations[0].code, shop?.name || 'Our Shop')}
                className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-4 py-3 rounded-xl hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
              >
                <Share2 className="h-4 w-4" /> Share WhatsApp
              </button>
            )}
            
            <button
              onClick={() => {
                if(invitations[0]) {
                  navigator.clipboard.writeText(invitations[0].code);
                  showToast('Code Copied');
                }
              }}
              className="bg-accent text-foreground px-4 py-3 rounded-xl hover:bg-border transition-all text-[10px] font-bold uppercase tracking-widest"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Find by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-card border border-border rounded-xl pl-12 pr-4 py-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm text-foreground"
          />
        </div>
        <button className="flex items-center gap-2 px-6 bg-card border border-border rounded-xl text-xs font-bold hover:bg-accent transition-all text-foreground">
          <Filter className="h-4 w-4" />
          More Filters
        </button>
      </div>


      {activeSubTab === 'roster' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {filteredStaff.length === 0 ? (
            <div className="col-span-full py-24 text-center bg-card border border-border rounded-3xl shadow-sm">
              <Users className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground font-semibold tracking-widest uppercase text-sm">Zero bio-signatures detected.</p>
            </div>
          ) : (
            filteredStaff.map((s: Staff) => (
              <div key={s.id} onClick={() => canEditTeam && startEditing(s)} className={cn("bg-card rounded-3xl p-6 border border-border shadow-sm transition-all group relative overflow-hidden", canEditTeam ? "hover:border-primary/40 cursor-pointer hover:shadow-md hover:-translate-y-1" : "cursor-default")}>
                <div className="flex items-center gap-5 mb-6">
                  <div className="h-14 w-14 rounded-2xl bg-accent border border-border flex items-center justify-center text-foreground text-xl font-bold shadow-sm">
                    {s.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold tracking-tight text-foreground">{s.name}</h3>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">{s.role}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", s.status === 'active' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" : "bg-muted-foreground")} />
                      <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">{s.status}</span>
                    </div>
                  </div>
                </div>
                {/* Contact Info */}
                <div className="bg-background p-4 rounded-2xl border border-border">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Comm Link</p>
                  <p className="text-sm font-semibold text-foreground truncate mt-0.5">{s.phone}</p>
                  {canViewPayroll && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Base Retainer</p>
                      <p className="text-sm font-bold text-primary">{formatCurrency(staffPrivate.find((p: any) => p.id === s.id)?.salary || 0)}</p>
                    </div>
                  )}
                </div>
                <div className="mt-6 flex items-center justify-between text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">
                  <span>Joined {new Date(s.joinedAt).toLocaleDateString()}</span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        sendWhatsAppInvite({
                          phone: s.phone,
                          staffName: s.name,
                          inviteCode: invitations[0]?.code || 'HUBPRO',
                          shopName: shop?.name || 'Our Shop'
                        });
                      }}
                      className="text-primary hover:text-primary/70 transition-colors"
                    >
                      WhatsApp
                    </button>
                    {canEditTeam && currentStaff?.id !== s.id && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setPinInput('');
                          setConfirmRemoveStaff(s);
                        }}
                        className="text-destructive/50 hover:text-destructive transition-colors ml-2"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeSubTab === 'attendance' && (
        <div className="glass-card rounded-[2.5rem] overflow-hidden border border-border/50 bg-card">
          <div className="px-8 py-6 border-b border-border/50 flex flex-wrap items-center justify-between gap-4 bg-accent/20">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-tighter">Attendance Log</h3>
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Records for {attendanceRange.label}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {canEditTeam && (
                <div className="flex items-center gap-2 bg-accent/40 px-3 py-2 rounded-xl border border-border/50">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Staff Access</p>
                  <button
                    onClick={() => updateShop({ ...shop, allowStaffAttendance: !shop?.allowStaffAttendance })}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all text-[9px] font-black uppercase tracking-widest",
                      shop?.allowStaffAttendance
                        ? "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                        : "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20"
                    )}
                  >
                    {shop?.allowStaffAttendance ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                    {shop?.allowStaffAttendance ? 'Enabled' : 'Locked'}
                  </button>
                </div>
              )}

              {canEditTeam && (
                <button
                  onClick={() => {
                    setManualEntryStaff(staff[0] || null);
                    setManualTimes({ 
                      date: attendanceRange.includesToday ? today : attendanceRange.end, 
                      clockIn: '09:00', 
                      clockOut: '18:00',
                      status: 'PRESENT',
                      overtime: 0,
                      bonus: 0
                    });
                  }}
                  className="h-10 px-4 bg-primary text-primary-foreground rounded-xl flex items-center gap-2 hover:bg-primary/90 transition-all text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95"
                >
                  <Clock9 className="h-4 w-4" />
                  Manual Log
                </button>
              )}

              {canEditTeam && (
                <button
                  onClick={() => window.print()}
                  className="h-10 w-10 bg-accent rounded-xl flex items-center justify-center hover:bg-accent/80 transition-all text-muted-foreground"
                >
                  <Download className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {ANALYTICS_RANGE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setAttendanceRangePreset(option.id)}
                  className={cn(
                    "px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all",
                    attendanceRangePreset === option.id
                      ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                      : "bg-background/70 text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* --- 📡 MODERN TELEMETRY: ATTENDANCE MAP --- */}
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
              <div className="rounded-[1.75rem] border border-border/50 bg-background p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Logged Staff</p>
                <p className="text-3xl font-black tracking-tight text-foreground">{attendanceTotals.loggedStaff}<span className="text-sm text-muted-foreground ml-1">/ {filteredStaff.length}</span></p>
                <p className="text-[10px] font-semibold text-muted-foreground mt-2">People with at least one record in this window.</p>
              </div>
              <div className="rounded-[1.75rem] border border-border/50 bg-background p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Attendance Yield</p>
                <p className="text-3xl font-black tracking-tight text-primary">{attendanceTotals.effectiveDays.toFixed(1)}d</p>
                <p className="text-[10px] font-semibold text-muted-foreground mt-2">Full and half-day equivalents inside the selected range.</p>
              </div>
              <div className="rounded-[1.75rem] border border-border/50 bg-background p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Tracked Hours</p>
                <p className="text-3xl font-black tracking-tight text-foreground">{attendanceTotals.trackedHours.toFixed(1)}h</p>
                <p className="text-[10px] font-semibold text-muted-foreground mt-2">{attendanceTotals.overtimeHours.toFixed(1)} overtime hours recorded.</p>
              </div>
              <div className="rounded-[1.75rem] border border-border/50 bg-background p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Bonus Ledger</p>
                <p className="text-3xl font-black tracking-tight text-amber-500">{formatCurrency(attendanceTotals.bonuses)}</p>
                <p className="text-[10px] font-semibold text-muted-foreground mt-2">Performance and manual bonuses in this period.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {attendanceInsights.map(({ staff: s, metrics }) => {
                const record = attendanceRangePreset === 'today'
                  ? attendance.find((a: Attendance) => a.staffId === s.id && a.date === today)
                  : metrics.latestRecord;
                const isTodayMode = attendanceRangePreset === 'today';
                const hasClockedIn = !!record?.clockIn;
                const hasClockedOut = !!record?.clockOut;

                return (
                  <div key={s.id} className={cn(
                    "bg-background rounded-[2rem] p-6 border border-border/50 hover:border-primary/30 transition-all group overflow-hidden relative shadow-sm",
                    metrics.recordCount === 0 && "opacity-80"
                  )}>
                    {/* Status Indicator */}
                    <div className={cn(
                      "absolute top-0 right-0 px-4 py-1 text-[8px] font-black uppercase tracking-widest rounded-bl-xl shadow-sm z-10",
                      isTodayMode && record?.status === 'PRESENT' ? "bg-emerald-500/10 text-emerald-500 border-l border-b border-emerald-500/20" :
                      isTodayMode && record?.status === 'HALF_DAY' ? "bg-amber-500/10 text-amber-500 border-l border-b border-amber-500/20" :
                      metrics.recordCount > 0 ? "bg-primary/10 text-primary border-l border-b border-primary/20" :
                      "bg-accent text-muted-foreground border-l border-b border-border"
                    )}>
                      {isTodayMode
                        ? (record?.status ? (record.status === 'PRESENT' ? 'Active Duty' : record.status.replace('_', ' ')) : 'Standby')
                        : (metrics.recordCount > 0 ? `${metrics.recordCount} Logs` : 'No Logs')}
                    </div>

                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center text-lg font-bold border border-border shadow-inner">
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-base font-bold tracking-tight text-foreground">{s.name}</h3>
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest leading-none mt-1">{s.role}</p>
                      <p className="text-[10px] text-muted-foreground mt-2">Latest pulse: {record?.date || 'No record in range'}</p>
                    </div>
                  </div>

                  {/* Telemetry Bits */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-accent/30 rounded-2xl p-3 border border-border/30">
                      <p className="text-[8px] font-black uppercase text-muted-foreground mb-1 tracking-widest">{isTodayMode ? 'Entry Pulse' : 'Last Clock In'}</p>
                      <div className="flex items-center gap-2">
                        <Clock className={cn("h-3.5 w-3.5", hasClockedIn ? "text-emerald-500" : "text-muted-foreground/30")} />
                        <span className="text-sm font-bold text-foreground">{record?.clockIn || '--:--'}</span>
                      </div>
                    </div>
                    <div className="bg-accent/30 rounded-2xl p-3 border border-border/30">
                      <p className="text-[8px] font-black uppercase text-muted-foreground mb-1 tracking-widest">{isTodayMode ? 'Exit Pulse' : 'Last Clock Out'}</p>
                      <div className="flex items-center gap-2">
                        <Clock3 className={cn("h-3.5 w-3.5", hasClockedOut ? "text-blue-500" : "text-muted-foreground/30")} />
                        <span className="text-sm font-bold text-foreground">{record?.clockOut || '--:--'}</span>
                      </div>
                    </div>
                    <div className="col-span-2 bg-accent/30 rounded-2xl p-3 border border-border/30 flex items-center justify-between">
                      <div>
                        <p className="text-[8px] font-black uppercase text-muted-foreground mb-1 tracking-widest">{isTodayMode ? 'Active Hours' : 'Range Totals'}</p>
                        <p className={cn("text-base font-bold", metrics.totalHours > 0 ? "text-primary" : "text-muted-foreground/50")}>
                          {metrics.totalHours > 0 ? `${metrics.totalHours}h Tracked` : '0.0h Tracked'}
                        </p>
                      </div>
                      {metrics.overtimeHours > 0 ? (
                        <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                          <p className="text-[8px] font-black text-amber-500">+{metrics.overtimeHours.toFixed(1)}h OT</p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/40 bg-accent/20 px-4 py-3 mb-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Period Breakdown</p>
                    <p className="text-sm font-bold text-foreground">
                      Present {metrics.fullDays} - Half {metrics.halfDays} - Leave {metrics.leaveDays} - Absent {metrics.absentDays}
                    </p>
                  </div>

                  {/* Operational Controls */}
                  <div className="flex items-center gap-2">
                    {!isTodayMode ? (
                      <>
                        <div className="flex-1 py-3 px-4 bg-accent/40 text-foreground rounded-xl text-[10px] font-bold uppercase tracking-widest border border-border/50">
                          {metrics.effectiveDays.toFixed(1)} attendance days - {metrics.yieldPct}% window yield
                        </div>
                        {canEditTeam && (
                          <button
                            onClick={() => {
                              setManualEntryStaff(s);
                              setManualTimes({
                                date: record?.date || attendanceRange.end,
                                clockIn: record?.clockIn || '09:00',
                                clockOut: record?.clockOut || '18:00',
                                status: record?.status || 'PRESENT',
                                overtime: record?.overtime || 0,
                                bonus: record?.bonus || 0
                              });
                            }}
                            className="px-4 py-3 bg-accent text-muted-foreground hover:bg-foreground hover:text-background rounded-xl transition-all border border-border"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                        )}
                      </>
                    ) : !record ? (
                      <>
                        <button
                          onClick={() => recordAttendance({
                            id: `${s.id}_${today}`,
                            staffId: s.id,
                            date: today,
                            clockIn: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
                            status: 'PRESENT'
                          })}
                          className="flex-1 py-3 bg-primary/10 text-primary hover:bg-primary hover:text-white border border-primary/20 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm active:scale-95"
                        >
                          Punch In
                        </button>
                        {canEditTeam && (
                          <button
                            onClick={() => { setManualEntryStaff(s); setManualTimes({ date: today, clockIn: '09:00', clockOut: '18:00', status: 'PRESENT', overtime: 0, bonus: 0 }); }}
                            className="px-4 py-3 bg-accent text-muted-foreground hover:bg-foreground hover:text-background rounded-xl transition-all active:scale-95 border border-border"
                          >
                            <Calendar className="h-4 w-4" />
                          </button>
                        )}
                      </>
                    ) : !record.clockOut ? (
                      <>
                        <button
                          onClick={() => recordAttendance({
                            ...record,
                            clockOut: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
                          })}
                          className="flex-1 py-3 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm active:scale-95"
                        >
                          Punch Out
                        </button>
                        <button
                          onClick={() => { setManualEntryStaff(s); setManualTimes({ date: today, clockIn: record.clockIn || '09:00', clockOut: '18:00', status: record.status || 'PRESENT', overtime: record.overtime || 0, bonus: record.bonus || 0 }); }}
                          className="px-4 py-3 bg-accent text-muted-foreground hover:bg-foreground hover:text-background rounded-xl transition-all active:scale-95 border border-border"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <div className="flex-1 flex gap-2">
                         {canEditTeam ? (
                          <div className="relative flex-1">
                            <select
                              value={record.status}
                              onChange={(e) => recordAttendance({ ...record, status: e.target.value as any })}
                              className="w-full bg-accent border border-border rounded-xl px-4 py-3 text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer pr-10"
                            >
                              <option value="PRESENT">FULL DAY</option>
                              <option value="HALF_DAY">HALF DAY</option>
                              <option value="ABSENT">ABSENT</option>
                              <option value="LEAVE">LEAVE</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                          </div>
                        ) : (
                          <div className="w-full py-3 bg-accent/50 text-muted-foreground rounded-xl text-center text-[10px] font-bold uppercase tracking-widest border border-border/50">
                            Closed Record
                          </div>
                        )}
                        <button
                          onClick={() => { setManualEntryStaff(s); setManualTimes({ date: today, clockIn: record.clockIn || '--:--', clockOut: record.clockOut || '--:--', status: record.status || 'PRESENT', overtime: record.overtime || 0, bonus: record.bonus || 0 }); }}
                          className="px-4 py-3 bg-accent text-muted-foreground hover:bg-foreground hover:text-background rounded-xl transition-all border border-border"
                        >
                          <Clock3 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      )}

      {activeSubTab === 'payroll' && (
        <div className="space-y-6">
          {canViewPayroll && (
            <div className="p-8 glass-card rounded-[3rem] border border-primary/20 bg-primary/5 flex flex-col md:flex-row items-center gap-8">
              <div className="h-20 w-20 rounded-[2rem] premium-gradient flex items-center justify-center text-primary-foreground shadow-2xl shadow-primary/40">
                <DollarSign className="h-10 w-10 text-primary-foreground" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl font-black tracking-tight mb-1">Payroll Intelligence Hub</h2>
                <p className="text-sm font-medium text-muted-foreground">Admin review window: <span className="text-primary font-black">{payrollRange.label}</span> based on live attendance.</p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => showToast(currentMonthPayoutMode
                    ? 'Use the verified per-staff settlement cards below for controlled payroll release.'
                    : 'Historical windows are review-only. Switch to This Month to finalize payouts.')}
                  className={cn(
                    "px-8 py-4 font-black text-xs uppercase tracking-widest rounded-2xl transition-all",
                    currentMonthPayoutMode
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:scale-105 active:scale-95"
                      : "bg-accent text-muted-foreground border border-border"
                  )}
                >
                  {currentMonthPayoutMode ? 'Per-Staff Verified Release' : 'Historical Review Mode'}
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {ANALYTICS_RANGE_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => setPayrollRangePreset(option.id)}
                className={cn(
                  "px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all",
                  payrollRangePreset === option.id
                    ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                    : "bg-background/70 text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-[1.75rem] border border-border/50 bg-card p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Gross Liability</p>
              <p className="text-3xl font-black tracking-tight text-foreground">{formatCurrency(payrollTotals.earned)}</p>
              <p className="text-[10px] font-semibold text-muted-foreground mt-2">Computed from attendance, overtime, and bonuses.</p>
            </div>
            <div className="rounded-[1.75rem] border border-border/50 bg-card p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Released Amount</p>
              <p className="text-3xl font-black tracking-tight text-primary">{formatCurrency(payrollTotals.paid)}</p>
              <p className="text-[10px] font-semibold text-muted-foreground mt-2">{formatCurrency(Math.max(payrollTotals.earned - payrollTotals.paid, 0))} still outstanding.</p>
            </div>
            <div className="rounded-[1.75rem] border border-border/50 bg-card p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">OT + Bonus</p>
              <p className="text-3xl font-black tracking-tight text-amber-500">{formatCurrency(payrollTotals.overtime + payrollTotals.bonus)}</p>
              <p className="text-[10px] font-semibold text-muted-foreground mt-2">{payrollTotals.activeStaff} staff active in this range.</p>
            </div>
            <div className="rounded-[1.75rem] border border-border/50 bg-card p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Average Yield</p>
              <p className="text-3xl font-black tracking-tight text-primary">{payrollAverageYield}%</p>
              <p className="text-[10px] font-semibold text-muted-foreground mt-2">Attendance efficiency across selected staff.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {payrollInsights.map(({ staff: s, metrics: payroll, paidAmount }) => {
              const isPaid = payroll.earned > 0 && paidAmount >= payroll.earned;
              return (
                <div key={s.id} className={cn(
                  "glass-card rounded-[2.5rem] p-8 border border-border/50 hover:border-primary/40 transition-all flex flex-col relative overflow-hidden group",
                  isPaid && "bg-primary/5"
                )}>
                  {isPaid && (
                    <div className="absolute top-0 right-0 px-6 py-2 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest rounded-bl-3xl shadow-lg flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3" /> Settlements Closed
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-5">
                      <div className="h-16 w-16 rounded-[1.5rem] bg-accent border border-border flex items-center justify-center text-2xl font-bold shadow-inner">
                        {s.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold tracking-tight text-foreground">{s.name}</h3>
                        {canViewPayroll && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-bold text-primary">{formatCurrency(payroll.baseSalary)}</span>
                            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Base Retention</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black text-foreground tracking-tighter">{formatCurrency(payroll.earned)}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1 italic">Net Liability</p>
                    </div>
                  </div>

                  {/* Components Breakdown */}
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                    <div className="p-4 rounded-3xl bg-accent/40 border border-border/30 text-center">
                      <p className="text-[9px] font-black uppercase text-muted-foreground mb-2 tracking-widest">Attendance</p>
                      <p className="text-xl font-black text-foreground">{payroll.effectiveDays}<span className="text-[10px] ml-0.5">d</span></p>
                    </div>
                    <div className="p-4 rounded-3xl bg-accent/40 border border-border/30 text-center">
                      <p className="text-[9px] font-black uppercase text-muted-foreground mb-2 tracking-widest">OT Bonus</p>
                      <p className="text-xl font-black text-amber-500">+{payroll.overtimePay > 0 ? formatCurrency(payroll.overtimePay) : '0'}</p>
                    </div>
                    <div className="p-4 rounded-3xl bg-accent/40 border border-border/30 text-center">
                      <p className="text-[9px] font-black uppercase text-muted-foreground mb-2 tracking-widest">Tracked Hours</p>
                      <p className="text-xl font-black text-foreground">{payroll.totalHours.toFixed(1)}h</p>
                    </div>
                    <div className="p-4 rounded-3xl bg-primary/10 border border-primary/20 text-center group-hover:scale-105 transition-transform duration-300">
                      <p className="text-[9px] font-black uppercase text-primary mb-2 tracking-widest">Yield %</p>
                      <p className="text-xl font-black text-primary">{payroll.yieldPct}%</p>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-border/40 bg-accent/20 px-5 py-4 mb-6">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Staff Detail</p>
                    <p className="text-sm font-bold text-foreground">
                      Present {payroll.fullDays} - Half {payroll.halfDays} - Leave {payroll.leaveDays} - Absent {payroll.absentDays}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-2">Released in this window: {formatCurrency(paidAmount)}</p>
                  </div>

                  {canViewPayroll && (
                    currentMonthPayoutMode ? (
                      <button
                        onClick={() => {
                          setPayoutStaff(s);
                          setIsAdvanceMode(false);
                          setPayoutMethod('CASH');
                          setPayoutReference('');
                          setCustomAmount(String(Math.max(payroll.earned - paidAmount, 0)));
                        }}
                        className={cn(
                          "w-full py-5 rounded-[1.5rem] border font-bold text-xs uppercase tracking-[0.2em] transition-all shadow-md active:scale-95 flex items-center justify-center gap-3",
                          isPaid
                            ? "bg-accent/50 border-border/50 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            : "premium-gradient text-primary-foreground border-transparent shadow-primary/20 hover:shadow-primary/30"
                        )}
                      >
                        <CreditCard className="h-4 w-4" />
                        {isPaid ? 'Add Custom Payout' : (paidAmount > 0 ? 'Release Remaining' : 'Finalize Settlement')}
                      </button>
                    ) : (
                      <div className="w-full py-5 rounded-[1.5rem] border border-border/50 bg-accent/30 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                        Historical window - review only
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- 🛡️ THE UPGRADED ADD / EDIT STAFF MODAL --- */}
      {(isAddingStaff || editingStaff) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12 overflow-y-auto no-scrollbar">
          {/* Frosted Glass Overlay - Lighter for "Popup" feel */}
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => { setIsAddingStaff(false); setEditingStaff(null); }} />
          
          {/* Premium Floating Popup Container */}
          <div className="relative z-10 w-full max-w-xl bg-card border border-white/10 rounded-[3rem] p-4 sm:p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4 text-foreground">
                <div className="h-12 w-12 bg-accent rounded-xl flex items-center justify-center text-foreground border border-border shadow-sm">
                  {editingStaff ? <Edit3 className="h-6 w-6" /> : <UserPlus className="h-6 w-6" />}
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">{editingStaff ? 'Modify Protocol' : 'Enlist Operative'}</h2>
                  <p className="text-xs text-muted-foreground font-medium mt-1">Configure identity and system access.</p>
                </div>
              </div>
              <button onClick={() => { setIsAddingStaff(false); setEditingStaff(null); }} className="h-10 w-10 rounded-full hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form className="space-y-8" onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const phone = fd.get('phone') as string;
              if (!editingStaff && staff.some(s => s.phone === phone)) return showToast("Comm Link already established!");
              
              const salaryValue = Number(fd.get('salary'));
              const roleValue = fd.get('role') as string;
              const finalPermissions = normalizePermissionMatrix(
                editingStaff ? editingStaff.permissions : newStaffPermissions,
                getRolePermissions(roleValue),
              );
              
              await upsertStaff({
                id: editingStaff ? editingStaff.id : `staff-${Date.now()}`,
                name: fd.get('name') as string, 
                phone, 
                email: fd.get('email') as string,
                role: roleValue,
                joinedAt: editingStaff ? editingStaff.joinedAt : new Date().toISOString(),
                status: 'active', 
                salary: salaryValue,
                permissions: finalPermissions
              } as any);
              
              showToast(editingStaff ? 'Protocol Updated' : 'Operative Enlisted');
              setIsAddingStaff(false); setEditingStaff(null); setNewStaffPermissions({});
            }}>
              
              {/* Form Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground ml-1">Legal Designation</label>
                  <input name="name" defaultValue={editingStaff?.name} required className="w-full bg-background border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl px-4 py-3.5 font-medium text-sm outline-none transition-all text-foreground" placeholder="Full Name" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground ml-1">Comm Link (Phone)</label>
                  <input name="phone" defaultValue={editingStaff ? (editingStaff.phone.startsWith('+') ? editingStaff.phone : `+91${editingStaff.phone}`) : '+91'} required className="w-full bg-background border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl px-4 py-3.5 font-medium text-sm outline-none transition-all text-foreground" placeholder="+91 0000000000" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground ml-1">Base Retainer ({shop.currency || '₹'})</label>
                  <input name="salary" type="number" defaultValue={editingStaff ? staffPrivate.find(p => p.id === editingStaff.id)?.salary : ''} required className="w-full bg-background border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl px-4 py-3.5 font-medium text-sm outline-none transition-all text-foreground" placeholder="Monthly Salary" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground ml-1">Role Classification</label>
                  <div className="relative">
                    <select 
                      name="role" 
                      defaultValue={editingStaff?.role || 'Sales Associate'} 
                      required 
                      onChange={(e) => {
                        const role = e.target.value;
                        setSelectedRole(role);
                        const roleDefaults = getRolePermissions(role);
                        if (editingStaff) {
                          setEditingStaff({ ...editingStaff, role, permissions: roleDefaults });
                        } else {
                          setNewStaffPermissions(roleDefaults);
                        }
                      }}
                      className="w-full bg-background border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl px-4 py-3.5 font-medium text-sm outline-none transition-all text-foreground appearance-none cursor-pointer"
                    >
                      <option>Sales Associate</option>
                      <option>Store Manager</option>
                      <option>Delivery Partner</option>
                      <option>Inventory Incharge</option>
                      <option>General Staff</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                  {!editingStaff && (
                    <div className="mt-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-tighter text-emerald-500 animate-pulse">
                      <CheckCircle2 className="h-3 w-3" /> Standard {selectedRole} Clearance Applied
                    </div>
                  )}
                </div>
              </div>

              {/* Collapsible Permission Matrix */}
              <div className="mt-8">
                <button
                  type="button"
                  onClick={() => setShowAdvancedAccess(!showAdvancedAccess)}
                  className="w-full flex items-center justify-between p-4 bg-accent/30 hover:bg-accent/50 border border-border/50 rounded-2xl transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-sm font-bold tracking-tight text-foreground">Advanced Access Protocols</h3>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-0.5">Manual Clearance Overrides</p>
                    </div>
                  </div>
                  <div className={cn("text-muted-foreground transition-transform duration-300", showAdvancedAccess ? "rotate-180" : "")}>
                    <ChevronDown className="h-5 w-5" />
                  </div>
                </button>

                {showAdvancedAccess && (
                  <div className="mt-6 p-6 bg-accent/20 rounded-3xl border border-border/50 animate-in slide-in-from-top-4 duration-300">
                    <p className="text-xs font-medium text-muted-foreground mb-6">Modify modular system clearances specifically for this operative.</p>
                    <PermissionTable 
                      permissions={editingStaff ? (editingStaff.permissions || {}) : newStaffPermissions} 
                      onChange={p => editingStaff ? setEditingStaff({ ...editingStaff, permissions: p }) : setNewStaffPermissions(p)} 
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-6 flex gap-4 border-t border-border">
                <button type="button" onClick={() => { setIsAddingStaff(false); setEditingStaff(null); }} className="flex-1 py-4 bg-accent hover:bg-border rounded-xl font-bold text-xs uppercase tracking-wider transition-colors text-foreground border border-border">Abort</button>
                <button type="submit" className="flex-1 premium-gradient text-primary-foreground py-4 rounded-xl font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98] transition-all">Commit Protocol</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- 🛠️ MANUAL TELEMETRY OVERRIDE --- */}
      {manualEntryStaff && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 sm:p-12 overflow-y-auto no-scrollbar">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setManualEntryStaff(null)} />
          <div className="relative z-10 w-full max-w-lg bg-card border border-white/10 rounded-[3rem] p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] animate-in zoom-in slide-in-from-bottom-8 duration-300">
            
            <div className="flex items-center gap-4 mb-8">
              <div className="h-14 w-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20 shadow-sm">
                <Clock9 className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Override Telemetry</h2>
                <p className="text-xs text-muted-foreground font-medium mt-1">Manual pulse injection for {manualEntryStaff.name}.</p>
              </div>
            </div>

            <form className="space-y-6" onSubmit={async (e) => {
              e.preventDefault();
              if (!manualEntryStaff) return;
              await recordAttendance({
                id: `${manualEntryStaff.id}_${manualTimes.date}`,
                staffId: manualEntryStaff.id,
                date: manualTimes.date,
                clockIn: manualTimes.clockIn,
                clockOut: manualTimes.clockOut,
                status: manualTimes.status,
                overtime: Number(manualTimes.overtime),
                bonus: Number(manualTimes.bonus)
              });
              setManualEntryStaff(null);
              showToast("Pulse Record Injected Successfully");
            }}>
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Event Horizon (Date)</label>
                    <input
                      type="date"
                      value={manualTimes.date}
                      onChange={(e) => setManualTimes({ ...manualTimes, date: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3.5 font-medium text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Duty Status</label>
                    <select
                      value={manualTimes.status}
                      onChange={(e) => setManualTimes({ ...manualTimes, status: e.target.value as any })}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3.5 font-medium text-sm outline-none focus:border-primary appearance-none cursor-pointer text-foreground"
                    >
                      <option value="PRESENT">Full Day Operation</option>
                      <option value="HALF_DAY">Partial (Half Day)</option>
                      <option value="ABSENT">Absence Record</option>
                      <option value="LEAVE">Approved Leave</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Entry Timestamp</label>
                    <input
                      type="time"
                      value={manualTimes.clockIn}
                      onChange={(e) => setManualTimes({ ...manualTimes, clockIn: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3.5 font-medium text-sm outline-none focus:border-primary text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Exit Timestamp</label>
                    <input
                      type="time"
                      value={manualTimes.clockOut}
                      onChange={(e) => setManualTimes({ ...manualTimes, clockOut: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3.5 font-medium text-sm outline-none focus:border-primary text-foreground"
                    />
                  </div>
                </div>

                {canViewPayroll && (
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Overtime Bonus (Hrs)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={manualTimes.overtime}
                        onChange={(e) => setManualTimes({ ...manualTimes, overtime: Number(e.target.value) })}
                        className="w-full bg-background border border-border rounded-xl px-4 py-3.5 font-medium text-sm outline-none focus:border-primary text-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Special Grant ({shop?.currency || '₹'})</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0.00"
                        value={manualTimes.bonus}
                        onChange={(e) => setManualTimes({ ...manualTimes, bonus: Number(e.target.value) })}
                        className="w-full bg-background border border-border rounded-xl px-4 py-3.5 font-medium text-sm outline-none focus:border-primary text-foreground"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-border flex gap-4">
                <button type="button" onClick={() => setManualEntryStaff(null)} className="flex-1 py-4 bg-accent hover:bg-border text-foreground rounded-2xl font-bold text-xs uppercase tracking-widest transition-all">Abort</button>
                <button type="submit" className="flex-2 premium-gradient text-primary-foreground py-4 px-8 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95">Commit Pulse</button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* ── DIALOG: Confirm Removal ── */}
      {confirmRemoveStaff && (
        <ConfirmDialog
          open={!!confirmRemoveStaff}
          onClose={() => { setConfirmRemoveStaff(null); setPinInput(''); }}
          onConfirm={async () => {
            if (!storeShopId) {
              showToast('Workspace unavailable.', true);
              return;
            }

            try {
              await verifyAdminPin(pinInput, storeShopId);
              setConfirmRemoveStaff(null);
              setEditingStaff(null);
              await deleteStaff(confirmRemoveStaff.id);
              showToast(`${confirmRemoveStaff.name} removed permanently.`);
              setPinInput('');
            } catch (error: any) {
              showToast(error?.message || 'Unable to remove this staff member right now.', true);
            }
          }}
          title="Verify Admin Authority"
          description={`To permanently remove ${confirmRemoveStaff.name}, please enter your master security PIN.`}
          confirmText="Yes, Remove Staff"
          variant="danger"
          inputValue={pinInput}
          onInputChange={setPinInput}
          inputPlaceholder="Enter Admin PIN..."
          inputType="password"
          icon={<ShieldCheck className="h-8 w-8 text-destructive" />}
        />
      )}
      {/* --- 💸 PREMIUM SETTLEMENT HUB --- */}
      {payoutStaff && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 sm:p-12 overflow-y-auto no-scrollbar">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => { setPayoutStaff(null); setPayoutReference(''); setPayoutMethod('CASH'); }} />
          <div className="relative z-10 w-full max-w-xl bg-card border border-white/10 rounded-[2.25rem] sm:rounded-[3rem] p-5 sm:p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] animate-in zoom-in slide-in-from-bottom-8 duration-300">
            
            <div className="flex items-center gap-4 mb-8">
              <div className="h-16 w-16 rounded-2xl premium-gradient flex items-center justify-center text-primary-foreground shadow-xl shadow-primary/20 shrink-0">
                <CreditCard className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-2xl font-bold tracking-tight text-foreground">{payoutStaff.name}</h3>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.2em] mt-1">
                  Settlement Cycle: {currentMonthRange.label}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-[1.5rem] border border-border/50 bg-accent/30 p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Computed</p>
                  <p className="text-2xl font-black text-foreground">{formatCurrency(payoutSummary?.earned || 0)}</p>
                </div>
                <div className="rounded-[1.5rem] border border-border/50 bg-accent/30 p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Released</p>
                  <p className="text-2xl font-black text-primary">{formatCurrency(payoutReleasedAmount)}</p>
                </div>
                <div className="rounded-[1.5rem] border border-border/50 bg-accent/30 p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Pending</p>
                  <p className="text-2xl font-black text-amber-500">{formatCurrency(Math.max((payoutSummary?.earned || 0) - payoutReleasedAmount, 0))}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => {
                    setIsAdvanceMode(false);
                    const payroll = calculateStaffSalary(payoutStaff, currentMonthRange);
                    setCustomAmount(String(payroll.earned));
                  }}
                  className={cn(
                    "p-4 rounded-[1.5rem] border transition-all text-left group",
                    !isAdvanceMode ? "bg-primary border-primary text-white shadow-lg" : "bg-accent/50 border-border/50 text-muted-foreground hover:bg-accent"
                  )}
                >
                  <p className={cn("text-[8px] font-black uppercase tracking-widest mb-1", !isAdvanceMode ? "text-white/80" : "text-muted-foreground")}>Protocol A</p>
                  <p className="text-xs font-bold">Attendance Yield</p>
                </button>
                <button 
                  onClick={() => {
                    setIsAdvanceMode(true);
                    setCustomAmount('');
                  }}
                  className={cn(
                    "p-4 rounded-[1.5rem] border transition-all text-left group",
                    isAdvanceMode ? "bg-amber-500 border-amber-500 text-white shadow-lg" : "bg-accent/50 border-border/50 text-muted-foreground hover:bg-accent"
                  )}
                >
                  <p className={cn("text-[8px] font-black uppercase tracking-widest mb-1", isAdvanceMode ? "text-white/80" : "text-muted-foreground")}>Protocol B</p>
                  <p className="text-xs font-bold">Custom Advance</p>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-5 rounded-[1.75rem] bg-accent/30 border border-border/50">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1 block mb-3">Disbursement Mode</label>
                  <div className="relative">
                    <select
                      value={payoutMethod}
                      onChange={(e) => setPayoutMethod(e.target.value as (typeof PAYOUT_METHOD_OPTIONS)[number]['id'])}
                      className="w-full h-14 bg-background border border-border rounded-2xl px-4 pr-10 text-sm font-bold uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary text-foreground appearance-none"
                    >
                      {PAYOUT_METHOD_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                <div className="p-5 rounded-[1.75rem] bg-accent/30 border border-border/50">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1 block mb-3">
                    {payoutMethod === 'UPI' ? 'UPI Ref' : payoutMethod === 'BANK' ? 'Bank Ref' : payoutMethod === 'CARD' ? 'Card Ref' : 'Reference'}
                  </label>
                  <input
                    type="text"
                    value={payoutReference}
                    onChange={(e) => setPayoutReference(e.target.value)}
                    placeholder={payoutMethod === 'CASH' ? 'Optional note' : 'Transaction / reference id'}
                    className="w-full h-14 bg-background border border-border rounded-2xl px-4 text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary text-foreground"
                  />
                </div>
              </div>

              <div className="p-6 rounded-[2rem] bg-accent/30 border border-border/50">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Distribution Value</label>
                  {isAdvanceMode && <span className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500 text-white text-[8px] font-bold rounded-full animate-pulse uppercase tracking-wider">Manual</span>}
                </div>
                <div className="relative">
                  <span className={cn("absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black", !isAdvanceMode ? "text-primary" : "text-amber-500")}>₹</span>
                  <input 
                    type="number"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    readOnly={!isAdvanceMode}
                    placeholder="0.00"
                    className="w-full h-20 bg-background border border-border rounded-2xl pl-12 pr-6 text-3xl font-black focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-foreground"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={async () => {
                    setPayoutLoading(true);
                    const amount = Number(customAmount);
                    if (amount > 0) {
                      await addExpense({
                        id: `S-SAL-${Date.now()}`,
                        category: isAdvanceMode ? 'Advance Salary' : 'Staff Salary',
                        amount,
                        description: `${isAdvanceMode ? 'Advance' : 'Monthly Salary'} for ${payoutStaff.name} (${currentMonth})${payoutReference ? ` [${payoutReference}]` : ''}`,
                        paymentMethod: payoutMethod,
                        paymentReference: payoutReference || undefined,
                        date: today,
                        createdAt: new Date().toISOString()
                      });
                      showToast(`${isAdvanceMode ? 'Advance' : 'Salary'} distribution recorded!`);
                      setPayoutReference('');
                      setPayoutMethod('CASH');
                      setPayoutStaff(null);
                    } else {
                      showToast('Please enter a valid amount', true);
                    }
                    setPayoutLoading(false);
                  }}
                  disabled={payoutLoading || !customAmount || Number(customAmount) <= 0}
                  className="w-full py-5 premium-gradient text-white rounded-[1.5rem] font-bold text-xs uppercase tracking-[0.2em] shadow-xl hover:shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all disabled:grayscale disabled:opacity-50"
                >
                  {payoutLoading ? 'Executing Protocol...' : 'Finalize Settlement'}
                </button>
                <button 
                  onClick={() => { setPayoutStaff(null); setPayoutReference(''); setPayoutMethod('CASH'); }}
                  className="w-full py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all"
                >
                  Terminate Distribution
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

