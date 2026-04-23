import React, { useState, useEffect, Suspense } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  BarChart3, 
  Settings as SettingsIcon, 
  Menu, 
  X,
  Store,
  TrendingUp,
  Bell,
  Clock,
  Users,
  Sun,
  Moon,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  ExternalLink,
  ShieldAlert,
  Lock,
  Loader2,
  Delete,
  LogOut,
  Activity,
  ChevronLeft,
  Bot,
  Fingerprint
} from 'lucide-react';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { useRef, lazy } from 'react';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useBusinessStore } from '@/lib/useBusinessStore';
import { usePermission } from '@/hooks/usePermission';
import type { InventoryItem, Sale } from '@/lib/types';
import { useSqlQuery } from '@/db/hooks';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import bcrypt from 'bcryptjs';
import { formatCurrency, cn } from '@/lib/utils';
import SyncStatusBadge from './SyncStatusBadge';

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick: () => void;
}

const NavItem = ({ icon: Icon, label, active, onClick }: NavItemProps) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group w-full text-left",
      active 
        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
        : "text-muted-foreground hover:bg-accent hover:text-foreground"
    )}
  >
    <Icon className={cn("h-5 w-5 shrink-0", active ? "scale-110" : "group-hover:scale-110 transition-transform")} />
    <span className="font-semibold text-sm">{label}</span>
  </button>
);

interface AppLayoutProps {}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'sell', label: 'Sales Hub', icon: ShoppingCart },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'expenses', label: 'Expenses', icon: TrendingUp },
  { id: 'stock-alerts', label: 'Stock Alerts', icon: AlertTriangle },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'reconciliation', label: 'Reconciliation', icon: ShieldCheck },
    { id: 'agents', label: 'AI Agents', icon: Bot },
    { id: 'team', label: 'Team Hub', icon: Users },
  ];

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Command Center',
  inventory: 'Inventory',
  sell: 'Sales Hub',
  customers: 'Customer Ledger',
  expenses: 'Expense Ledger',
  'stock-alerts': 'Stock Alerts',
  analytics: 'Analytics',
  history: 'History Log',
  team: 'Team Hub',
  reconciliation: 'Cash Reconciliation',
  agents: 'AI AI Command',
  settings: 'Control Center',
};

// Lazy loaded page components
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Inventory = lazy(() => import('@/pages/Inventory'));
const POS = lazy(() => import('@/pages/POS'));
const Customers = lazy(() => import('@/pages/Customers'));
const History = lazy(() => import('@/pages/History'));
const Expenses = lazy(() => import('@/pages/Expenses'));
const StockAlerts = lazy(() => import('@/pages/StockAlerts'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const Team = lazy(() => import('@/pages/Team'));
const Settings = lazy(() => import('@/pages/Settings'));
const MigrationTool = lazy(() => import('@/pages/MigrationTool'));
const Reconciliation = lazy(() => import('@/pages/Reconciliation'));
const Agents = lazy(() => import('@/pages/Agents'));
export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = location.pathname.substring(1) || 'dashboard';

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { shop, theme, setTheme, role, currentStaff, setActiveTab } = useBusinessStore(useShallow(state => ({
    shop: state.shop,
    theme: state.theme,
    setTheme: state.setTheme,
    role: state.role,
    currentStaff: state.currentStaff,
    setActiveTab: state.setActiveTab
  })));
  const sales = useSqlQuery<Sale>('SELECT * FROM sales WHERE tombstone = 0 ORDER BY createdAt DESC', [], ['sales']);
  const inventory = useSqlQuery<InventoryItem>('SELECT * FROM inventory WHERE tombstone = 0 ORDER BY name ASC', [], ['inventory']);
  const canViewCost = usePermission('inventory', 'view_cost');
  const canViewProfit = usePermission('sales', 'view_profit');
  const canViewAnalytics = usePermission('analytics', 'view');
  const canManageTeam = usePermission('team', 'edit');
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [pinEntry, setPinEntry] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // SCROLL-LOCK ARMOR: Freeze background when sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [sidebarOpen]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Low stock notifications
  const lowStockItems = inventory.filter(p => p.stock !== undefined && p.stock <= 5);

  // Today's revenue from real sales data
  const today = new Date().toISOString().split('T')[0];
  const todayRevenue = sales
    .filter((s) => s.date === today)
    .reduce((sum, s) => sum + s.total, 0);

  // --- ACCESS CONTROL GUARD ---
  useEffect(() => {
    if (role === 'staff' && currentStaff?.permissions) {
      const p = currentStaff.permissions;
      
      const hasAccess = (tab: string) => {
        if (tab === 'team') return true;
        if (tab === 'dashboard' || tab === 'analytics') return canViewAnalytics;
        if (tab === 'inventory' || tab === 'stock-alerts') return !!p.inventory?.view;
        if (tab === 'sell' || tab === 'history') return !!p.sales?.view;
        if (tab === 'reconciliation') return false;
        if (tab === 'customers') return !!p.customers?.view;
        if (tab === 'expenses') return !!p.expenses?.view;
        if (tab === 'agents') return true; // Accessible to all for now, but tools will fail
        return false;
      };

      if (activeTab !== 'settings' && !hasAccess(activeTab)) {
        const firstAvailable = NAV_ITEMS.find(item => hasAccess(item.id))?.id || 'dashboard';
        setActiveTab(firstAvailable);
      }
    }
  }, [role, currentStaff, activeTab, setActiveTab, canViewAnalytics]);

  const goToTab = (tab: string) => {
    setActiveTab(tab);
    setSidebarOpen(false); // close mobile sidebar on nav
  };

  const handleLogout = () => {
    const { logout } = useBusinessStore.getState();
    logout();
  };

  const handleRoleSwitch = async (newRole: 'admin' | 'staff') => {
    const { setRole } = useBusinessStore.getState();
    if (newRole === 'staff') {
      setRole('staff');
      setProfileOpen(false);
      // SECURITY REDIRECT: If staff mode is enabled, force them away from sensitive tabs
      const protectedTabs = ['settings', 'inventory', 'analytics', 'expenses', 'stock-alerts'];
      if (protectedTabs.includes(activeTab)) {
        setActiveTab('dashboard');
      }
    } else {
      setProfileOpen(false);
      // Try Biometric First
      try {
        const result = await NativeBiometric.isAvailable();
        if (result.isAvailable) {
          await NativeBiometric.verifyIdentity({
            reason: "Authorize Admin Access",
            title: "Security Check",
            subtitle: "Use biometrics to unlock admin features",
            description: "Accessing sensitive business data",
          });
          
          useBusinessStore.getState().setRole('admin');
          return;
        }
      } catch (e) {
        console.warn('Biometric failed or cancelled', e);
      }
      
      // Fallback to PIN
      setShowUnlockModal(true);
    }
  };

  const handlePinPress = (num: string) => {
    if (pinEntry.length < 4) {
      const next = pinEntry + num;
      setPinEntry(next);
      setPinError(false);
      if (next.length === 4) verifyAdminPin(next);
    }
  };

  const verifyAdminPin = async (code: string) => {
    setPinLoading(true);
    try {
      const { shopId } = useBusinessStore.getState();
      if (!shopId) throw new Error("Shop ID not identified.");
      
      // 1. Fetch the stored hash from the private vault
      const authSnap = await getDoc(doc(db, `shops/${shopId}/private`, 'auth'));
      
      if (!authSnap.exists()) {
        throw new Error("Admin PIN not initialized. Please set it in Settings.");
      }
      
      const { adminPinHash } = authSnap.data();
      
      if (!adminPinHash) {
        throw new Error("Security keys missing. Please reset in Settings.");
      }
      
      // 2. Verify PIN locally using bcrypt
      const isMatch = bcrypt.compareSync(code, adminPinHash);
      
      if (!isMatch) {
        throw new Error("Incorrect Admin PIN.");
      }
      
      // 3. Grant access
      useBusinessStore.getState().setRole('admin');
      setShowUnlockModal(false);
      setPinEntry('');
    } catch (error: any) {
      console.error('PIN Verification Failed:', error);
      setPinError(true);
      setPinEntry('');
    } finally {
      setPinLoading(false);
    }
  };

  return (
    <div className="flex h-[100dvh] w-full bg-background selection:bg-primary/30 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-[60] w-64 bg-card border-r border-border transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:z-auto no-print shadow-2xl lg:shadow-none overflow-hidden flex flex-col",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Mobile Close Button - Executive Hit-Area */}
        <button 
          onClick={() => setSidebarOpen(false)}
          className="absolute right-4 top-4 h-12 w-12 bg-accent/80 backdrop-blur-md rounded-2xl text-primary lg:hidden flex items-center justify-center hover:bg-primary/20 hover:scale-110 active:scale-90 transition-all z-[100] shadow-xl border border-primary/20"
          aria-label="Close navigation"
        >
          <ChevronLeft className="h-7 w-7 stroke-[3px]" />
        </button>

        <div className="flex flex-col h-full p-4 overflow-y-auto scroll-smooth">
          {/* Logo */}
          <div className="flex items-center gap-3 px-2 mb-8 mt-2">
            <div className="h-10 w-10 premium-gradient rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/30">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-foreground">Business Hub</h1>
              <p className="text-[10px] text-foreground/50 font-black uppercase tracking-[0.2em]">Pro Edition</p>
            </div>
          </div>

          {/* Main nav */}
          <nav className="flex-1 space-y-1">
            {NAV_ITEMS
              .filter(item => {
                const { role, currentStaff } = useBusinessStore.getState();
                if (role === 'admin') return true;
                if (!currentStaff?.permissions) return false;
                
                const p = currentStaff.permissions;
                const tabId = item.id;
                
                if (tabId === 'team') return true;
                if (tabId === 'dashboard' || tabId === 'analytics') return !!p.analytics?.view;
                if (tabId === 'inventory' || tabId === 'stock-alerts') return !!p.inventory?.view;
                if (tabId === 'history') return !!p.sales?.view;
                if (tabId === 'agents') return true;
                if (tabId === 'customers') return !!p.customers?.view;
                if (tabId === 'expenses') return !!p.expenses?.view;

                return false;
              })
              .map(item => {
                const label = item.id === 'team' 
                  ? (role === 'admin' ? 'Team & HR' : 'My Presence') 
                  : item.label;

                return (
                  <NavItem
                    key={item.id}
                    icon={item.icon}
                    label={label}
                    active={activeTab === item.id}
                    onClick={() => navigate(item.id)}
                  />
                );
              })}
          </nav>

          {/* Bottom nav */}
          <div className="pt-4 border-t border-border space-y-1">
            {useBusinessStore.getState().role === 'admin' && (
              <NavItem
                icon={Settings}
                label="Settings"
                active={activeTab === 'settings'}
                onClick={() => navigate('settings')}
              />
            )}
            
            {/* INSTANT LOGOUT HUD */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-all group"
              title="Terminate Current Session"
            >
              <LogOut className="h-5 w-5 group-hover:scale-110 transition-transform" />
              <span className="font-semibold text-sm">Instant Logout</span>
            </button>

            {/* User badge */}
            <div className="flex items-center gap-3 px-4 py-3 mt-1">
              <div className="h-8 w-8 rounded-full premium-gradient shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-black truncate capitalize text-foreground">{role || 'User'}</p>
                <p className="text-[10px] text-foreground/40 truncate font-bold uppercase tracking-tighter">Local Standalone Session</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        {/* Topbar */}
        <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-border bg-background/80 backdrop-blur-md z-30 no-print">
          <div className="flex items-center gap-2">
            {/* Sidebar Toggle - ALWAYS VISIBLE */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2.5 hover:bg-accent rounded-xl transition-all border border-border/50 group"
              title="Open Navigation Menu"
            >
              <Menu className="h-5 w-5 text-foreground group-hover:scale-110 transition-transform" />
            </button>

            <span className="hidden sm:block text-sm font-black text-muted-foreground uppercase tracking-[0.3em] ml-2">
              {PAGE_TITLES[activeTab] ?? 'Business Hub'}
            </span>
          </div>

          {/* Sync Status Badge */}
          <SyncStatusBadge />

          {/* Topbar right */}
          <div className="flex items-center gap-3 ml-auto">
            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2.5 bg-accent/50 hover:bg-primary/10 rounded-xl transition-all border border-border/50 group"
              title={theme === 'dark' ? 'Switch to White Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400 group-hover:scale-110 transition-transform" />
              ) : (
                <Moon className="h-4 w-4 text-blue-500 group-hover:scale-110 transition-transform" />
              )}
            </button>
            {/* Today's revenue badge - ADMIN ONLY */}
            {canViewProfit && (
              <div className="flex items-center gap-2 bg-primary/5 px-4 py-2 rounded-2xl border border-primary/20" title="Today's Revenue">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-sm font-black text-foreground">{formatCurrency(todayRevenue)}</span>
                <span className="text-[9px] text-primary font-black uppercase tracking-widest">today</span>
              </div>
            )}

            {/* QUICK LOGOUT */}
            <button
              onClick={handleLogout}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-red-500/5 hover:bg-red-500/10 text-red-600 rounded-xl border border-red-500/20 transition-all group lg:ml-2"
              title="End Session"
            >
              <LogOut className="h-4 w-4 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-widest">Logout</span>
            </button>
            {/* Notification bell */}
            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
                className={cn(
                  "relative p-2 rounded-xl transition-all duration-300",
                  notifOpen ? "bg-primary/10 text-primary shadow-inner" : "hover:bg-accent text-muted-foreground"
                )}
              >
                <Bell className={cn("h-5 w-5", notifOpen && "animate-bounce-subtle")} />
                {lowStockItems.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-background ring-2 ring-red-500/20" />
                )}
              </button>

              {/* Notification Dropdown */}
              {notifOpen && (
                <div className="absolute right-0 mt-3 w-80 glass-card rounded-3xl p-4 shadow-2xl animate-in fade-in zoom-in duration-200 z-[100] border-primary/10">
                  <div className="flex items-center justify-between mb-4 px-2">
                    <h3 className="text-sm font-black uppercase tracking-wider">Notifications</h3>
                    <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {lowStockItems.length} Alerts
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                    {lowStockItems.length === 0 ? (
                      <div className="py-10 text-center space-y-2">
                        <ShieldCheck className="h-10 w-10 text-primary/20 mx-auto" />
                        <p className="text-xs font-bold text-muted-foreground">System healthy. No stock alerts.</p>
                      </div>
                    ) : (
                      lowStockItems.map((item: InventoryItem) => (
                        <button 
                          key={item.id}
                          onClick={() => { goToTab('inventory'); setNotifOpen(false); }}
                          className="w-full flex items-start gap-3 p-3 rounded-2xl bg-accent/30 hover:bg-primary/5 border border-transparent hover:border-primary/10 transition-all group"
                        >
                          <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                            <AlertTriangle className="h-4 w-4" />
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <p className="text-xs font-bold truncate group-hover:text-primary transition-colors">{item.name}</p>
                            <p className="text-[10px] text-muted-foreground font-medium">Critical Stock: {item.stock} left</p>
                          </div>
                          <ChevronRight className="h-3 w-3 text-muted-foreground mt-1" />
                        </button>
                      ))
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/50">
                    <button 
                      onClick={() => goToTab('analytics')}
                      className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/70 transition-colors flex items-center justify-center gap-2"
                    >
                      View Full Performance Reports <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Avatar / Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button 
                onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
                className={cn(
                  "h-9 w-9 rounded-full premium-gradient shadow-md border-2 transition-all p-0.5",
                  profileOpen ? "border-primary ring-4 ring-primary/10 scale-105" : "border-transparent hover:scale-110"
                )}
              >
                <div className="h-full w-full rounded-full bg-white/10 backdrop-blur-sm overflow-hidden flex items-center justify-center text-white">
                  <span className="text-xs font-black">{shop?.name?.charAt(0) || 'B'}</span>
                </div>
              </button>

              {/* Profile Dropdown */}
              {profileOpen && (
                <div className="absolute right-0 mt-3 w-72 glass-card rounded-3xl p-5 shadow-2xl animate-in fade-in zoom-in duration-200 z-[100] border-primary/10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-12 w-12 rounded-2xl premium-gradient flex items-center justify-center text-white shadow-lg">
                      <Store className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black truncate">{shop.name}</p>
                      <p className="text-[10px] text-muted-foreground font-bold tracking-tight uppercase">{shop.tagline || 'Pro Edition'}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {role === 'admin' ? (
                      <button 
                        onClick={() => handleRoleSwitch('staff')}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-amber-500/10 text-muted-foreground hover:text-amber-500 transition-all group"
                      >
                        <Lock className="h-4 w-4" />
                        <span className="text-xs font-bold">Lock to Staff Mode</span>
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleRoleSwitch('admin')}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all group"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        <span className="text-xs font-bold">Unlock Admin Mode</span>
                      </button>
                    )}
                    
                    {(role === 'admin' || canManageTeam) && (
                      <button 
                        onClick={() => { navigate('/settings'); setProfileOpen(false); }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all group"
                      >
                        <SettingsIcon className="h-4 w-4" />
                        <span className="text-xs font-bold">Shop Profile</span>
                      </button>
                    )}
                    {canViewAnalytics && (
                      <button 
                        onClick={() => { navigate('/analytics'); setProfileOpen(false); }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all group"
                      >
                        <Activity className="h-4 w-4" />
                        <span className="text-xs font-bold">Live Performance</span>
                      </button>
                    )}
                  </div>

                  {role === 'admin' && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-all font-bold text-xs"
                      >
                        <LogOut className="h-4 w-4" />
                        End Executive Session
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ADMIN UNLOCK MODAL */}
        {showUnlockModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in" onClick={() => setShowUnlockModal(false)} />
            <div className="relative z-10 w-full max-w-sm glass-card rounded-[3rem] p-10 shadow-2xl animate-in zoom-in slide-in-from-bottom-5 duration-300">
              {pinLoading && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-3 rounded-[3rem]">
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">Verifying...</p>
                </div>
              )}

              <div className="text-center mb-8">
                <div className="h-14 w-14 premium-gradient rounded-2xl flex items-center justify-center text-white shadow-xl mx-auto mb-4">
                  <ShieldCheck className="h-7 w-7" />
                </div>
                <h2 className="text-2xl font-black mb-1">Admin Unlock</h2>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">Enter Master PIN</p>
                <button 
                  onClick={() => handleRoleSwitch('admin')}
                  className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 bg-primary/10 text-primary rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all active:scale-95"
                >
                  <Fingerprint className="h-4 w-4" /> Try Biometric Again
                </button>
              </div>

              {/* PIN Display */}
              <div className="flex justify-center gap-4 mb-10">
                {[...Array(4)].map((_, i) => (
                  <div 
                    key={i}
                    className={`h-3 w-3 rounded-full border-2 transition-all duration-300 ${
                      pinEntry.length > i 
                        ? 'bg-primary border-primary scale-125 shadow-[0_0_10px_rgba(14,165,233,0.5)]' 
                        : pinError 
                          ? 'border-red-500/50 animate-shake' 
                          : 'border-muted-foreground/30'
                    }`}
                  />
                ))}
              </div>

              {/* Pad */}
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    onClick={() => handlePinPress(String(num))}
                    className="h-14 rounded-2xl bg-accent/30 hover:bg-primary/10 text-lg font-black transition-all active:scale-90 border border-border/50"
                  >
                    {num}
                  </button>
                ))}
                <div />
                <button
                  onClick={() => handlePinPress('0')}
                  className="h-14 rounded-2xl bg-accent/30 hover:bg-primary/10 text-lg font-black transition-all active:scale-90 border border-border/50"
                >
                  0
                </button>
                <button
                  onClick={() => setPinEntry(pinEntry.slice(0, -1))}
                  className="h-14 rounded-2xl bg-accent/10 flex items-center justify-center text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-all border border-transparent"
                >
                  <Delete className="h-4 w-4" />
                </button>
              </div>

              <button 
                onClick={() => setShowUnlockModal(false)}
                className="w-full mt-8 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel 
              </button>
            </div>
          </div>
        )}

        {/* Page content */}
        <div className="flex-1 overflow-y-auto no-print">
          <div className="max-w-7xl mx-auto p-6 md:p-8">
            <Suspense fallback={
              <div className="flex flex-col items-center justify-center py-20 gap-4 animate-pulse">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Loading Module...</p>
              </div>
            }>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/sell" element={<POS />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/history" element={<History />} />
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/stock-alerts" element={<StockAlerts />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/team" element={<Team />} />
                <Route path="/reconciliation" element={<Reconciliation />} />
                <Route path="/agents" element={<Agents />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/sequestration" element={<MigrationTool />} />
                <Route path="*" element={<div className="text-muted-foreground text-center py-20">Page not found</div>} />
              </Routes>
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}
