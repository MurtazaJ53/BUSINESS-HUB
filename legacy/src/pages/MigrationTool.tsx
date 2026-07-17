import React, { useState } from 'react';
import { 
  Database, 
  ShieldAlert, 
  CheckCircle2, 
  ArrowRight, 
  AlertTriangle,
  Loader2,
  Lock,
  Terminal,
  Activity
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { useBusinessStore } from '@/lib/useBusinessStore';
import { useAuthStore } from '@/lib/useAuthStore';
import { cn } from '@/lib/utils';

export default function MigrationTool() {
  // 📦 State
  const { shopId } = useBusinessStore();
  const { role } = useAuthStore();
  
  // 🎛️ UI Status
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [errorPayload, setErrorPayload] = useState<string | null>(null);

  // 🛡️ Security Check
  if (role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 animate-in fade-in">
        <div className="h-20 w-20 bg-red-500/10 border border-red-500/20 rounded-[2rem] flex items-center justify-center mb-6">
           <ShieldAlert className="h-8 w-8 text-red-500" />
        </div>
        <h1 className="text-3xl font-black tracking-tighter text-white">Clearance Denied</h1>
        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-3 max-w-sm">
          Only Level-4 Administrators may access the Vault Sequestration Terminal.
        </p>
      </div>
    );
  }

  // 📜 Log Appender
  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toISOString().split('T')[1].slice(0, 8)}] ${msg}`, ...prev].slice(0, 50));
  };

  // 🚀 Migration Controller
  const executeRemoteSequestration = async () => {
    if (!shopId) return;
    
    setStatus('running');
    setErrorPayload(null);
    setLogs([]);
    
    addLog("📡 Establishing secure tunnel to Serverless Engine...");
    addLog("🔐 Verifying authentication claims...");

    try {
      // 1. Invoke the Cloud Function
      const sequesterDataCall = httpsCallable(functions, 'adminSequesterData');
      
      addLog("⚡ Executing atomic batch migration on backend...");
      
      const result = await sequesterDataCall({ shopId });
      const { success, message, stats } = result.data as any;

      if (!success) {
        throw new Error(message || "Backend execution failed silently.");
      }

      // 2. Parse Results
      addLog(`✅ Shop PINs secured: ${stats.shopKeys ? 'Yes' : 'None found'}`);
      addLog(`✅ Payroll profiles isolated: ${stats.staffMigrated}`);
      addLog(`✅ Financial assets encrypted: ${stats.inventoryMigrated}`);
      addLog("✨ Core Data Sequestration Complete.");
      
      setStatus('success');

    } catch (err: any) {
      console.error('[Migration Error]', err);
      addLog("❌ CRITICAL: Operation aborted due to backend exception.");
      setErrorPayload(err.message || 'An unknown network error occurred.');
      setStatus('error');
    }
  };

  // 🎨 Render
  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20 font-sans text-zinc-300 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-white">Security Vault</h1>
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mt-2">Remote Sequestration Terminal</p>
        </div>
        <div className="bg-primary/5 border border-primary/20 px-4 py-3 rounded-2xl flex items-center gap-3 shadow-[0_0_20px_rgba(var(--primary),0.1)]">
          <Activity className="h-4 w-4 text-primary animate-pulse" />
          <p className="text-[9px] font-black text-primary uppercase tracking-widest">Admin Uplink Established</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        
        {/* Left Column: Action Card */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#0a0a0a] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
            
            {/* Background Icon */}
            <Lock className="absolute -bottom-10 -right-10 h-64 w-64 text-white/[0.02] pointer-events-none" />
            
            <div className="relative z-10">
              <div className="h-14 w-14 premium-gradient rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(var(--primary),0.3)] mb-6">
                <ShieldAlert className="h-6 w-6 text-white" />
              </div>
              
              <h2 className="text-2xl font-black text-white mb-3">Initialize Sequestration</h2>
              <p className="text-xs font-medium text-zinc-400 leading-relaxed mb-8">
                This utility triggers a server-side atomic batch process. It migrates exposed financial data (Salaries, PINs, Cost Prices) into restricted collections to prevent network interception by standard staff accounts.
              </p>
              
              <div className="space-y-4 mb-8 bg-[#141414] p-5 rounded-2xl border border-white/5">
                 <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="text-[11px] font-bold text-zinc-300">Server-Side Execution (Zero Data Loss)</span>
                 </div>
                 <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="text-[11px] font-bold text-zinc-300">Atomic Batches (Rollback Safe)</span>
                 </div>
                 <div className="flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <span className="text-[11px] font-bold text-zinc-300">Requires Stable Connection to Begin</span>
                 </div>
              </div>

              <button
                disabled={status === 'running' || status === 'success'}
                onClick={executeRemoteSequestration}
                className={cn(
                  "w-full py-5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.25em] transition-all flex items-center justify-center gap-3",
                  status === 'running' ? "bg-zinc-800 text-zinc-500" :
                  status === 'success' ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                  "premium-gradient text-white shadow-xl hover:scale-[1.02] active:scale-95"
                )}
              >
                {status === 'running' ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Remote Processing</>
                ) : status === 'success' ? (
                  <><CheckCircle2 className="h-4 w-4" /> Vault Secured</>
                ) : (
                  <>Execute Server Command <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Terminal Logs */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="bg-[#050505] p-6 rounded-[2.5rem] border border-white/5 flex-1 flex flex-col shadow-inner">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-6 flex items-center gap-3 px-2">
              <Terminal className="h-4 w-4 text-primary" />
              Backend Operation Stream
            </h3>
            
            <div className="flex-1 bg-black/50 rounded-2xl p-6 font-mono text-[11px] overflow-y-auto space-y-3 border border-white/5 relative min-h-[300px]">
              {logs.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center opacity-50">
                  <p className="text-zinc-600 italic flex items-center gap-2">
                    <span className="h-2 w-2 bg-zinc-600 rounded-full animate-ping" />
                    Awaiting execution command...
                  </p>
                </div>
              )}
              
              {logs.map((log, i) => (
                <div key={i} className={cn(
                  "animate-in fade-in slide-in-from-left-2 duration-300 leading-relaxed",
                  log.includes('✅') || log.includes('✨') ? "text-emerald-400" : 
                  log.includes('❌') ? "text-red-400 font-bold" : 
                  log.includes('⚡') ? "text-primary" :
                  "text-zinc-400"
                )}>
                  {log}
                </div>
              ))}
            </div>
            
            {/* Error Banner */}
            {errorPayload && (
              <div className="mt-6 p-5 rounded-2xl bg-red-500/10 border border-red-500/20 animate-in slide-in-from-bottom-2">
                <div className="flex items-center gap-3 mb-2 text-red-500">
                  <ShieldAlert className="h-4 w-4" />
                  <h4 className="text-[10px] font-black uppercase tracking-widest">Network / Execution Failure</h4>
                </div>
                <p className="text-xs font-bold text-red-400/80">{errorPayload}</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
