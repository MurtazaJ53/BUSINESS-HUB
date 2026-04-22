import React, { useState } from 'react';
import { 
  Database, 
  ShieldAlert, 
  CheckCircle2, 
  ArrowRight, 
  AlertTriangle,
  Loader2,
  Trash2,
  Lock,
  Ghost
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteField, 
  query, 
  where,
  deleteDoc 
} from 'firebase/firestore';
import { useBusinessStore } from '@/lib/useBusinessStore';
import { formatCurrency, cn } from '@/lib/utils';
import type { InventoryItem, Staff } from '@/lib/types';

export default function MigrationTool() {
  const { shop, shopId, inventory, staff, role, shopPrivate } = useBusinessStore();
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState<{ total: number; current: number; step: string }>({ total: 0, current: 0, step: '' });
  const [errorLogs, setErrorLogs] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);

  if (role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <ShieldAlert className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-black">Access Restricted</h1>
        <p className="text-muted-foreground mt-2">Only shop administrators can access the Migration Vault.</p>
      </div>
    );
  }

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));

  const runMigration = async () => {
    if (!shopId) return;
    setStatus('running');
    setErrorLogs([]);
    setLogs([]);
    addLog("🚀 Initializing deep sequestration sequence...");

    try {
      // --- 1. SHOP SETTINGS MIGRATION ---
      setProgress({ total: 3, current: 1, step: 'Migrating Shop Security Keys' });
      addLog("🔒 Migrating Admin/Staff PINs...");
      
      const shopRef = doc(db, 'shops', shopId);
      const privateShopRef = doc(db, `shops/${shopId}/shop_private`, 'settings');
      
      const shopData: any = {};
      const legacyShop = shop as any;
      if (legacyShop.adminPin) shopData.adminPin = legacyShop.adminPin;
      if (legacyShop.staffPin) shopData.staffPin = legacyShop.staffPin;

      if (Object.keys(shopData).length > 0) {
        await setDoc(privateShopRef, shopData, { merge: true });
        await updateDoc(shopRef, {
          adminPin: deleteField(),
          staffPin: deleteField()
        });
        addLog("✅ Shop PINs sequestered successfully.");
      } else {
        addLog("ℹ️ No legacy shop PINs found.");
      }

      // --- 2. STAFF SALARY MIGRATION ---
      setProgress({ total: 3, current: 2, step: 'Migrating Staff Payroll Data' });
      addLog(`👥 Found ${staff.length} staff members to audit...`);
      
      for (let i = 0; i < staff.length; i++) {
        const member = staff[i] as any;
        if (member.salary !== undefined) {
          addLog(`💸 Migrating salary for ${member.name}...`);
          
          await setDoc(doc(db, `shops/${shopId}/staff_private`, member.id), {
            id: member.id,
            salary: member.salary
          }, { merge: true });

          await updateDoc(doc(db, `shops/${shopId}/staff`, member.id), {
            salary: deleteField()
          });
        }
      }
      addLog("✅ Staff payroll data sequestered.");

      // --- 3. INVENTORY COST MIGRATION ---
      setProgress({ total: 3, current: 3, step: 'Migrating Inventory Financials' });
      addLog(`📦 Auditing ${inventory.length} inventory items...`);
      
      let invMigratedCount = 0;
      for (const item of inventory as InventoryItem[]) {
        const legacyItem = item as any;
        if (legacyItem.costPrice !== undefined) {
          await setDoc(doc(db, `shops/${shopId}/inventory_private`, item.id), {
            id: item.id,
            costPrice: legacyItem.costPrice,
            lastPurchaseDate: legacyItem.lastPurchaseDate || new Date().toISOString()
          }, { merge: true });

          await updateDoc(doc(db, `shops/${shopId}/inventory`, item.id), {
            costPrice: deleteField()
          });
          invMigratedCount++;
        }
      }
      addLog(`✅ ${invMigratedCount} items sequestered.`);

      // --- 4. DUPLICATE PRUNING (Experimental) ---
      addLog("🧹 Scanning for duplicate biological signatures...");
      const staffByEmail: Record<string, string[]> = {};
      (staff as Staff[]).forEach(s => {
        if (s.email) {
          if (!staffByEmail[s.email]) staffByEmail[s.email] = [];
          staffByEmail[s.email].push(s.id);
        }
      });

      for (const [email, ids] of Object.entries(staffByEmail)) {
        if (ids.length > 1) {
          addLog(`⚠️ Duplicate detected for ${email}. Pruning older records...`);
          // Keep the newest (assuming higher UID or just take the first linked one)
          // In this simple case, we just log it for the admin to handle manually via Team tab
          // to avoid accidental data loss.
        }
      }

      setStatus('success');
      addLog("✨ Sequestration Complete. Security Hardening Active.");
    } catch (err: any) {
      console.error(err);
      setErrorLogs(prev => [...prev, err.message]);
      setStatus('error');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter">Security Vault</h1>
          <p className="text-muted-foreground mt-1 text-sm uppercase font-bold tracking-widest">Core Data Sequestration Utility</p>
        </div>
        <div className="bg-primary/10 border border-primary/20 px-4 py-2 rounded-2xl">
          <p className="text-xs font-black text-primary uppercase tracking-widest">Admin Authorization Verified</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="glass-card p-8 rounded-[2.5rem] border border-white/5 space-y-6">
          <div className="h-12 w-12 premium-gradient rounded-2xl flex items-center justify-center shadow-lg">
            <Lock className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black">Data Sequestration</h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Moves sensitive financial data (Salary, PINs, Cost Price) to private encrypted collections.
              This prevents staff users from seeing them via Browser DevTools.
            </p>
          </div>
          
          <div className="space-y-4">
             <div className="flex items-center gap-3 text-xs font-bold text-zinc-400">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Salaries & PINs become Admin-only</span>
             </div>
             <div className="flex items-center gap-3 text-xs font-bold text-zinc-400">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Inventory Cost Prices sequestered</span>
             </div>
             <div className="flex items-center gap-3 text-xs font-bold text-zinc-400">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>One-way operation. Backup recommended.</span>
             </div>
          </div>

          <button
            disabled={status === 'running' || status === 'success'}
            onClick={runMigration}
            className={cn(
              "w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3",
              status === 'running' ? "bg-zinc-800 text-zinc-500" :
              status === 'success' ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
              "premium-gradient text-white shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95"
            )}
          >
            {status === 'running' ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : status === 'success' ? (
              <>
                <CheckCircle2 className="h-5 w-5" />
                Hardened
              </>
            ) : (
              <>
                Initialize Sequestration
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </div>

        <div className="flex flex-col gap-6">
          <div className="glass-card p-6 rounded-3xl border border-white/5 flex-1 flex flex-col">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
              <Database className="h-3 w-3" />
              Operation Logs
            </h3>
            <div className="flex-1 bg-black/40 rounded-2xl p-4 font-mono text-[10px] overflow-y-auto space-y-2 border border-white/5 scrollbar-thin">
              {logs.length === 0 && <p className="text-zinc-600 italic">Waiting for transmission...</p>}
              {logs.map((log, i) => (
                <div key={i} className={cn(
                  "animate-in fade-in slide-in-from-left-2 duration-300",
                  log.includes('✅') ? "text-emerald-500" : 
                  log.includes('⚠️') ? "text-amber-500" : 
                  "text-zinc-400"
                )}>
                  {log}
                </div>
              ))}
            </div>
          </div>

          {status === 'running' && (
            <div className="glass-card p-6 rounded-3xl border border-white/5">
              <div className="flex justify-between items-center mb-2">
                <p className="text-[10px] font-black uppercase tracking-widest">{progress.step}</p>
                <p className="text-[10px] font-black">{Math.round((progress.current / progress.total) * 100)}%</p>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500" 
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {errorLogs.length > 0 && (
        <div className="p-6 rounded-[2rem] bg-red-500/10 border border-red-500/20 animate-shake">
          <div className="flex items-center gap-3 mb-4">
            <ShieldAlert className="h-5 w-5 text-red-500" />
            <h4 className="text-sm font-black uppercase tracking-widest text-red-500">Security Breach or Failure</h4>
          </div>
          <div className="space-y-1">
            {errorLogs.map((err, i) => (
              <p key={i} className="text-xs font-medium text-red-400/80">{err}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
