import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, Package, ShoppingCart, BarChart3, Settings as SettingsIcon, 
  Menu, ChevronLeft, Store, TrendingUp, Bell, Clock, Users, Sun, Moon, 
  AlertTriangle, ChevronRight, ShieldCheck, ExternalLink, LogOut, Activity, 
  Bot, Fingerprint, Delete, Loader2, Lock
} from 'lucide-react';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';

import { useBusinessStore } from '@/lib/useBusinessStore';
import { useAuthStore } from '@/lib/useAuthStore';
import { usePermission } from '@/hooks/usePermission';
import { useSqlQuery } from '@/db/hooks';
import { auth } from '@/lib/firebase';
import { verifyAdminPin as verifyAdminPinCode } from '@/lib/admin';
import { ADMIN_PERMISSION_TEMPLATE } from '@/lib/permissions';
import { formatCurrency, cn } from '@/lib/utils';
import type { InventoryItem, Sale } from '@/lib/types';

// --- 🗺️ NAVIGATION CONFIGURATION ---
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
  dashboard: 'Command Center', inventory: 'Inventory', sell: 'Sales Hub',
  customers: 'Customer Ledger', expenses: 'Expense Ledger', 'stock-alerts': 'Stock Alerts',
  analytics: 'Analytics', history: 'History Log', team: 'Team Hub',
  reconciliation: 'Cash Reconciliation', agents: 'AI Agents', settings: 'Control Center',
};

// --- ⚡ LAZY LOADED MODULES ---
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

// --- 🧩 SUB-COMPONENTS ---
const NavItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active?: boolean, onClick: () => void }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-primary",
      active ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 font-black" 
             : "text-muted-foreground hover:bg-accent hover:text-foreground font-bold"
    )}
  >
    <Icon className={cn("h-5 w-5 shrink-0 transition-transform duration-300", active ? "scale-110" : "group-hover:scale-110")} />
    <span className="text-sm tracking-wide">{label}</span>
  </button>
);

// --- 🚀 MAIN LAYOUT ---
export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = location.pathname.substring(1) || 'dashboard';

  // 📦 Global State
  const { user, forceTokenRefresh, clearSession } = useAuthStore();
  const { 
    shop, shopId, theme, setTheme, role, currentStaff, 
    sidebarOpen, setSidebarOpen, upsertStaff, logout 
  } = useBusinessStore(useShallow(state => ({
    shop: state.shop, shopId: state.shopId, theme: state.theme, setTheme: state.setTheme,
    role: state.role, currentStaff: state.currentStaff,
    sidebarOpen: state.sidebarOpen, setSidebarOpen: state.setSidebarOpen,
    upsertStaff: state.upsertStaff, logout: state.logout
  })));

  // 📊 Local Database Queries
  const sales = useSqlQuery<Sale>('SELECT * FROM sales WHERE tombstone = 0 AND date = ?', [new Date().toISOString().split('T')[0]], ['sales']);
  const criticalStockItems = useSqlQuery<InventoryItem>(
    'SELECT * FROM inventory WHERE tombstone = 0 AND stock <= 5 ORDER BY stock ASC, name ASC LIMIT 12',
    [],
    ['inventory']
  );
  const criticalStockCountRows = useSqlQuery<{ total: number }>(
    'SELECT COUNT(*) as total FROM inventory WHERE tombstone = 0 AND stock <= 5',
    [],
    ['inventory']
  );
  const criticalStockCount = Number(criticalStockCountRows[0]?.total ?? 0);
  const hasMoreCriticalStock = criticalStockCount > criticalStockItems.length;
  
  const todayRevenue = sales.reduce((sum, s) => sum + s.total, 0);

  // 🔒 Permissions
  const canViewProfit = usePermission('sales', 'view_profit');
  const canViewAnalytics = usePermission('analytics', 'view');

  // 🎛️ UI State
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  
  // 🔐 PIN State
  const [pinEntry, setPinEntry] = useState('');
  const [pinErrorMsg, setPinErrorMsg] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // --- 🔄 LIFECYCLE & EVENT LISTENERS ---
  useEffect(() => {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    
    // 📱 Android/iOS System Integration
    const color = isDark ? '#000000' : '#ffffff';
    document.documentElement.style.backgroundColor = color;
    document.body.style.backgroundColor = color;

    // Sync Capacitor Status Bar if on native
    if (typeof window !== 'undefined' && (window as any).Capacitor) {
      import('@capacitor/status-bar').then(({ StatusBar }) => {
        StatusBar.setBackgroundColor({ color: color }).catch(() => {});
        StatusBar.setStyle({ style: isDark ? 'dark' : 'light' } as any).catch(() => {});
      });
    }
  }, [theme]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    document.body.style.touchAction = sidebarOpen ? 'none' : '';
    return () => { document.body.style.overflow = ''; document.body.style.touchAction = ''; };
  }, [sidebarOpen]);

  useEffect(() => {
    setSidebarOpen(false);
    setNotifOpen(false);
    setProfileOpen(false);
  }, [location.pathname, setSidebarOpen]);

  // --- 🛡️ OFFLINE-FIRST ADMIN HEALING ---
  useEffect(() => {
    const healAdmin = async () => {
      if (user && shopId && role === 'admin' && (!currentStaff || currentStaff.role !== 'admin')) {
        console.info("[Auto-Heal] Reconciling Master Admin record via Offline Engine...");
        try {
          await upsertStaff({
            id: user.uid,
            name: user.displayName || user.email?.split('@')[0] || 'Admin',
            email: user.email || '',
            phone: '-',
            role: 'admin',
            status: 'active',
            joinedAt: new Date().toISOString(),
            permissions: ADMIN_PERMISSION_TEMPLATE,
          });
        } catch (e) {
          console.error("[Auto-Heal] Offline synchronization failed:", e);
        }
      }
    };
    healAdmin();
  }, [role, shopId, user, currentStaff, upsertStaff]);

  // --- 🚦 ACCESS CONTROL ROUTER ---
  useEffect(() => {
    if (role === 'staff' && currentStaff?.permissions) {
      const p = currentStaff.permissions;
      const hasAccess = (tab: string) => {
        switch (tab) {
          case 'team': case 'agents': return true;
          case 'dashboard': return true;
          case 'analytics': return canViewAnalytics;
          case 'inventory': case 'stock-alerts': return !!p.inventory?.view;
          case 'sell': case 'history': return !!p.sales?.view;
          case 'customers': return !!p.customers?.view;
          case 'expenses': return !!p.expenses?.view;
          case 'settings': return !!p.settings?.view || !!p.settings?.edit;
          default: return false;
        }
      };

      if (!hasAccess(activeTab)) {
        const fallbackTab = NAV_ITEMS.find(item => hasAccess(item.id))?.id || 'dashboard';
        navigate(`/${fallbackTab}`, { replace: true });
      }
    }
  }, [role, currentStaff, activeTab, canViewAnalytics, navigate]);

  // --- 🔐 MASTER AUTH & HARDWARE INTEGRATION ---
  const handleLogout = async () => {
    logout();
    clearSession();
    await auth.signOut();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.location.href = '/';
  };

  const handleRoleSwitch = async (newRole: 'admin' | 'staff') => {
    const { setRole } = useBusinessStore.getState();
    setProfileOpen(false);

    if (newRole === 'staff') {
      setRole('staff', true);
      if (['settings', 'inventory', 'analytics', 'expenses', 'stock-alerts'].includes(activeTab)) {
        navigate('/dashboard', { replace: true });
      }
      return;
    }

    try {
      const result = await NativeBiometric.isAvailable();
      if (result.isAvailable) {
        const verified = await NativeBiometric.verifyIdentity({
          reason: "Authorize Administrative Uplink",
          title: "Security Clearance Required",
          subtitle: "Use hardware biometrics to unlock",
        }).catch(() => false);

        if (verified) {
          setRole('admin', false);
          return;
        }
      }
    } catch (e) {
      console.warn('[Biometrics] Hardware unavailable, bridging to manual PIN.');
    }
    
    setShowUnlockModal(true);
  };

  // --- ⌨️ KEYBOARD SHORTCUTS ---
  useEffect(() => {
    if (!showUnlockModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Guard against interfering with other form inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key >= '0' && e.key <= '9') {
        const num = e.key;
        setPinEntry(prev => {
          const next = prev + num;
          if (next.length === 4) verifyAdminPin(next);
          return next.slice(0, 4);
        });
        setPinErrorMsg('');
      }
      if (e.key === 'Backspace') setPinEntry(prev => prev.slice(0, -1));
      if (e.key === 'Escape') setShowUnlockModal(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showUnlockModal]);

  const verifyAdminPin = async (code: string) => {
    setPinLoading(true);
    try {
      if (!shopId) throw new Error("Workspace isolated.");
      await verifyAdminPinCode(code, shopId);
      
      useBusinessStore.getState().setRole('admin', false);
      
      try {
        await forceTokenRefresh(); // Instantly apply JWT claims
      } catch (e) {
        console.warn("JWT sync delayed, relying on local state temporarily.");
      }

      setShowUnlockModal(false);
      setPinEntry('');
      navigate('/settings');

    } catch (err: any) {
      if (err.message?.includes("not initialized") || err.code === 'not-found') {
        setPinErrorMsg("Vault uninitialized. Redirecting to initialization sequence...");
        setTimeout(() => {
          setShowUnlockModal(false);
          setPinEntry('');
          useBusinessStore.getState().setRole('admin'); 
          navigate('/settings');
        }, 2000);
      } else {
        setPinErrorMsg(err.message || 'Decryption Failure');
        setPinEntry('');
      }
    } finally {
      setPinLoading(false);
    }
  };

  // --- 🎨 RENDER ---
  return (
    <div className="flex h-[100dvh] w-full bg-background text-foreground selection:bg-primary/30 overflow-hidden font-sans">
      
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden animate-in fade-in duration-300" onClick={() => setSidebarOpen(false)} />
      )}

      {/* 🚀 SIDEBAR */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-[100] w-64 bg-sidebar border-r border-border transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:z-auto no-print flex flex-col",
        sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      )}>
        <button 
          onClick={() => setSidebarOpen(false)}
          className="absolute right-4 top-4 h-10 w-10 bg-accent border border-border rounded-xl text-muted-foreground lg:hidden flex items-center justify-center hover:text-foreground transition-all z-[100]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="flex flex-col h-full p-4 overflow-y-auto no-scrollbar scroll-smooth">
          {/* Identity */}
          <div className="flex items-center gap-3 px-2 mb-8 mt-2 safe-area-top">
            <div className="h-10 w-10 bg-gradient-to-tr from-primary to-blue-600 rounded-xl flex items-center justify-center text-foreground shadow-[0_0_15px_rgba(var(--primary),0.3)] shrink-0">
              <Store className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-black text-foreground truncate">{shop.name}</h1>
              <p className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.2em] truncate">Zarra Ecosystem</p>
            </div>
          </div>

          {/* Navigation Matrix */}
          <nav className="flex-1 space-y-1.5">
            {NAV_ITEMS.map(item => {
              // Pre-render filtering
              if (role !== 'admin' && !currentStaff?.permissions) return null;
              if (role !== 'admin') {
                const p = currentStaff?.permissions;
                if (!p) return null;
                const tid = item.id;
                const hasPerm = (tid === 'team' || tid === 'agents') || 
                                (tid === 'dashboard') ||
                                (tid === 'analytics' && p.analytics?.view) ||
                                ((tid === 'inventory' || tid === 'stock-alerts') && p.inventory?.view) ||
                                ((tid === 'sell' || tid === 'history') && p.sales?.view) ||
                                (tid === 'customers' && p.customers?.view) ||
                                (tid === 'expenses' && p.expenses?.view);
                if (!hasPerm) return null;
              }

              const label = item.id === 'team' ? (role === 'admin' ? 'Team Hub' : 'My Terminal') : item.label;

              return (
                <NavItem key={item.id} icon={item.icon} label={label} active={activeTab === item.id} onClick={() => { navigate(`/${item.id}`); setSidebarOpen(false); }} />
              );
            })}
          </nav>

          {/* Bottom Settings */}
          <div className="pt-4 border-t border-border space-y-1.5 mt-4">
            {(role === 'admin' || currentStaff?.permissions?.settings?.view || currentStaff?.permissions?.settings?.edit) && (
              <NavItem icon={SettingsIcon} label="System Config" active={activeTab === 'settings'} onClick={() => { navigate('/settings'); setSidebarOpen(false); }} />
            )}
            
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition-all group"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span className="font-bold text-sm">Switch Optics</span>
            </button>

            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-all group">
              <LogOut className="h-4 w-4 group-hover:scale-110 transition-transform" />
              <span className="font-bold text-sm">Terminate Session</span>
            </button>
          </div>
        </div>
      </aside>

      {/* 🖥️ MAIN VIEWPORT */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        <header className="shrink-0 flex items-center justify-between px-6 border-b border-border bg-background/80 backdrop-blur-xl z-30 app-top-bar pb-4 pt-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="p-2.5 bg-accent hover:bg-accent rounded-xl transition-all border border-border lg:hidden">
              <Menu className="h-5 w-5 text-foreground" />
            </button>
            <span className="hidden sm:block text-xs font-black text-muted-foreground uppercase tracking-[0.25em] ml-2">
              {PAGE_TITLES[activeTab] ?? 'Operation UI'}
            </span>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            {canViewProfit && (
              <div className="hidden md:flex items-center gap-3 bg-accent px-4 py-2 rounded-xl border border-border">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <div>
                  <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest leading-none">Gross Pulse</p>
                  <p className="text-sm font-black text-foreground">{formatCurrency(todayRevenue)}</p>
                </div>
              </div>
            )}

            {/* Notification Node */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
                className={cn("relative p-2.5 rounded-xl transition-all border border-transparent", notifOpen ? "bg-primary/10 text-primary border-primary/20" : "bg-accent hover:bg-accent text-muted-foreground border-border")}
              >
                <Bell className={cn("h-4 w-4", notifOpen && "animate-pulse")} />
                {criticalStockCount > 0 && <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 ring-4 ring-background" />}
              </button>

              {notifOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Dismiss notifications"
                    className="fixed inset-0 z-[95] bg-background/70 backdrop-blur-sm md:hidden"
                    onClick={() => setNotifOpen(false)}
                  />
                  <div className="fixed inset-x-4 top-24 bottom-4 z-[100] md:absolute md:inset-x-auto md:top-full md:bottom-auto md:right-0 md:mt-3 md:w-80">
                    <div className="flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95 duration-200 md:h-auto">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">System Alerts</h3>
                        <span className="whitespace-nowrap rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] font-black text-red-500">
                          {criticalStockCount} Critical
                        </span>
                      </div>

                      <div className="flex-1 space-y-2 overflow-y-auto no-scrollbar md:max-h-[300px]">
                        {criticalStockCount === 0 ? (
                          <p className="py-6 text-center text-xs font-medium text-muted-foreground">All telemetry nominal.</p>
                        ) : (
                          criticalStockItems.map(item => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => { navigate('/stock-alerts'); setNotifOpen(false); }}
                              className="w-full rounded-xl border border-border bg-accent p-3 text-left transition-all hover:bg-accent"
                            >
                              <div className="flex items-center gap-3">
                                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-bold text-foreground">{item.name}</p>
                                  <p className="text-[10px] font-medium text-red-400/80">Stock Remaining: {item.stock}</p>
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>

                      {criticalStockCount > 0 && (
                        <div className="mt-4 border-t border-border/80 pt-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                              {hasMoreCriticalStock
                                ? `Showing ${criticalStockItems.length} of ${criticalStockCount}`
                                : `${criticalStockCount} active alert${criticalStockCount === 1 ? '' : 's'}`}
                            </p>
                            <button
                              type="button"
                              onClick={() => { navigate('/stock-alerts'); setNotifOpen(false); }}
                              className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-primary transition-all hover:bg-primary/15"
                            >
                              Open Alerts
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 🌓 Optics Switch */}
            <div className="flex items-center gap-1.5 p-1 bg-accent/50 rounded-2xl border border-border">
              <button 
                onClick={() => setTheme('light')} 
                className={cn(
                  "p-2 rounded-xl transition-all",
                  theme === 'light' ? "bg-card text-amber-500 shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Sun className="h-4 w-4" />
              </button>
              <button 
                onClick={() => setTheme('dark')} 
                className={cn(
                  "p-2 rounded-xl transition-all",
                  theme === 'dark' ? "bg-card text-primary shadow-neon-primary border border-border" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Moon className="h-4 w-4" />
              </button>
            </div>

            {/* Profile Node */}
            <div className="relative flex items-center gap-2" ref={profileRef}>


              <button onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }} className={cn("h-10 w-10 rounded-xl bg-accent border flex items-center justify-center transition-all", profileOpen ? "border-primary text-primary" : "border-border text-foreground hover:border-foreground/20")}>
                <span className="text-sm font-black">{shop?.name?.charAt(0) || 'X'}</span>
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-3 w-64 bg-card rounded-[1.5rem] p-3 shadow-2xl animate-in zoom-in-95 duration-200 z-[100] border border-border">
                  <div className="p-3 mb-2 border-b border-border">
                     <p className="text-sm font-black text-foreground truncate">{shop.name}</p>
                     <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">{role} Authorization</p>
                  </div>
                  
                  <div className="space-y-1">
                    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-all text-xs font-bold">
                      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} Toggle Optics
                    </button>
                    
                    {role === 'admin' ? (
                      <button onClick={() => handleRoleSwitch('staff')} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-amber-500/10 text-muted-foreground hover:text-amber-500 transition-all text-xs font-bold">
                        <Lock className="h-4 w-4" /> Downgrade to Staff
                      </button>
                    ) : (
                      <button onClick={() => handleRoleSwitch('admin')} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all text-xs font-bold">
                        <ShieldCheck className="h-4 w-4" /> Uplink Admin Rights
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 🔐 HARDWARE UNLOCK MODAL */}
        {showUnlockModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowUnlockModal(false)} />
            <div className="relative z-10 w-full max-w-sm bg-card border border-border rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
              
              {pinLoading && (
                <div className="absolute inset-0 bg-card/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-[2.5rem]">
                  <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">Decrypting Hash...</p>
                </div>
              )}

              <div className="text-center mb-8">
                <ShieldCheck className="h-10 w-10 text-foreground mx-auto mb-4 opacity-80" />
                <h2 className="text-xl font-black text-foreground">Security Bypass</h2>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Input Sequence</p>
              </div>

              <div className="flex justify-center gap-4 mb-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className={cn("h-3 w-3 rounded-full border transition-all duration-300", 
                    pinEntry.length > i ? 'bg-primary border-primary shadow-[0_0_15px_rgba(var(--primary),0.5)]' 
                    : pinErrorMsg ? 'border-destructive/50 animate-shake' : 'border-border'
                  )} />
                ))}
              </div>

              {pinErrorMsg && <p className="text-center text-[10px] text-red-500 mb-6 font-black uppercase tracking-widest animate-pulse">{pinErrorMsg}</p>}

              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <button key={num} onClick={() => { setPinEntry(p => { const next = p.length < 4 ? p + num : p; if(next.length === 4) verifyAdminPin(next); return next; }); setPinErrorMsg(''); }} className="h-14 rounded-2xl bg-accent hover:bg-accent text-lg font-black text-foreground transition-all active:scale-95 border border-border">{num}</button>
                ))}
                <button onClick={() => handleRoleSwitch('admin')} className="h-14 rounded-2xl bg-accent flex items-center justify-center text-primary hover:bg-primary/10 transition-all border border-transparent"><Fingerprint className="h-5 w-5" /></button>
                <button onClick={() => { setPinEntry(p => { const next = p.length < 4 ? p + '0' : p; if(next.length === 4) verifyAdminPin(next); return next; }); setPinErrorMsg(''); }} className="h-14 rounded-2xl bg-accent hover:bg-accent text-lg font-black text-foreground transition-all active:scale-95 border border-border">0</button>
                <button onClick={() => setPinEntry(p => p.slice(0, -1))} className="h-14 rounded-2xl bg-accent flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all border border-transparent"><Delete className="h-5 w-5" /></button>
              </div>
            </div>
          </div>
        )}

        {/* 🗺️ ROUTING ENGINE */}
        <div className="flex-1 overflow-y-auto no-scrollbar no-print relative">
          <div className="max-w-7xl mx-auto p-4 md:p-8 pt-6">
            <Suspense fallback={
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background z-50">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mounting Subsystem...</p>
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
                <Route path="*" element={<div className="text-muted-foreground text-center py-20 font-black uppercase tracking-widest">Sector Unmapped</div>} />
              </Routes>
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}
