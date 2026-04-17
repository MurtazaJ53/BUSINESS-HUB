import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  BarChart3, 
  Settings, 
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
  ChevronLeft
} from 'lucide-react';
import { useRef } from 'react';
import { useBusinessStore } from '@/lib/useBusinessStore';
import { formatCurrency, cn } from '@/lib/utils';

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

interface AppLayoutProps {
  pages: Record<string, React.ReactNode>;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'sell', label: 'Sales Hub', icon: ShoppingCart },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'expenses', label: 'Expenses', icon: TrendingUp },
  { id: 'stock-alerts', label: 'Stock Alerts', icon: AlertTriangle },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
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
  settings: 'Control Center',
};
export default function AppLayout({ pages }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { sales, inventory, activeTab, setActiveTab, shop, theme, setTheme, role } = useBusinessStore();
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

  // Low stock notifications
  const lowStockItems = inventory.filter(p => p.stock !== undefined && p.stock <= 5);

  // Today's revenue from real sales data
  const today = new Date().toISOString().split('T')[0];
  const todayRevenue = sales
    .filter((s) => s.date === today)
    .reduce((sum, s) => sum + s.total, 0);

  const navigate = (tab: string) => {
    setActiveTab(tab);
    setSidebarOpen(false); // close mobile sidebar on nav
  };

  const handleLogout = () => {
    const { logout } = useBusinessStore.getState();
    logout();
  };

  const handleRoleSwitch = (newRole: 'admin' | 'staff') => {
    const { setRole } = useBusinessStore.getState();
    if (newRole === 'staff') {
      setRole('staff');
      setProfileOpen(false);
    } else {
      setShowUnlockModal(true);
      setProfileOpen(false);
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

  const verifyAdminPin = (code: string) => {
    setPinLoading(true);
    setTimeout(() => {
      if (code === shop.adminPin) {
        useBusinessStore.getState().setRole('admin');
        setShowUnlockModal(false);
        setPinEntry('');
      } else {
        setPinError(true);
        setPinEntry('');
      }
      setPinLoading(false);
    }, 600);
  };

  return (
    <div className="flex h-[100dvh] w-full bg-background selection:bg-primary/30 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-[60] w-64 bg-card border-r border-border transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:z-auto no-print shadow-2xl md:shadow-none",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Mobile Close Button */}
        <button 
          onClick={() => setSidebarOpen(false)}
          className="absolute right-4 top-4 p-2 bg-accent rounded-xl text-muted-foreground md:hidden flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-all z-[70]"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col h-full p-4">
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
                const { role } = useBusinessStore.getState();
                if (role === 'staff') {
                  const allowed = ['sell', 'history', 'customers', 'dashboard'];
                  return allowed.includes(item.id);
                }
                return true;
              })
              .map(item => (
                <NavItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  active={activeTab === item.id}
                  onClick={() => navigate(item.id)}
                />
              ))}
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

            {/* Back Button - Only if not on Dashboard */}
            {activeTab !== 'dashboard' && (
              <button
                onClick={() => setActiveTab('dashboard')}
                className="p-2 hover:bg-accent rounded-sm transition-all group ml-1"
                title="Go to Dashboard"
              >
                <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform opacity-60" />
              </button>
            )}

            <span className="hidden sm:block text-sm font-black text-muted-foreground uppercase tracking-[0.3em] ml-2">
              {PAGE_TITLES[activeTab] ?? 'Business Hub'}
            </span>
          </div>

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
            {/* Today's revenue badge */}
            <div className="flex items-center gap-2 bg-primary/5 px-4 py-2 rounded-2xl border border-primary/20" title="Today's Revenue">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-black text-foreground">{formatCurrency(todayRevenue)}</span>
              <span className="text-[9px] text-primary font-black uppercase tracking-widest">today</span>
            </div>

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
                      lowStockItems.map(item => (
                        <button 
                          key={item.id}
                          onClick={() => { navigate('inventory'); setNotifOpen(false); }}
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
                      onClick={() => navigate('analytics')}
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
                    
                    <button 
                      onClick={() => { navigate('settings'); setProfileOpen(false); }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all group"
                    >
                      <Settings className="h-4 w-4" />
                      <span className="text-xs font-bold">Shop Profile</span>
                    </button>
                    <button 
                      onClick={() => { navigate('analytics'); setProfileOpen(false); }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all group"
                    >
                      <Activity className="h-4 w-4" />
                      <span className="text-xs font-bold">Live Performance</span>
                    </button>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border/50">
                    <button 
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-all font-bold text-xs"
                    >
                      <LogOut className="h-4 w-4" />
                      Exit Application
                    </button>
                  </div>
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
            {pages[activeTab] ?? <div className="text-muted-foreground text-center py-20">Page not found</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
