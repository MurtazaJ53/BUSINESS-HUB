import React, { useState } from 'react';
import { 
  Users, 
  Clock, 
  CreditCard, 
  Calendar, 
  Search, 
  ChevronRight, 
  Clock3,
  UserPlus,
  Filter,
  DollarSign,
  Download,
  Clock9,
  Lock,
  Unlock,
  Send,
  Mail,
  Trash2,
  AlertCircle,
  MessageCircle,
  Edit3,
  ShieldCheck,
  Ticket,
  PlusCircle,
  Share2,
  LayoutDashboard,
  Package,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  ShieldAlert,
  Check,
  X
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useSqlQuery } from '@/db/hooks';
import { useBusinessStore } from '@/lib/useBusinessStore';
import { formatCurrency, cn } from '@/lib/utils';
import { Staff, Action, Module, PermissionMatrix, Attendance } from '@/lib/types';
import { sendStaffInvite } from '@/lib/mail';
import { sendWhatsAppInvite, shareInviteWhatsApp } from '@/lib/whatsapp';
import { showToast } from '@/lib/toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { usePermission } from '@/hooks/usePermission';

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
    { id: 'view', label: 'View' },
    { id: 'create', label: 'Add' },
    { id: 'edit', label: 'Edit' },
    { id: 'delete', label: 'Delete' },
    { id: 'void_sale', label: 'Void' },
    { id: 'override_price', label: 'Price' },
    { id: 'export', label: 'Export' },
    { id: 'view_cost', label: 'Cost' },
    { id: 'view_profit', label: 'Profit' },
    { id: 'approve_credit', label: 'Credit' }
  ];

  const handleToggle = (modId: Module, actId: Action) => {
    const next = { ...permissions };
    const mod = { ...(next[modId] || {}) };
    
    if (mod[actId]) {
      delete mod[actId];
    } else {
      if (actId === 'override_price') {
        mod[actId] = { max: 1000 };
      } else {
        mod[actId] = true;
      }
    }
    
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
    <div className="overflow-x-auto -mx-10 px-10">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border/50">
            <th className="py-4 px-2 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground w-32">Module</th>
            {columns.map(col => (
              <th key={col.id} className="py-4 px-2 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {APP_MODULES.map(mod => (
            <tr key={mod.id} className="border-b border-border/30 hover:bg-accent/5 transition-colors group">
              <td className="py-4 px-2">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-accent/50 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
                    <mod.icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[11px] font-bold text-foreground">{mod.label}</span>
                </div>
              </td>
              {columns.map(col => {
                const isSupported = mod.actions.includes(col.id);
                const modPerms = permissions[mod.id] || {};
                const val = modPerms[col.id];
                const isActive = !!val;
                
                return (
                  <td key={col.id} className="py-4 px-2">
                    <div className="flex flex-col items-center gap-1.5">
                      {isSupported ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggle(mod.id, col.id)}
                            className={cn(
                              "h-5 w-5 rounded-md border flex items-center justify-center transition-all",
                              isActive
                                ? "bg-primary border-primary text-white scale-110 shadow-lg shadow-primary/20"
                                : "bg-accent/30 border-border/50 text-muted-foreground hover:bg-accent hover:border-primary/30"
                            )}
                          >
                            {isActive && <Check className="h-3 w-3 stroke-[4px]" />}
                          </button>
                          
                          {col.id === 'override_price' && isActive && (
                            <div className="relative group/limit">
                              <input 
                                type="number"
                                value={typeof val === 'object' ? val.max : 1000}
                                onChange={(e) => handleLimitChange(mod.id, Number(e.target.value))}
                                className="w-16 bg-accent/50 border border-border/50 rounded-md px-1 py-0.5 text-[8px] font-black text-center focus:outline-none focus:border-primary transition-all pr-4"
                              />
                              <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[7px] font-bold text-muted-foreground">₹</span>
                              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[7px] px-1.5 py-0.5 rounded opacity-0 group-hover/limit:opacity-100 transition-opacity whitespace-nowrap border pointer-events-none">Limit ₹</div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="h-0.5 w-2 bg-muted-foreground/10 rounded-full" />
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function Team() {
  const { addExpense, upsertStaff, recordAttendance, role, shop, updateShop, deleteStaff, invitations, shopPrivate } = useBusinessStore();
  const staff = useSqlQuery<Staff>('SELECT * FROM staff WHERE tombstone = 0 ORDER BY name ASC', [], ['staff']);
  const staffPrivate = useSqlQuery<any>('SELECT * FROM staff_private WHERE tombstone = 0', [], ['staff_private']);
  const attendance = useSqlQuery<Attendance>('SELECT * FROM attendance WHERE tombstone = 0', [], ['attendance']);
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'roster' | 'attendance' | 'payroll'>('roster');
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [newStaffPermissions, setNewStaffPermissions] = useState<PermissionMatrix>({});
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [confirmRemoveStaff, setConfirmRemoveStaff] = useState<Staff | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [manualEntryStaff, setManualEntryStaff] = useState<Staff | null>(null);
  const [manualTimes, setManualTimes] = useState<{
    date: string;
    clockIn: string;
    clockOut: string;
    status: Attendance['status'];
    overtime: number;
    bonus: number;
  }>({ 
    date: today, 
    clockIn: '09:00', 
    clockOut: '18:00', 
    status: 'PRESENT',
    overtime: 0,
    bonus: 0
  });
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const shopId = shop?.phone; // Consistent with other pages using shopId as primary key or phone identifier if needed, I should check how shopId is handled in useBusinessStore. Actually useBusinessStore has it.
  const { shopId: storeShopId, currentStaff, expenses } = useBusinessStore(); 
  
  // --- New Modal State ---
  const [payoutStaff, setPayoutStaff] = useState<Staff | null>(null);
  const [isAdvanceMode, setIsAdvanceMode] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);

  // --- Payroll Calculation ---
  const calculateStaffSalary = (staffMember: Staff, monthStr: string) => {
    const monthAtt = attendance.filter((a: Attendance) => a.staffId === staffMember.id && a.date.startsWith(monthStr));
    const fullDays = monthAtt.filter((a: Attendance) => a.status === 'PRESENT').length;
    const halfDays = monthAtt.filter((a: Attendance) => a.status === 'HALF_DAY').length;
    const effectiveDays = fullDays + (halfDays * 0.5);
    
    // Financial components
    const privateData = staffPrivate.find((p: any) => p.id === staffMember.id);
    const salary = privateData?.salary || 0;
    
    const dailyRate = salary / 30;
    const hourlyRate = dailyRate / (shop?.standardWorkingHours || 9);
    
    const baseEarned = effectiveDays * dailyRate;
    const overtimePay = monthAtt.reduce((sum: number, a: Attendance) => sum + ((a.overtime || 0) * hourlyRate), 0);
    const totalBonus = monthAtt.reduce((sum: number, a: Attendance) => sum + (a.bonus || 0), 0);
    
    const finalEarned = baseEarned + overtimePay + totalBonus;

    return { 
      earned: Math.round(finalEarned), 
      days: effectiveDays, 
      present: fullDays, 
      half: halfDays,
      overtimeHrs: monthAtt.reduce((sum: number, a: Attendance) => sum + (a.overtime || 0), 0),
      overtimePay: Math.round(overtimePay),
      bonusTotal: Math.round(totalBonus),
      baseSalary: salary
    };
  };

  const canViewPayroll = usePermission('team', 'view_cost');
  const canEditTeam = usePermission('team', 'edit');

  const filteredStaff = staff.filter((s: Staff) => {
    // If not admin and doesn't have edit perms, can only see self
    if (!canEditTeam && currentStaff) {
      return s.id === currentStaff.id;
    }
    return (
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.phone.includes(searchTerm)
    );
  });

  const totalPayroll = staff.reduce((sum: number, s: Staff) => sum + calculateStaffSalary(s, currentMonth).earned, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight mb-2">Team Management</h1>
          <p className="text-muted-foreground font-medium">Coordinate staff, track presence, and automate payroll.</p>
        </div>
        <div className="flex items-center gap-3">
          {canViewPayroll && (
            <div className="bg-primary/10 border border-primary/20 px-4 py-3 rounded-2xl flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-primary" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-primary/70">Est. Payroll</p>
                <p className="text-lg font-black">{formatCurrency(totalPayroll)}</p>
              </div>
            </div>
          )}
          {canEditTeam && (
            <button
              onClick={() => setIsAddingStaff(true)}
              className="premium-gradient text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
            >
              <UserPlus className="h-4 w-4" />
              Add Member
            </button>
          )}
        </div>
      </div>

      <div className="flex bg-accent/30 p-1.5 rounded-2xl w-fit">
        {[
          { id: 'roster', label: 'Staff Roster', icon: Users, hideForStaff: !canEditTeam },
          { id: 'attendance', label: 'Daily Log', icon: Calendar },
          { id: 'payroll', label: canViewPayroll ? 'Payroll Center' : 'My Earnings', icon: CreditCard }
        ].filter((t: any) => !t.hideForStaff).map((t: any) => (
          <button
            key={t.id}
            onClick={() => setActiveSubTab(t.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              activeSubTab === t.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {canEditTeam && (
        <div className="glass-card p-6 rounded-[2rem] border-primary/20 bg-primary/5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                <Ticket className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500">Staff Access Engine</h3>
                <div className="flex items-center gap-3">
                  <p className="text-2xl font-black tracking-tighter">
                    {invitations[0]?.code || 'No Active Code'}
                  </p>
                  {invitations[0] && (
                    <span className="bg-green-500/10 text-green-500 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">Active</span>
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
                className="bg-primary text-white p-3 rounded-xl hover:shadow-lg hover:shadow-primary/30 transition-all flex items-center gap-2 group"
              >
                <PlusCircle className="h-4 w-4 group-hover:rotate-90 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-widest">Generate New Code</span>
              </button>

              {invitations[0] && (
                <button
                  onClick={() => shareInviteWhatsApp(invitations[0].code, shop?.name || 'Our Shop')}
                  className="bg-green-500/10 text-green-500 border border-green-500/20 p-3 rounded-xl hover:bg-green-500 hover:text-white transition-all flex items-center gap-2"
                >
                  <Share2 className="h-4 w-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Share Hub</span>
                </button>
              )}
              
              <button
                onClick={() => {
                  if(invitations[0]) {
                    navigator.clipboard.writeText(invitations[0].code);
                    showToast('Code Copied');
                  }
                }}
                className="bg-zinc-500/10 text-zinc-500 p-3 rounded-xl hover:bg-zinc-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest"
              >
                Copy
              </button>
            </div>
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
            className="w-full bg-card border border-border/50 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
          />
        </div>
        <button className="flex items-center gap-2 px-6 bg-card border border-border/50 rounded-2xl text-xs font-bold hover:bg-accent transition-all">
          <Filter className="h-4 w-4" />
          More Filters
        </button>
      </div>

      {activeSubTab === 'roster' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStaff.length === 0 ? (
            <div className="col-span-full py-20 text-center glass-card rounded-[2.5rem]">
              <Users className="h-16 w-16 text-primary/10 mx-auto mb-4" />
              <p className="text-muted-foreground font-bold italic">No staff members found matching your search.</p>
            </div>
          ) : (
            filteredStaff.map((s: Staff) => (
              <div
                key={s.id}
                onClick={() => canEditTeam && setEditingStaff(s)}
                className={cn(
                  "glass-card rounded-[2.5rem] p-6 border border-border/50 transition-all group relative overflow-hidden",
                  canEditTeam ? "hover:border-primary/30 cursor-pointer" : "cursor-default"
                )}
              >
                <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight className="h-5 w-5 text-primary" />
                </div>
                <div className="flex items-start gap-4 mb-6">
                  <div className="h-14 w-14 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center text-primary text-xl font-black">
                    {s.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-base font-black tracking-tight">{s.name}</h3>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">{s.role}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={cn("h-1.5 w-1.5 rounded-full", s.status === 'active' ? "bg-green-500 animate-pulse" : "bg-zinc-500")} />
                      <span className="text-[10px] font-black tracking-widest text-zinc-500 uppercase">{s.status}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {canViewPayroll && (
                    <div className="bg-accent/20 p-3 rounded-2xl">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Monthly Salary</p>
                      <p className="text-sm font-black text-primary">
                        {formatCurrency(staffPrivate.find((p: any) => p.id === s.id)?.salary || 0)}
                      </p>
                    </div>
                  )}
                  <div className="bg-accent/20 p-3 rounded-2xl">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Contact</p>
                    <p className="text-xs font-bold truncate">{s.phone}</p>
                  </div>
                </div>
                 <div className="pt-4 border-t border-border/20 flex flex-col gap-4">
                   <div className="flex items-center gap-2">
                     <Calendar className="h-3 w-3 text-muted-foreground" />
                     <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest leading-none">Joined {new Date(s.joinedAt).toLocaleDateString()}</span>
                   </div>
                   
                   <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                     {s.email && (
                       <button 
                         onClick={() => showToast('Email Automation: Coming Soon (Requires Domain Verification)')}
                         className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-500/50 cursor-not-allowed transition-all flex items-center gap-1.5"
                       >
                         <Send className="h-3 w-3" /> Mail (Locked)
                       </button>
                     )}

                     {s.phone && s.phone !== '-' && (
                       <button 
                         onClick={() => sendWhatsAppInvite({
                           phone: s.phone,
                           staffName: s.name,
                           inviteCode: invitations[0]?.code || 'HUBPRO',
                           shopName: shop?.name || 'Our Shop'
                         })}
                         className="text-[10px] font-black uppercase tracking-[0.1em] text-green-500 hover:text-green-500/70 transition-all flex items-center gap-1.5"
                       >
                         <MessageCircle className="h-3 w-3" /> WhatsApp
                       </button>
                     )}

                     {canEditTeam && (
                       <>
                         <button 
                           onClick={() => {
                             setPinInput('');
                             setConfirmRemoveStaff(s);
                           }}
                           className="text-[10px] font-black uppercase tracking-[0.1em] text-red-500/50 hover:text-red-500 transition-all flex items-center gap-1.5 ml-auto"
                         >
                           <Trash2 className="h-3 w-3" /> Remove
                         </button>
                       </>
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
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Records for Today: {today}</p>
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
                        ? "bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/20"
                        : "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20"
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
                      date: today, 
                      clockIn: '09:00', 
                      clockOut: '18:00',
                      status: 'PRESENT',
                      overtime: 0,
                      bonus: 0
                    });
                  }}
                  className="h-10 px-4 bg-primary text-white rounded-xl flex items-center gap-2 hover:bg-primary/90 transition-all text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95"
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
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-accent/10">
                <tr>
                  <th className="px-8 py-4 text-left text-[10px] font-black uppercase tracking-widest text-zinc-500">Staff Member</th>
                  <th className="px-8 py-4 text-left text-[10px] font-black uppercase tracking-widest text-zinc-500">In</th>
                  <th className="px-8 py-4 text-left text-[10px] font-black uppercase tracking-widest text-zinc-500">Out</th>
                  <th className="px-8 py-4 text-left text-[10px] font-black uppercase tracking-widest text-zinc-500">Hours</th>
                  <th className="px-8 py-4 text-left text-[10px] font-black uppercase tracking-widest text-zinc-500">Status</th>
                  <th className="px-8 py-4 text-right text-[10px] font-black uppercase tracking-widest text-zinc-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredStaff.map((s: Staff) => {
                  const record = attendance.find((a: Attendance) => a.staffId === s.id && a.date === today);
                  return (
                    <tr key={s.id} className="hover:bg-accent/10 transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center text-[10px] font-black">
                            {s.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs font-black">{s.name}</p>
                            <p className="text-[10px] text-muted-foreground font-bold tracking-tight uppercase">{s.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          {record?.clockIn || '--:--'}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                          <Clock3 className="h-3.5 w-3.5 text-zinc-500" />
                          {record?.clockOut || '--:--'}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className={cn(
                          "text-[10px] font-black px-2 py-1 rounded-md",
                          (record?.totalHours || 0) > 0 ? "bg-primary/10 text-primary" : "bg-accent/50 text-muted-foreground"
                        )}>
                          {record?.totalHours ? `${record.totalHours}h` : '0h'}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-xs font-bold">
                        {record ? (
                          <div className="flex flex-col">
                            <div className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest w-fit mb-1",
                              record.status === 'PRESENT' ? "bg-green-500/10 text-green-500" :
                              record.status === 'HALF_DAY' ? "bg-amber-500/10 text-amber-500" : "bg-accent/50 text-muted-foreground"
                            )}>
                              {record.status === 'PRESENT' ? 'Full Day' : record.status === 'HALF_DAY' ? 'Half Day' : record.status}
                            </div>
                            {canViewPayroll && ((record.overtime || 0) > 0 || (record.bonus || 0) > 0) && (
                              <div className="flex gap-2">
                                {record.overtime && record.overtime > 0 && <span className="text-[8px] font-black uppercase text-amber-500/80">OT: +{record.overtime}h</span>}
                                {record.bonus && record.bonus > 0 && <span className="text-[8px] font-black uppercase text-primary/80">Bonus: +{formatCurrency(record.bonus)}</span>}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-zinc-400 opacity-50 italic">—</span>
                        )}
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center justify-end gap-2">
                          {!record ? (
                            <>
                              <button
                                onClick={() => recordAttendance({
                                  id: `${s.id}_${today}`,
                                  staffId: s.id,
                                  date: today,
                                  clockIn: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
                                  status: 'PRESENT'
                                })}
                                className="px-3 py-1.5 bg-green-500/10 text-green-500 text-[9px] font-black uppercase tracking-widest rounded-lg border border-green-500/20 hover:bg-green-500 hover:text-white transition-all"
                              >
                                Auto In
                              </button>
                                {canEditTeam && (
                                  <button
                                    onClick={() => { setManualEntryStaff(s); setManualTimes({ date: today, clockIn: '09:00', clockOut: '18:00', status: 'PRESENT', overtime: 0, bonus: 0 }); }}
                                    className="px-3 py-1.5 bg-accent text-muted-foreground text-[9px] font-black uppercase tracking-widest rounded-lg border border-border/50 hover:bg-primary hover:text-white transition-all"
                                  >
                                    Manual
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
                                className="px-3 py-1.5 bg-amber-500/10 text-amber-500 text-[9px] font-black uppercase tracking-widest rounded-lg border border-amber-500/20 hover:bg-amber-500 hover:text-white transition-all"
                              >
                                Auto Out
                              </button>
                              <button
                                onClick={() => { setManualEntryStaff(s); setManualTimes({ date: today, clockIn: record.clockIn || '09:00', clockOut: '18:00', status: record.status || 'PRESENT', overtime: record.overtime || 0, bonus: record.bonus || 0 }); }}
                                className="px-3 py-1.5 bg-accent text-muted-foreground text-[9px] font-black uppercase tracking-widest rounded-lg border border-border/50 hover:bg-primary hover:text-white transition-all"
                              >
                                Manual
                              </button>
                            </>
                          ) : (
                            canEditTeam ? (
                              <select
                                value={record.status}
                                onChange={(e) => recordAttendance({ ...record, status: e.target.value as any })}
                                className="bg-accent/40 border border-border/50 rounded-xl px-4 py-2 text-[10px] font-black uppercase focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
                              >
                                <option value="PRESENT">FULL DAY</option>
                                <option value="HALF_DAY">HALF DAY</option>
                                <option value="ABSENT">ABSENT</option>
                                <option value="LEAVE">LEAVE</option>
                              </select>
                            ) : (
                              <div className={cn(
                                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full",
                                record.status === 'PRESENT' ? "bg-green-500/10 text-green-500" : "bg-accent/50 text-muted-foreground"
                              )}>
                                <span className="text-[9px] font-black uppercase tracking-widest">{record.status}</span>
                              </div>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'payroll' && (
        <div className="space-y-6">
          {canViewPayroll && (
            <div className="p-8 glass-card rounded-[3rem] border border-primary/20 bg-primary/5 flex flex-col md:flex-row items-center gap-8">
              <div className="h-20 w-20 rounded-[2rem] premium-gradient flex items-center justify-center text-white shadow-2xl shadow-primary/40">
                <DollarSign className="h-10 w-10 text-white" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl font-black tracking-tight mb-1">Monthly Payroll Hub</h2>
                <p className="text-sm font-medium text-muted-foreground">Automation for <span className="text-primary font-black">{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</span> based on live attendance.</p>
              </div>
              <div className="flex gap-4">
                <button className="px-8 py-4 bg-primary text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all">
                  Release All Salaries
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredStaff.map((s: Staff) => {
              const payroll = calculateStaffSalary(s, currentMonth);
              const isPaid = expenses.some((e: any) => 
                (e.category === 'Staff Salary' || e.category === 'Advance Salary') && 
                e.description.includes(s.name) && 
                e.description.includes(currentMonth)
              );
              return (
                <div key={s.id} className={cn(
                  "glass-card rounded-[2.5rem] p-8 border border-border/50 hover:border-primary/40 transition-all flex flex-col relative overflow-hidden",
                  isPaid && "bg-green-500/[0.02]"
                )}>
                  {isPaid && (
                    <div className="absolute top-0 right-0 px-4 py-1 bg-green-500 text-white text-[8px] font-black uppercase tracking-widest rounded-bl-xl shadow-lg">
                      Distributed
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-accent flex items-center justify-center text-lg font-black">{s.name.charAt(0)}</div>
                      <div>
                        <h3 className="text-base font-black tracking-tight">{s.name}</h3>
                        {canViewPayroll && (
                          <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                            {formatCurrency(payroll.baseSalary)}/mo Base
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-foreground">{formatCurrency(payroll.earned)}</p>
                      {canViewPayroll && (payroll.overtimePay > 0 || payroll.bonusTotal > 0) && (
                        <p className="text-[9px] font-black text-muted-foreground mt-0.5">
                          {formatCurrency(Math.round(payroll.days * (payroll.baseSalary / 30)))} + {formatCurrency(payroll.overtimePay)} OT + {formatCurrency(payroll.bonusTotal)} B
                        </p>
                      )}
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground italic">Current Payout</p>
                    </div>
                  </div>

                  <div className="flex-1 grid grid-cols-3 gap-3 mb-8">
                    <div className="text-center p-3 rounded-2xl bg-accent/30">
                      <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Present</p>
                      <p className="text-lg font-black">{payroll.present}</p>
                    </div>
                    <div className="text-center p-3 rounded-2xl bg-accent/30">
                      <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Half</p>
                      <p className="text-lg font-black">{payroll.half}</p>
                    </div>
                    <div className="text-center p-3 rounded-2xl bg-primary/10 border border-primary/20">
                      <p className="text-[10px] font-black uppercase text-primary mb-1">Effective</p>
                      <p className="text-lg font-black text-primary">{payroll.days}</p>
                    </div>
                  </div>

                  {canViewPayroll && (
                    <button
                      onClick={() => {
                        setPayoutStaff(s);
                        setIsAdvanceMode(false);
                        setCustomAmount(String(payroll.earned));
                      }}
                      className={cn(
                        "w-full py-4 rounded-2xl border font-black text-[10px] uppercase tracking-[0.2em] transition-all",
                        isPaid 
                          ? "bg-accent/50 border-border/50 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          : "bg-card border-border/50 hover:bg-primary/10 hover:text-primary"
                      )}
                    >
                      {isPaid ? 'Record Additional / Advance' : 'Finalize & Record Expense'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isAddingStaff && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setIsAddingStaff(false)} />
          <div className="relative z-10 w-full max-w-lg glass-card rounded-[3rem] p-10 border border-white/10 shadow-2xl animate-in zoom-in slide-in-from-bottom-4 duration-300">
            <h2 className="text-2xl font-black mb-8 flex items-center gap-3">
              <UserPlus className="h-7 w-7 text-primary" />
              Add New Member
            </h2>
            <form className="space-y-6" onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const phone = formData.get('phone') as string;
              
              if (staff.some((s: Staff) => s.phone === phone)) {
                showToast("A staff member with this phone number already exists!");
                return;
              }

              upsertStaff({
                id: `staff-${Date.now()}`,
                name: formData.get('name') as string,
                phone,
                email: formData.get('email') as string,
                role: formData.get('role') as string,
                joinedAt: new Date().toISOString(),
                status: 'active',
                salary: Number(formData.get('salary')),
                permissions: newStaffPermissions
              } as any);
              setIsAddingStaff(false);
              setNewStaffPermissions({});
            }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Staff Full Name</label>
                  <input name="name" required className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 font-bold text-sm outline-none shadow-inner" placeholder="John Doe" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Contact Phone</label>
                  <input name="phone" defaultValue="+91" required className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 font-bold text-sm outline-none shadow-inner" placeholder="+91..." />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Base Monthly Salary</label>
                  <input name="salary" type="number" required className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 font-bold text-sm outline-none shadow-inner" placeholder="₹" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Staff Designation</label>
                  <select name="role" required className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 font-bold text-sm outline-none">
                    <option>Sales Associate</option>
                    <option>Store Manager</option>
                    <option>Delivery Partner</option>
                    <option>Inventory Incharge</option>
                    <option>General Staff</option>
                  </select>
                </div>
                <div className="space-y-4 pt-6 border-t border-white/10 md:col-span-2">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldAlert className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-black tracking-tight">App Access & Permissions</h3>
                  </div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Set which modules the new member can access</p>
                  
                  <div className="space-y-6 pt-2">
                    <PermissionTable 
                      permissions={newStaffPermissions} 
                      onChange={setNewStaffPermissions} 
                    />
                  </div>
                </div>
              </div>
              <div className="pt-4 flex gap-4">
                <button type="submit" className="flex-1 premium-gradient text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:shadow-primary/20 transition-all">Add to Roster</button>
                <button type="button" onClick={() => setIsAddingStaff(false)} className="flex-1 py-4 bg-accent/50 rounded-2xl font-black text-xs uppercase tracking-widest transition-colors hover:bg-accent/70">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {manualEntryStaff && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setManualEntryStaff(null)} />
          <div className="relative z-10 w-full max-w-lg glass-card rounded-[3rem] p-10 border border-white/10 shadow-2xl animate-in zoom-in slide-in-from-bottom-4 duration-300">
            <h2 className="text-2xl font-black mb-2 flex items-center gap-3">
              <Clock9 className="h-7 w-7 text-primary" />
              Manual Attendance Entry
            </h2>
            <p className="text-xs text-muted-foreground font-bold mb-8 uppercase tracking-widest">Admin override — enter precise shift times</p>
            <form className="space-y-6" onSubmit={(e) => {
              e.preventDefault();
              if (!manualEntryStaff) return;
              recordAttendance({
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
            }}>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Staff Member</label>
                  <select
                    value={manualEntryStaff.id}
                    onChange={(e) => setManualEntryStaff(staff.find((s: Staff) => s.id === e.target.value) || null)}
                    className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 font-bold text-sm outline-none"
                  >
                    {staff.map((s: Staff) => <option key={s.id} value={s.id}>{s.name} — {s.role}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Date of Attendance</label>
                  <input
                    type="date"
                    value={manualTimes.date}
                    onChange={(e) => setManualTimes({ ...manualTimes, date: e.target.value })}
                    className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 font-bold text-sm outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Shift Status</label>
                    <select
                      value={manualTimes.status}
                      onChange={(e) => setManualTimes({ ...manualTimes, status: e.target.value as any })}
                      className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 font-bold text-sm outline-none"
                    >
                      <option value="PRESENT">Full Day</option>
                      <option value="HALF_DAY">Half Day</option>
                      <option value="ABSENT">Absent</option>
                      <option value="LEAVE">Leave</option>
                    </select>
                  </div>
                  {canViewPayroll && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Overtime (Hrs)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={manualTimes.overtime}
                        onChange={(e) => setManualTimes({ ...manualTimes, overtime: Number(e.target.value) })}
                        className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 font-bold text-sm outline-none shadow-inner"
                      />
                    </div>
                  )}
                </div>

                {canViewPayroll && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Bonus Amount ({shop?.currency || '₹'})</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Enter bonus if any..."
                      value={manualTimes.bonus}
                      onChange={(e) => setManualTimes({ ...manualTimes, bonus: Number(e.target.value) })}
                      className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 font-bold text-sm outline-none shadow-inner"
                    />
                  </div>
                )}

                {manualTimes.clockIn && manualTimes.clockOut && (() => {
                  const [ih, im] = manualTimes.clockIn.split(':').map(Number);
                  const [oh, om] = manualTimes.clockOut.split(':').map(Number);
                  const hrs = ((oh + om / 60) - (ih + im / 60)).toFixed(1);
                  const standard = shop?.standardWorkingHours || 9;
                  const autoStatus = Number(hrs) >= standard ? 'FULL DAY' : Number(hrs) >= standard / 2 ? 'HALF DAY' : 'ABSENT';
                  
                  return (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/10 rounded-2xl">
                        <Clock9 className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-xs font-black">{hrs} Hours → Auto Suggest: <span className="text-primary">{autoStatus}</span></p>
                          <p className="text-[10px] text-muted-foreground font-bold italic">Currently setting to: <span className="text-foreground">{manualTimes.status}</span></p>
                        </div>
                      </div>
                      {canViewPayroll && (manualTimes.overtime > 0 || manualTimes.bonus > 0) && (
                        <div className="flex items-center gap-3 p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                          <TrendingUp className="h-4 w-4 text-amber-500" />
                          <div>
                            <p className="text-xs font-black text-amber-500">Manual Adjustments Active</p>
                            <p className="text-[10px] font-bold">OT: {manualTimes.overtime}h • Bonus: {formatCurrency(manualTimes.bonus)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="pt-4 flex gap-4">
                <button type="submit" className="flex-1 premium-gradient text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:shadow-primary/20 transition-all">Inject Record</button>
                <button type="button" onClick={() => setManualEntryStaff(null)} className="flex-1 py-4 bg-accent/50 rounded-2xl font-black text-xs uppercase tracking-widest transition-colors hover:bg-accent/70">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingStaff && canEditTeam && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setEditingStaff(null)} />
          <div className="relative z-10 w-full max-w-2xl glass-card rounded-[3rem] p-10 border border-white/10 shadow-2xl animate-in zoom-in slide-in-from-bottom-4 duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h2 className="text-2xl font-black mb-8 flex items-center gap-3 text-secondary">
              <Edit3 className="h-7 w-7 text-primary" />
              Edit Team Member
            </h2>
            <form className="space-y-6" onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              upsertStaff({
                ...editingStaff,
                name: formData.get('name') as string,
                phone: formData.get('phone') as string,
                email: formData.get('email') as string,
                role: formData.get('role') as string,
                salary: Number(formData.get('salary')), 
              } as any);
              showToast('Profile Updated!');
              setEditingStaff(null);
            }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Staff Full Name</label>
                  <input name="name" defaultValue={editingStaff.name} required className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 font-bold text-sm outline-none shadow-inner" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Contact Phone</label>
                  <input name="phone" defaultValue={editingStaff.phone.startsWith('+') ? editingStaff.phone : `+91${editingStaff.phone}`} required className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 font-bold text-sm outline-none shadow-inner" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Base Monthly Salary</label>
                  <input 
                    name="salary" 
                    type="number" 
                    defaultValue={staffPrivate.find((p: any) => p.id === editingStaff.id)?.salary} 
                    required 
                    className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 font-bold text-sm outline-none shadow-inner" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Staff Designation</label>
                  <select name="role" defaultValue={editingStaff.role} required className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 font-bold text-sm outline-none">
                    <option>Sales Associate</option>
                    <option>Store Manager</option>
                    <option>Delivery Partner</option>
                    <option>Inventory Incharge</option>
                    <option>General Staff</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Email Address</label>
                  <input name="email" type="email" defaultValue={editingStaff.email} className="w-full bg-accent/30 border border-border/50 rounded-2xl px-5 py-4 font-bold text-sm outline-none shadow-inner" />
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-black tracking-tight">App Access & Permissions</h3>
                </div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Toggle modules this staff member can access</p>
                
                <div className="space-y-6 pt-2">
                  <PermissionTable 
                    permissions={editingStaff.permissions || {}} 
                    onChange={(p) => setEditingStaff({ ...editingStaff, permissions: p })} 
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button type="submit" className="flex-1 premium-gradient text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:shadow-primary/20 transition-all">Save Changes</button>
                <button type="button" onClick={() => setEditingStaff(null)} className="flex-1 py-4 bg-accent/50 rounded-2xl font-black text-xs uppercase tracking-widest transition-colors hover:bg-accent/70">Cancel</button>
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
          onConfirm={() => {
            if (pinInput === shopPrivate?.adminPin) {
              deleteStaff(confirmRemoveStaff.id);
              showToast(`${confirmRemoveStaff.name} removed permanently.`);
              setConfirmRemoveStaff(null);
            } else {
              showToast('Invalid Security PIN', true);
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
          icon={<ShieldCheck className="h-8 w-8 text-red-500" />}
        />
      )}
      {/* ── MODAL: Payout Confirmation & Advance Pay ── */}
      {payoutStaff && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in" onClick={() => setPayoutStaff(null)} />
          <div className="relative z-10 w-full max-w-md glass-card rounded-[3rem] p-10 border border-white/10 shadow-2xl animate-in zoom-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-14 w-14 rounded-2xl premium-gradient flex items-center justify-center text-white shadow-xl">
                <CreditCard className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight">{payoutStaff.name}</h3>
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                  Payout for {new Date().toLocaleString('default', { month: 'long' })} {currentMonth.split('-')[0]}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => {
                    setIsAdvanceMode(false);
                    const payroll = calculateStaffSalary(payoutStaff, currentMonth);
                    setCustomAmount(String(payroll.earned));
                  }}
                  className={cn(
                    "p-4 rounded-2xl border transition-all text-left",
                    !isAdvanceMode ? "bg-primary/10 border-primary/50" : "bg-card border-border/50 opacity-60"
                  )}
                >
                  <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">Standard Payout</p>
                  <p className="text-sm font-black">Attendance Based</p>
                </button>
                <button 
                  onClick={() => {
                    setIsAdvanceMode(true);
                    setCustomAmount('');
                  }}
                  className={cn(
                    "p-4 rounded-2xl border transition-all text-left",
                    isAdvanceMode ? "bg-amber-500/10 border-amber-500/50" : "bg-card border-border/50 opacity-60"
                  )}
                >
                  <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">Custom Payout</p>
                  <p className="text-sm font-black">Advance / Bonus</p>
                </button>
              </div>

              <div className="p-6 rounded-[2rem] bg-accent/30 border border-border/50">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Distribution Amount</label>
                  {isAdvanceMode && <span className="text-[9px] font-black uppercase text-amber-500">Manual Entry</span>}
                </div>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-primary">₹</span>
                  <input 
                    type="number"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    readOnly={!isAdvanceMode}
                    placeholder="0.00"
                    className="w-full h-20 bg-white dark:bg-zinc-900 border-2 border-border/50 rounded-3xl pl-12 pr-6 text-3xl font-black focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-75"
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
                        description: `${isAdvanceMode ? 'Advance' : 'Monthly Salary'} for ${payoutStaff.name} (${currentMonth})`,
                        date: today,
                        createdAt: new Date().toISOString()
                      });
                      showToast(`${isAdvanceMode ? 'Advance' : 'Salary'} distribution recorded!`);
                      setPayoutStaff(null);
                    } else {
                      showToast('Please enter a valid amount', true);
                    }
                    setPayoutLoading(false);
                  }}
                  disabled={payoutLoading || !customAmount || Number(customAmount) <= 0}
                  className="w-full py-5 premium-gradient text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all disabled:grayscale disabled:opacity-50 disabled:scale-100"
                >
                  {payoutLoading ? 'Recording Expense...' : 'Confirm Distribution'}
                </button>
                <button 
                  onClick={() => setPayoutStaff(null)}
                  className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

