import React, { useEffect } from 'react';
import AppLayout from './components/AppLayout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import POS from './pages/POS';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import History from './pages/History';
import Customers from './pages/Customers';
import Expenses from './pages/Expenses';
import StockAlerts from './pages/StockAlerts';
import AuthPage from './pages/Auth';
import { useAuthStore } from './lib/useAuthStore';
import { useBusinessStore } from './lib/useBusinessStore';
import { Sparkles } from 'lucide-react';
import { App as CapacitorApp } from '@capacitor/app';
import { useUpdateCheck } from './hooks/useUpdateCheck';
import UpdateBanner from './components/UpdateBanner';

const PAGES: Record<string, React.ReactNode> = {
  dashboard: <Dashboard />,
  inventory: <Inventory />,
  sell: <POS />,
  analytics: <Analytics />,
  history: <History />,
  customers: <Customers />,
  expenses: <Expenses />,
  'stock-alerts': <StockAlerts />,
  settings: <Settings />,
};

export default function App() {
  const { user, shopId, role, loading, initialize } = useAuthStore();
  const { initStore } = useBusinessStore();
  const { updateAvailable } = useUpdateCheck();
  const [showUpdate, setShowUpdate] = React.useState(true);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    const backListener = CapacitorApp.addListener('backButton', () => {
      const { activeTab, setActiveTab } = useBusinessStore.getState();
      if (activeTab !== 'dashboard') {
        setActiveTab('dashboard');
      } else {
        CapacitorApp.exitApp();
      }
    });
    return () => {
      backListener.then((l: any) => l.remove());
    };
  }, []);

  useEffect(() => {
    if (shopId && role) {
      const unsub = initStore(shopId, role);
      return () => unsub();
    }
  }, [shopId, role, initStore]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-primary animate-spin" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Initializing Hub...</p>
        </div>
      </div>
    );
  }

  // If not logged in OR logged in but no shop assigned yet
  if (!user || !shopId) {
    return <AuthPage />;
  }

  return (
    <>
      {updateAvailable && showUpdate && (
        <UpdateBanner 
          metadata={updateAvailable} 
          onClose={() => setShowUpdate(false)} 
        />
      )}
      <AppLayout pages={PAGES} />
    </>
  );
}
