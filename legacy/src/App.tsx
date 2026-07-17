import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import { useUpdateCheck } from './hooks/useUpdateCheck';
import UpdateBanner from './components/UpdateBanner';
import { useAuthStore } from './lib/useAuthStore';
import { useBusinessStore } from './lib/useBusinessStore';
import AuthPage from './pages/Auth';
import { Sparkles, ShieldAlert } from 'lucide-react';
import { App as CapacitorApp } from '@capacitor/app';
import { usePushNotifications } from './hooks/usePushNotifications';
import { maybeRunScheduledBackup } from './lib/backup';
import { scheduleIdleWork } from './lib/idle';

const preloadDashboard = () => import('@/pages/Dashboard');
const preloadInventory = () => import('@/pages/Inventory');
const preloadPOS = () => import('@/pages/POS');

import { Database } from '@/db/sqlite';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, shopId, role, loading } = useAuthStore();
  const { initStore, dbReady, dbError } = useBusinessStore();
  const { updateAvailable } = useUpdateCheck();
  const [showUpdate, setShowUpdate] = React.useState(true);
  const [bootTakingTooLong, setBootTakingTooLong] = React.useState(false);

  usePushNotifications(shopId);

  useEffect(() => {
    const { initialize, cleanup } = useAuthStore.getState();
    initialize();
    return () => cleanup();
  }, []);

  useEffect(() => {
    let lastTime = 0;
    const backListener = CapacitorApp.addListener('backButton', () => {
      // 1. If we are on POS/Inventory and have a popup, closing should be handled by that component via Escape/State
      // 2. Standard navigation
      if (window.history.length > 1) {
        navigate(-1);
      } else if (location.pathname === '/' || location.pathname === '/dashboard') {
        const currentTime = new Date().getTime();
        if (currentTime - lastTime < 2000) {
          CapacitorApp.exitApp();
        } else {
          lastTime = currentTime;
          // You could show a toast here "Press again to exit"
        }
      } else {
        navigate('/dashboard');
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

  useEffect(() => {
    if (!user || !shopId) return;

    void preloadDashboard();

    const cancelDelayedPreload = scheduleIdleWork(() => {
      void preloadInventory();
      void preloadPOS();
    }, 3500, 9000);

    return () => cancelDelayedPreload();
  }, [user, shopId]);

  useEffect(() => {
    if (!shopId || !dbReady) return;

    let active = true;
    const checkBackup = async () => {
      try {
        if (!active) return;
        await maybeRunScheduledBackup();
      } catch (error) {
        console.error('[Backup Scheduler] Failed:', error);
      }
    };

    const cancelInitialBackupCheck = scheduleIdleWork(() => {
      void checkBackup();
    }, 6000, 12000);
    const intervalId = window.setInterval(() => {
      void checkBackup();
    }, 60000);

    return () => {
      active = false;
      cancelInitialBackupCheck();
      window.clearInterval(intervalId);
    };
  }, [shopId, dbReady]);

  useEffect(() => {
    if (!(loading || (shopId && !dbReady))) {
      setBootTakingTooLong(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setBootTakingTooLong(true);
    }, 8000);

    return () => window.clearTimeout(timer);
  }, [loading, shopId, dbReady]);

  // Handle DB Boot Failure
  if (dbError) {
    const isCspWasmError = /content security policy|csp|wasm-unsafe-eval|unsafe-eval/i.test(dbError);
    const isWasmError = dbError.toLowerCase().includes('webassembly') || dbError.includes('magic word');
    
    const handleEmergencyReset = async () => {
      if (isCspWasmError) {
        window.location.reload();
        return;
      }
      try {
        await Database.nuclearReset();
      } catch (e) {
        window.location.reload();
      }
    };

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-6">
          <div className="h-20 w-20 rounded-3xl bg-destructive/10 flex items-center justify-center text-destructive mx-auto shadow-2xl">
            <ShieldAlert className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black text-foreground uppercase tracking-tighter">Database Boot Error</h1>
            <p className="text-sm text-muted-foreground font-medium leading-relaxed">
              {isCspWasmError
                ? "The browser security policy blocked the secure vault engine. The server must allow WebAssembly before the app can boot."
                : isWasmError 
                ? "The secure vault's binary module is corrupted in your browser cache. A deep reset is required."
                : dbError}
              <br /><br />
              <span className="text-[10px] opacity-30">System v1.3.6 - (If visible, please reload once after recovery)</span>
            </p>
          </div>
          <div className="space-y-3">
            <button 
              onClick={handleEmergencyReset}
              className="w-full py-4 bg-destructive text-destructive-foreground rounded-2xl font-black text-[10px] uppercase tracking-widest hover:brightness-110 transition-all shadow-[0_0_20px_rgba(239,68,68,0.2)]"
            >
              {isCspWasmError ? 'Reload After Server Fix' : isWasmError ? 'Execute Emergency Reset' : 'Attempt System Recovery'}
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-accent text-muted-foreground rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-accent/80 transition-all font-sans"
            >
              Standard Reload
            </button>
          </div>
          {isWasmError && !isCspWasmError && (
             <p className="text-[9px] text-muted-foreground/60 uppercase tracking-widest font-bold">
               This will clear your local session but fix the loading loop.
             </p>
          )}
        </div>
      </div>
    );
  }

  if (loading || (shopId && !dbReady)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-primary animate-spin" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
            {!dbReady && shopId ? 'Booting Secure Vault...' : 'Initializing Hub...'}
          </p>
          {bootTakingTooLong && (
            <div className="max-w-sm space-y-3 animate-in fade-in">
              <p className="text-xs font-bold text-muted-foreground leading-relaxed">
                Startup is taking longer than expected on this device. If this does not recover shortly, reload the app.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="rounded-2xl bg-accent px-5 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-foreground transition-all hover:bg-accent/80"
              >
                Reload App
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // If not logged in OR logged in but no shop assigned yet
  if (!user || !shopId) {
    return <AuthPage />;
  }

  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-primary animate-spin" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Loading UI...</p>
        </div>
      </div>
    }>
      {updateAvailable && showUpdate && typeof window !== 'undefined' && 
       ((window as any).Capacitor?.getPlatform() === 'android' || (window as any).Capacitor?.getPlatform() === 'ios') && (
        <UpdateBanner 
          metadata={updateAvailable} 
          onClose={() => setShowUpdate(false)} 
        />
      )}
      <AppLayout />
    </React.Suspense>
  );
}
