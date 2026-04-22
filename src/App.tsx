import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import { useUpdateCheck } from './hooks/useUpdateCheck';
import UpdateBanner from './components/UpdateBanner';
import { useAuthStore } from './lib/useAuthStore';
import { useBusinessStore } from './lib/useBusinessStore';
import AuthPage from './pages/Auth';
import { Sparkles } from 'lucide-react';
import { App as CapacitorApp } from '@capacitor/app';
import { usePushNotifications } from './hooks/usePushNotifications';

// Lazy load components outside the component to prevent re-creation
const Dashboard = React.lazy(() => import('@/pages/Dashboard'));
const Inventory = React.lazy(() => import('@/pages/Inventory'));
const POS = React.lazy(() => import('@/pages/POS'));
const Customers = React.lazy(() => import('@/pages/Customers'));
const History = React.lazy(() => import('@/pages/History'));
const Expenses = React.lazy(() => import('@/pages/Expenses'));
const StockAlerts = React.lazy(() => import('@/pages/StockAlerts'));
const Analytics = React.lazy(() => import('@/pages/Analytics'));
const Team = React.lazy(() => import('@/pages/Team'));
const Settings = React.lazy(() => import('@/pages/Settings'));
const MigrationTool = React.lazy(() => import('@/pages/MigrationTool'));

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, shopId, role, loading } = useAuthStore();
  const { initStore } = useBusinessStore();
  const { updateAvailable } = useUpdateCheck();
  const [showUpdate, setShowUpdate] = React.useState(true);

  usePushNotifications(shopId);

  useEffect(() => {
    const { initialize, cleanup } = useAuthStore.getState();
    initialize();
    return () => cleanup();
  }, []);

  useEffect(() => {
    const backListener = CapacitorApp.addListener('backButton', () => {
      if (location.pathname !== '/' && location.pathname !== '/dashboard') {
        navigate(-1);
      } else {
        CapacitorApp.exitApp();
      }
    });
    return () => {
      backListener.then((l: any) => l.remove());
    };
  }, [location, navigate]);

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
      <AppLayout />
    </>
  );
}
