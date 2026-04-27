import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Package,
  ShoppingCart,
  ArrowUpRight,
  AlertTriangle,
  ShoppingBag,
  BarChart3,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Database,
  RefreshCcw,
  Wallet,
  Plus,
  X,
  CreditCard,
  History,
  UserCheck,
  Bot,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { useLiveQuery, useSqlQuery } from '@/db/hooks';
import { salesRepo, type DailySalesSeriesPoint, type SaleHistorySummary } from '@/db/repositories/salesRepo';
import { inventoryRepo, type InventoryMetrics } from '@/db/repositories/inventoryRepo';
import { attendanceRepo } from '@/db/repositories/staffRepo';
import { useBusinessStore } from '@/lib/useBusinessStore';
import { useAuthStore } from '@/lib/useAuthStore';
import { usePermission } from '@/hooks/usePermission';
import { formatCurrency, cn } from '@/lib/utils';
import Modal from '@/components/Modal';
import Label from '@/components/Label';
import Input from '@/components/Input';
import type { Expense, InventoryItem, Attendance } from '@/lib/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Area
} from 'recharts';
import { calculateForecast } from '@/lib/forecast';
import { showAppPopup } from '@/lib/popup';

function KPICard({
  title,
  value,
  sub,
  icon: Icon,
  accent = 'primary',
  alert = false,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent?: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`glass-card p-6 rounded-3xl group hover:shadow-2xl transition-all duration-500 relative overflow-hidden ${
        alert ? 'border-red-500/20' : ''
      }`}
    >
      <div className="absolute top-0 right-0 p-5 opacity-[0.06] pointer-events-none">
        <Icon className="h-20 w-20" />
      </div>
      <div className={`h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-80">{title}</p>
      <p className={`text-4xl font-black mt-1.5 ${alert ? 'text-destructive' : 'text-primary'}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground/90 mt-1.5 font-bold">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { addExpense, recordAttendance, role, shop, lastBackupDate, setInventorySearchTerm, sidebarOpen } = useBusinessStore();
  const today = new Date().toISOString().split('T')[0];
  const last30Days = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const salesTotals = useSqlQuery<{ totalRevenue: number; totalCount: number }>(
    'SELECT COALESCE(SUM(total), 0) AS totalRevenue, COUNT(*) AS totalCount FROM sales WHERE tombstone = 0',
    [],
    ['sales'],
  );
  const salesSeries = useLiveQuery<DailySalesSeriesPoint>(
    () => salesRepo.getDailySeries({ dateFrom: last30Days, dateTo: today }),
    ['sales'],
    [last30Days, today],
  );
  const { user } = useAuthStore();
  const canViewInventoryCost = usePermission('inventory', 'view_cost');
  const canViewInventory = usePermission('inventory', 'view');
  const canViewAnalytics = usePermission('analytics', 'view');
  const canViewTeam = usePermission('team', 'view');
  const canViewSales = usePermission('sales', 'view');
  const canCreateSales = usePermission('sales', 'create');
  const canCreateCustomers = usePermission('customers', 'create');
  const recentSales = useLiveQuery<SaleHistorySummary>(
    () => canViewSales ? salesRepo.getHistoryPage({}, 1, 10) : Promise.resolve([]),
    ['sales', 'sale_items', 'sale_payments'],
    [canViewSales],
  );
  const inventoryMetricsRows = useLiveQuery<InventoryMetrics>(
    async () => [await inventoryRepo.getMetrics(Boolean(canViewInventoryCost))],
    ['inventory', 'inventory_private'],
    [canViewInventoryCost],
  );
  const lowStockItems = useSqlQuery<InventoryItem>(
    `SELECT id, name, price, sku, category, subcategory, size, description, stock, sourceMeta, createdAt
     FROM inventory
     WHERE tombstone = 0 AND stock <= 5
     ORDER BY stock ASC, name ASC
     LIMIT 12`,
    [],
    ['inventory'],
  );
  const attendance = useLiveQuery<Attendance>(
    () => attendanceRepo.getAll(today),
    ['attendance'],
    [today],
  );
  const briefings = useSqlQuery<any>('SELECT * FROM daily_briefings ORDER BY id DESC LIMIT 1', [], ['daily_briefings']);
  const briefing = briefings[0];
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ amount: '', category: 'General', description: '' });
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const inventoryMetrics = inventoryMetricsRows[0] ?? {
    totalItems: 0,
    totalStock: 0,
    inventoryValue: 0,
    potentialProfit: 0,
    lowStock: 0,
  };

  const myAttendance = attendance.find((a: Attendance) => a.staffId === user?.uid && a.date === today);
  const presentStaffCount = attendance.filter((a: Attendance) => a.date === today && a.status === 'PRESENT').length;

  const handleQuickExpense = async () => {
    if (!expenseForm.amount) return;
    setIsSavingExpense(true);
    try {
      const newExpense: Expense = {
        id: `EXP-${Date.now()}`,
        amount: parseFloat(expenseForm.amount),
        category: expenseForm.category,
        description: expenseForm.description || 'Quick Expense',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      };
      await addExpense(newExpense);
      setExpenseModalOpen(false);
      setExpenseForm({ amount: '', category: 'General', description: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingExpense(false);
    }
  };

  // Backup Sentinel Logic
  const backupStatus = useMemo(() => {
    if (!lastBackupDate) return { label: 'Action Required!', color: 'text-red-500', icon: ShieldAlert, sub: 'Initial backup needed' };
    const daysSince = Math.floor((Date.now() - new Date(lastBackupDate).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince >= 7) return { label: 'Backup Overdue', color: 'text-amber-500', icon: ShieldAlert, sub: `${daysSince} days since last backup` };
    return { label: 'Data Secure', color: 'text-green-500', icon: ShieldCheck, sub: 'Weekly backup healthy' };
  }, [lastBackupDate]);

  // KPI calculations from real data
  const totalStockValue = canViewInventoryCost
    ? Math.max(0, inventoryMetrics.inventoryValue - inventoryMetrics.potentialProfit)
    : 0;
  const potentialRevenue = inventoryMetrics.inventoryValue;
  const lowStockCount = inventoryMetrics.lowStock;
  const hasMoreLowStock = lowStockCount > lowStockItems.length;

  const totalSalesRevenue = salesTotals[0]?.totalRevenue ?? 0;
  const totalSalesCount = salesTotals[0]?.totalCount ?? 0;

  // Last 7 days sales + Forecast
  const chartDataCombined = useMemo(() => {
    const historyDays = 21;
    const dates = Array.from({ length: historyDays }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (historyDays - 1 - i));
      return d.toISOString().split('T')[0];
    });

    const totalsByDate = new Map(salesSeries.map((entry) => [entry.date, entry.total]));
    const historicalSeries = dates.map((date) => totalsByDate.get(date) || 0);

    const historyData = dates.slice(-7).map((date, i) => ({
      day: new Date(date).toLocaleDateString('en-IN', { weekday: 'short' }),
      sales: historicalSeries[historyDays - 7 + i],
    }));

    if (historicalSeries.filter((value) => value > 0).length >= 7) {
      try {
        const forecast = calculateForecast(historicalSeries, 7);
        const forecastPoints = forecast.next7.map((value, i) => {
          const d = new Date();
          d.setDate(d.getDate() + i + 1);
          return {
            day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
            forecast: value,
            low: forecast.confidenceBand.low[i],
            high: forecast.confidenceBand.high[i],
            isForecast: true,
          };
        });

        return [...historyData, ...forecastPoints];
      } catch {
        return historyData;
      }
    }

    return historyData;
  }, [salesSeries]);

  return (
    <div className="space-y-10 pb-20">
      {/* Daily Briefing Agent Widget */}
      {role === 'admin' && briefing && (
        <div className="glass-card p-8 rounded-[2.5rem] border-primary/20 bg-primary/[0.02] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
            <Sparkles className="h-24 w-24 text-primary" />
          </div>
          <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-8 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-sm font-black uppercase tracking-[0.3em] text-primary">Intelligence Briefing</h2>
                <span className="text-[10px] font-bold text-muted-foreground bg-accent px-2 py-0.5 rounded-full">8:00 AM IST</span>
              </div>
              <p className="text-xl md:text-2xl font-black tracking-tight mb-4 leading-tight">
                {briefing.summary}
              </p>
              <div className="grid md:grid-cols-3 gap-4">
                {briefing.bullets.map((bullet: string, i: number) => (
                  <div key={i} className="flex gap-3 items-start group/bullet">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 group-hover/bullet:bg-primary transition-colors">
                      <ChevronRight className="h-3 w-3 text-primary group-hover/bullet:text-white" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground leading-snug">{bullet}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/50">
        <div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter leading-none mb-2">Shop Command Center</h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-90">Real-time Metrics & Insights</p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className={cn("hidden lg:flex items-center gap-2 px-4 py-2 rounded-2xl border", backupStatus.color.replace('text-', 'bg-').replace('-500', '-500/10'), backupStatus.color.replace('text-', 'border-').replace('-500', '-500/20'))}>
            <backupStatus.icon className={cn("h-4 w-4", backupStatus.color)} />
            <div className="flex flex-col">
              <span className={cn("text-[9px] font-black uppercase tracking-widest leading-none", backupStatus.color)}>{backupStatus.label}</span>
              <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-tighter mt-0.5">{backupStatus.sub}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-accent/50 px-4 py-2 rounded-2xl border border-border">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground" id="sell-search">
              Live Link Active
            </span>
          </div>
        </div>
      </div>

      {/* Unified High-Density Command Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* ACTION: START NEW SALE */}
        {(role === 'admin' || canCreateSales) && (
        <button 
          onClick={() => navigate('/sell')}
          className="group relative flex flex-col items-center justify-center aspect-square p-4 bg-primary rounded-3xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all border border-primary-foreground/10"
        >
          <div className="h-12 w-12 rounded-xl bg-primary-foreground/20 flex items-center justify-center mb-3 backdrop-blur-md">
            <ShoppingCart className="h-6 w-6 text-primary-foreground" />
          </div>
          <p className="text-primary-foreground font-black text-sm tracking-tighter leading-tight text-center">Start Sale</p>
          <p className="text-primary-foreground/60 text-[8px] font-black uppercase tracking-widest mt-1">POS Hub</p>
        </button>
        )}

        {/* ACTION: INVENTORY */}
        {(role === 'admin' || canViewInventory) && (
        <button 
          onClick={() => navigate('/inventory')}
          className="group relative flex flex-col items-center justify-center aspect-square p-4 glass-card border-border/5 rounded-3xl hover:bg-accent/40 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center mb-3">
            <Package className="h-6 w-6 text-primary transition-colors" />
          </div>
          <p className="font-black text-sm tracking-tighter leading-tight text-center text-foreground">Inventory</p>
          <p className="text-muted-foreground text-[8px] font-black uppercase tracking-widest mt-1">Catalog</p>
        </button>
        )}

        {/* METRICS START HERE - ADMIN ONLY */}
        {canViewAnalytics && (
          <>
            <div className="glass-card flex flex-col items-center justify-center aspect-square p-4 rounded-3xl group transition-all duration-500">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <p className="text-[8px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-80 text-center">Revenue</p>
              <p className="text-lg font-black mt-0.5 text-primary tracking-tighter">{formatCurrency(totalSalesRevenue)}</p>
              <p className="text-[8px] text-muted-foreground/60 mt-1 font-bold text-center">{totalSalesCount} Trans.</p>
            </div>

            <div className="glass-card flex flex-col items-center justify-center aspect-square p-4 rounded-3xl group transition-all duration-500">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <ShoppingBag className="h-5 w-5 text-primary" />
              </div>
              <p className="text-[8px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-80 text-center">Potential</p>
              <p className="text-lg font-black mt-0.5 text-primary tracking-tighter">{formatCurrency(potentialRevenue)}</p>
              <p className="text-[8px] text-muted-foreground/60 mt-1 font-bold text-center">Full Stock</p>
            </div>

            <div className="glass-card flex flex-col items-center justify-center aspect-square p-4 rounded-3xl group transition-all duration-500">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <p className="text-[8px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-80 text-center">Stock Val.</p>
              <p className="text-lg font-black mt-0.5 text-primary tracking-tighter">{formatCurrency(totalStockValue)}</p>
              <p className="text-[8px] text-muted-foreground/60 mt-1 font-bold text-center">{inventoryMetrics.totalItems} SKUs</p>
            </div>
          </>
        )}

        {/* ALERTS: RESTOCK */}
        <div 
          onClick={() => { if (lowStockCount > 0) navigate('/inventory'); }}
          className={cn(
            "flex flex-col items-center justify-center aspect-square p-4 rounded-3xl border transition-all hover:scale-105 cursor-pointer",
            lowStockCount > 0 ? "bg-red-500/10 border-red-500/30 shadow-red-500/10" : "glass-card"
          )}
        >
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center mb-3", lowStockCount > 0 ? "bg-red-500/20" : "bg-primary/10")}>
            <AlertTriangle className={cn("h-5 w-5", lowStockCount > 0 ? "text-red-500" : "text-primary")} />
          </div>
          <p className="text-[8px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-80 text-center">Alerts</p>
          <p className={cn("text-2xl font-black mt-0.5", lowStockCount > 0 ? "text-red-500" : "text-primary")}>
            {lowStockCount}
          </p>
          <p className="text-[8px] text-muted-foreground/60 mt-1 font-bold text-center">Stock Low</p>
        </div>

        {/* ATTENDANCE WIDGET */}
        <div 
          onClick={() => {
            if (role === 'staff' && user) {
              if (!shop?.allowStaffAttendance) {
                showAppPopup({
                  title: 'Attendance Locked',
                  message: 'Admin restricted manual clock-in. Contact admin.',
                  variant: 'warning',
                  confirmText: 'Understood',
                });
                return;
              }
              const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
              if (!myAttendance) {
                // Clock IN
                recordAttendance({
                  id: `${user.uid}_${today}`,
                  staffId: user.uid,
                  date: today,
                  clockIn: timeStr,
                  status: 'PRESENT'
                });
              } else if (!myAttendance.clockOut) {
                // Clock OUT
                recordAttendance({
                  ...myAttendance,
                  clockOut: timeStr
                });
              } else {
                navigate('/team');
              }
            } else {
              navigate('/team');
            }
          }}
          className={cn(
            "flex flex-col items-center justify-center aspect-square p-4 rounded-3xl border transition-all hover:scale-105 cursor-pointer",
            role === 'staff' && (!myAttendance || !myAttendance.clockOut) ? "bg-amber-500/10 border-amber-500/30" : "glass-card"
          )}
        >
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center mb-3", role === 'staff' && !myAttendance ? "bg-amber-500/20" : "bg-primary/10")}>
            <UserCheck className={cn("h-5 w-5", role === 'staff' && (!myAttendance || !myAttendance.clockOut) ? "text-amber-600" : "text-primary")} />
          </div>
          <p className="text-[8px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-80 text-center">Attendance</p>
          <p className={cn("text-lg font-black mt-0.5 tracking-tighter text-center", role === 'staff' && (!myAttendance || !myAttendance.clockOut) ? "text-amber-600" : "text-foreground")}>
            {canViewTeam ? `${presentStaffCount} In` : 
             (!shop?.allowStaffAttendance && role === 'staff' && !myAttendance ? 'Locked' :
             (myAttendance?.clockOut ? 'Shift Done' : (myAttendance ? 'Clock Out' : 'Sign In')))}
          </p>
          <p className="text-[8px] text-muted-foreground/60 mt-1 font-bold text-center">
             {canViewTeam ? 'Team Present' : 
              (!shop?.allowStaffAttendance && role === 'staff' && !myAttendance ? 'Admin Log Only' :
              (myAttendance?.clockOut ? `${myAttendance.totalHours}h Worked` : (myAttendance?.clockIn || 'Arrived?')))}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        {/* Bar Chart - ADMIN ONLY */}
        {canViewAnalytics && (
          <div className="lg:col-span-4 glass-card rounded-3xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                7-Day Revenue Pulse
              </h3>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">Actual</span>
                </div>
                <div className="flex items-center gap-1.5 border-l border-border pl-3">
                  <div className="h-2 w-2 rounded-full bg-purple-500" />
                  <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">AI Forecast</span>
                </div>
              </div>
            </div>
            {totalSalesRevenue === 0 ? (
              <div className="h-[260px] flex flex-col items-center justify-center text-center text-muted-foreground opacity-40">
                <BarChart3 className="h-12 w-12 mb-3" />
                <p className="text-sm font-bold">No sales recorded yet</p>
              </div>
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartDataCombined}>
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(199,89%,48%)" stopOpacity={1} />
                        <stop offset="100%" stopColor="hsl(199,89%,48%)" stopOpacity={0.5} />
                      </linearGradient>
                      <linearGradient id="forecastArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700 }} />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fontWeight: 700 }}
                      tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '16px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: 'hsl(var(--foreground))',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      }}
                      formatter={(v: any, name: any) => [formatCurrency(Number(v)), name]}
                      cursor={{ fill: 'rgba(14,165,233,0.08)' }}
                    />
                    <Bar dataKey="sales" name="Actual Sales" fill="url(#barGrad)" radius={[6, 6, 0, 0]} barSize={35} />
                    <Area dataKey="forecast" name="AI Forecast" fill="url(#forecastArea)" stroke="#a855f7" strokeWidth={2} strokeDasharray="5 5" />
                    <Area dataKey="high" name="Confidence Band" fill="#a855f7" stroke="none" fillOpacity={0.05} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Low Stock Alerts */}
        <div className="lg:col-span-3 glass-card rounded-3xl p-8">
          <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2 mb-6">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Restock Required
          </h3>
          {lowStockCount === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center opacity-30">
              <ShoppingCart className="h-12 w-12 mb-3" />
              <p className="text-sm font-bold">All stock levels healthy</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {lowStockItems.map((item: InventoryItem) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setInventorySearchTerm(item.name);
                    navigate('/inventory');
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-destructive/5 border border-destructive/10 hover:bg-destructive/10 transition-all hover:scale-[1.02] active:scale-[0.98] group"
                >
                  <div className="min-w-0 text-left">
                    <p className="font-bold text-sm truncate group-hover:text-destructive transition-colors text-foreground">{item.name}</p>
                    <p className="text-[10px] text-foreground/60 uppercase tracking-widest">
                      {item.category}{item.sku ? ` · ${item.sku}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-black text-destructive">{item.stock ?? '?'} left</p>
                    <p className="text-[9px] text-primary uppercase font-black">Refill now →</p>
                  </div>
                </button>
              ))}
              {hasMoreLowStock && (
                <button
                  onClick={() => navigate('/stock-alerts')}
                  className="w-full rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-primary transition-all hover:bg-primary/10"
                >
                  View remaining {lowStockCount - lowStockItems.length} alerts
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent Sales - ADMIN ONLY */}
      {canViewSales && (
        <div className="glass-card rounded-3xl p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Recent Sales
            </h3>
            <button 
              onClick={() => navigate('/history')}
              className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
            >
              View All History →
            </button>
          </div>
          {recentSales.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground opacity-40">
              <ShoppingCart className="h-10 w-10 mx-auto mb-3" />
              <p className="text-sm font-bold">No sales yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {recentSales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between py-4 hover:bg-accent/10 transition-colors px-2 rounded-xl">
                    <div>
                      <p className="font-semibold text-sm">
                        {sale.customerName ? `Customer: ${sale.customerName}` : 'Walk-in Customer'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                        <span>{sale.itemQuantity} item{sale.itemQuantity !== 1 ? 's' : ''}</span>
                        <span className="opacity-30">·</span>
                        <span className={cn(
                          "font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-md",
                          sale.paymentCount > 1 
                            ? "bg-amber-500/10 text-amber-600 border border-amber-500/10" 
                            : "bg-accent text-muted-foreground"
                        )}>
                          {sale.paymentCount > 1 ? 'SPLIT' : sale.paymentMode}
                        </span>
                        <span className="opacity-30">·</span>
                        <span>{sale.date}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-primary">{formatCurrency(sale.total)}</p>
                      {sale.discount > 0 && (
                        <p className="text-[10px] text-muted-foreground">-{formatCurrency(sale.discount)} disc.</p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* QUICK EXPENSE FAB */}
      {!sidebarOpen && (
        <button
          onClick={() => setExpenseModalOpen(true)}
          className="fixed bottom-8 right-8 h-14 w-14 rounded-2xl bg-primary text-primary-foreground shadow-2xl shadow-primary/40 hover:scale-110 active:scale-95 transition-all flex items-center justify-center z-50 group border border-primary-foreground/20"
        >
          <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform duration-300" />
          <span className="absolute right-full mr-4 px-3 py-1.5 rounded-xl bg-card border border-border shadow-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Post Expense
          </span>
        </button>
      )}

      {/* QUICK EXPENSE MODAL */}
      <Modal open={expenseModalOpen} onClose={() => setExpenseModalOpen(false)} title="Quick Expense Report">
        <div className="space-y-4">
          <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex flex-col items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Impact Analysis</span>
            <p className="text-[11px] font-bold text-center text-primary/80">Every rupee recorded ensures your profit analysis remains 100% accurate.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-black text-muted-foreground">Amount (₹) *</Label>
            <Input 
              autoFocus
              type="number" 
              placeholder="0.00" 
              value={expenseForm.amount} 
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} 
              className="text-lg font-black"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-black text-muted-foreground">Category</Label>
            <select 
              value={expenseForm.category}
              onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
              className="w-full bg-accent border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none transition-all"
            >
              {['General', 'Rent', 'Electricity', 'Water', 'Staff Salary', 'Maintenance', 'Stock Purchase', 'Marketing', 'Tea/Coffee', 'Cleaning'].map(c => (
                <option key={c} value={c} className="bg-card text-foreground">{c}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-black text-muted-foreground">Short Note</Label>
            <Input 
              placeholder="e.g. Cleaning Supplies, Daily Tea..." 
              value={expenseForm.description} 
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} 
            />
          </div>

          <button
            onClick={handleQuickExpense}
            disabled={!expenseForm.amount || isSavingExpense}
            className="w-full premium-gradient text-white py-4 rounded-2xl font-black text-xs hover:shadow-xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest disabled:opacity-50"
          >
            {isSavingExpense ? 'Saving...' : 'Record Expense ✨'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
