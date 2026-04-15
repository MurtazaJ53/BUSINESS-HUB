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
  Activity,
  LogOut,
  Database,
  ExternalLink
} from 'lucide-react';
import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { useBusinessStore } from '@/lib/useBusinessStore';
import { formatCurrency } from '@/lib/utils';

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
  { id: 'pos', label: 'POS System', icon: ShoppingCart },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'expenses', label: 'Expenses', icon: TrendingUp },
  { id: 'stock-alerts', label: 'Stock Alerts', icon: AlertTriangle },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Command Center',
  inventory: 'Inventory',
  pos: 'POS System',
  customers: 'Customer Ledger',
  expenses: 'Expense Ledger',
  'stock-alerts': 'Stock Alerts',
  analytics: 'Analytics',
  history: 'History Log',
  settings: 'Control Center',
};
export default function AppLayout({ pages }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { sales, inventory, activeTab, setActiveTab, shop, theme, setTheme } = useBusinessStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  
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

  return (
    <div className="flex min-h-screen bg-background selection:bg-primary/30">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:z-auto no-print",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full p-4">
          {/* Logo */}
          <div className="flex items-center gap-3 px-2 mb-8 mt-2">
            <div className="h-10 w-10 premium-gradient rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/30">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight">Business Hub</h1>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Pro Edition</p>
            </div>
          </div>

          {/* Main nav */}
          <nav className="flex-1 space-y-1">
            {NAV_ITEMS.map(item => (
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
            <NavItem
              icon={Settings}
              label="Settings"
              active={activeTab === 'settings'}
              onClick={() => navigate('settings')}
            />
            {/* User badge */}
            <div className="flex items-center gap-3 px-4 py-3 mt-1">
              <div className="h-8 w-8 rounded-full premium-gradient shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">Shop Owner</p>
                <p className="text-[10px] text-muted-foreground truncate">admin@mybusiness.com</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-border bg-background/80 backdrop-blur-md z-30 no-print">
          {/* Hamburger (mobile) */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 hover:bg-accent rounded-lg transition-colors"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Page title (desktop) */}
          <span className="hidden md:block text-sm font-bold text-muted-foreground uppercase tracking-widest">
            {PAGE_TITLES[activeTab] ?? 'Business Hub'}
          </span>

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
            <div className="flex items-center gap-2 bg-accent/50 px-3 py-1.5 rounded-full border border-border" title="Today's Revenue">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-black">{formatCurrency(todayRevenue)}</span>
              <span className="text-[9px] text-muted-foreground uppercase font-bold">today</span>
            </div>
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
                  <span className="text-xs font-black">{shop.name.charAt(0)}</span>
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
                    <button 
                      onClick={() => { navigate('settings'); setProfileOpen(false); }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all group"
                    >
                      <Database className="h-4 w-4" />
                      <span className="text-xs font-bold">Quick Backup</span>
                    </button>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border/50">
                    <button 
                      onClick={() => window.location.reload()}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-all font-bold text-xs"
                    >
                      <LogOut className="h-4 w-4" />
                      Reload Session
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

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
