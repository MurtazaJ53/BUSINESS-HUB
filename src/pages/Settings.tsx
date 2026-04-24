import React, { useState, useRef, useEffect } from 'react';
import { 
  Settings as SettingsIcon, Download, FileSpreadsheet, AlertTriangle,
  Database, Store, Monitor, CheckCircle2, Key,
  Sun, Moon, RefreshCcw, LogOut, MapPin, TrendingUp, Lock, ShieldCheck,
  ExternalLink, ChevronRight, AlertCircle, ShieldAlert
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, functions } from '@/lib/firebase';
import { useSqlQuery } from '@/db/hooks';
import { useBusinessStore } from '@/lib/useBusinessStore';
import { useAuthStore } from '@/lib/useAuthStore';
import { downloadFile, convertToCSV, exportSalesReport, generateGSTR1, generateGSTR3B } from '@/lib/exportUtils';
import { formatCurrency, cn, isValidIndianPhone, sanitizePhone } from '@/lib/utils';
import { usePermission } from '@/hooks/usePermission';
import ConfirmDialog from '@/components/ConfirmDialog';
import { MigrationResult } from '@/lib/migrationEngine';
import { InventoryItem, Sale, Customer } from '@/lib/types';

// --- 🛠️ MODULAR SUB-COMPONENTS ---

const SectionHeader = ({ icon: Icon, title, subtitle }: { icon: any, title: string, subtitle?: string }) => (
  <div className="flex items-center gap-4 mb-6 animate-in fade-in slide-in-from-left-4">
    <div className="h-10 w-10 bg-[#141414] border border-white/10 rounded-xl flex items-center justify-center shadow-lg shadow-black/50">
      <Icon className="h-5 w-5 text-primary" />
    </div>
    <div>
      <h3 className="text-xl font-black tracking-tight text-white">{title}</h3>
      {subtitle && <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{subtitle}</p>}
    </div>
  </div>
);

export default function Settings() {
  const navigate = useNavigate();
  const { shop, updateShop, clearInventory, theme, setTheme, setActiveTab, addInventoryItem, upsertCustomer, addSale, currentStaff } = useBusinessStore();
  const { role, user } = useAuthStore();
  
  const canEditSettings = usePermission('settings', 'edit') || role === 'admin';
  const canViewInventoryCost = usePermission('inventory', 'view_cost') || role === 'admin';
  
  const inventory = useSqlQuery<InventoryItem>('SELECT * FROM inventory WHERE tombstone = 0 ORDER BY name ASC', [], ['inventory']);
  const inventoryPrivate = useSqlQuery<any>('SELECT * FROM inventory_private WHERE tombstone = 0', [], ['inventory_private']);
  const sales = useSqlQuery<Sale>('SELECT * FROM sales WHERE tombstone = 0 ORDER BY createdAt DESC', [], ['sales']);
  const customers = useSqlQuery<Customer>('SELECT * FROM customers WHERE tombstone = 0 ORDER BY name ASC', [], ['customers']);

  const [toast, setToast] = useState('');
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  
  const [oldAdminPin, setOldAdminPin] = useState('');
  const [newAdminPin, setNewAdminPin] = useState('');
  const [pinRotating, setPinRotating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importType, setImportType] = useState<'inventory' | 'customer' | 'sale'>('inventory');
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);
  const [migrationData, setMigrationData] = useState<MigrationResult | null>(null);

  const [recoveryEmail, setRecoveryEmail] = useState(shop.recoveryEmail || '');
  const [updatingRecovery, setUpdatingRecovery] = useState(false);

  const [editForm, setEditForm] = useState({ ...shop });

  useEffect(() => {
    setEditForm({ ...shop });
  }, [shop]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const handleSaveShop = async () => {
    try {
      await updateShop(editForm);
      setEditOpen(false);
      showToast('Workspace Profile Synchronized');
    } catch (err: any) {
      showToast(`Sync Error: ${err.message}`);
    }
  };

  const handleRotatePin = async () => {
    if (newAdminPin.length < 4) return;
    setPinRotating(true);
    try {
      const { shopId } = useBusinessStore.getState();
      if (!shopId) throw new Error("Workspace Context Missing.");
      
      const setPin = httpsCallable(functions, 'setAdminPin');
      const result = await setPin({ oldPin: oldAdminPin, newPin: newAdminPin, shopId });
      
      if (!(result.data as any).success) throw new Error((result.data as any).error || "Encryption Failed.");
      
      showToast('Master Cryptographic PIN Rotated');
      setNewAdminPin('');
      setOldAdminPin('');
    } catch (err: any) {
      showToast(`Security Exception: ${err.message}`);
    } finally {
      setPinRotating(false);
    }
  };

  const handleUpdateRecovery = async () => {
    if (!recoveryEmail.includes('@')) return;
    setUpdatingRecovery(true);
    try {
      await updateShop({ ...shop, recoveryEmail });
      showToast('Recovery Infrastructure Updated');
    } catch (err: any) {
      showToast(`Update Failed: ${err.message}`);
    } finally {
      setUpdatingRecovery(false);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      showToast(`Security Email Sent to ${user.email}`);
    } catch (err: any) {
      showToast(`Security Error: ${err.message}`);
    }
  };

  const handleInventoryCSV = () => {
    setExporting('inv-csv');
    const csvData = inventory.map((i: InventoryItem) => {
      const privateData = canViewInventoryCost ? inventoryPrivate.find((pi: any) => pi.id === i.id) : null;
      return {
        Name: i.name, SKU: i.sku || 'N/A', Category: i.category,
        CostPrice: privateData?.costPrice || 0, SellPrice: i.price, Stock: i.stock ?? 0, AddedOn: i.createdAt
      };
    });
    downloadFile(convertToCSV(csvData), `Inventory_Master_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    setTimeout(() => setExporting(null), 1000);
  };

  const handleSalesCSV = () => {
    setExporting('sales-csv');
    exportSalesReport(sales);
    setTimeout(() => setExporting(null), 1000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'inventory' | 'customer' | 'sale') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setMigrationStatus(`Analyzing ${type} data matrix...`);
    const { parseGenericExcel } = await import('@/lib/migrationEngine');
    const result = await parseGenericExcel(file, type);
    
    if (!result.success || result.validItems.length === 0) {
      showToast(`Import Aborted: ${result.errors[0] || 'No valid records detected.'}`);
      setMigrationStatus(null);
    } else {
      setMigrationData(result);
      setMigrationStatus(null);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const executeMigration = async () => {
    if (!migrationData) return;
    setMigrationStatus(`Injecting ${migrationData.validItems.length} records...`);
    
    let count = 0;
    try {
      for (const item of migrationData.validItems) {
        if (migrationData.type === 'inventory') {
          await addInventoryItem({ id: `inv-${Date.now()}-${count}`, ...item, createdAt: new Date().toISOString() });
        } else if (migrationData.type === 'customer') {
          await upsertCustomer({ id: `cust-${Date.now()}-${count}`, name: item.name, phone: item.phone, balance: item.balance, totalSpent: item.totalSpent, createdAt: new Date().toISOString() });
        } else if (migrationData.type === 'sale') {
          await addSale({ id: `sale-${Date.now()}-${count}`, ...item, status: 'COMPLETED' });
        }
        count++;
      }
      showToast(`Migration Complete: ${count} ${migrationData.type}s injected.`);
    } catch (e: any) {
      showToast(`Partial Failure: ${count} injected. Error: ${e.message}`);
    }
    setMigrationData(null);
    setMigrationStatus(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in pb-24 font-sans min-h-screen text-foreground/80">
      
      <div className="flex items-end justify-between border-b border-border pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-foreground drop-shadow-md">Command Center</h1>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] mt-2">System Configuration & Data Ops</p>
        </div>
        <div className="h-14 w-14 bg-gradient-to-tr from-primary to-blue-600 rounded-2xl flex items-center justify-center text-white shadow-[0_0_30px_rgba(var(--primary),0.3)]">
          <SettingsIcon className="h-6 w-6 animate-[spin_10s_linear_infinite]" />
        </div>
      </div>

      <div className="bg-card rounded-[2rem] p-8 border border-border relative overflow-hidden shadow-2xl">
        <Store className="absolute -bottom-10 -right-10 h-64 w-64 text-foreground/[0.02] pointer-events-none" />
        
        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-center gap-6">
            <div className="h-20 w-20 rounded-[1.5rem] bg-accent/20 border border-border flex items-center justify-center text-primary shadow-inner">
              <Store className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-center gap-4">
                <h2 className="text-3xl font-black tracking-tight text-foreground">{shop.name}</h2>
                {canEditSettings && (
                  <button onClick={() => { setEditForm(shop); setEditOpen(true); }} className="px-4 py-1.5 bg-accent/50 text-foreground/70 hover:text-foreground rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-border hover:border-border/30 hover:bg-accent">
                    Modify Parameters
                  </button>
                )}
              </div>
              <p className="text-xs font-bold text-primary uppercase tracking-[0.25em] mt-1">{shop.tagline}</p>
              <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-2 font-medium">
                <MapPin className="h-3 w-3" /> {shop.address || 'Location Unspecified'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-8 mt-8 border-t border-border relative z-10">
          {[
            { label: 'Total Assets', value: inventory.length },
            { label: 'Transactions', value: sales.length },
            { label: 'Client Base', value: customers.length },
            { label: 'Gross Value', value: `₹${inventory.reduce((sum: number, i: InventoryItem) => sum + (i.price * (i.stock || 0)), 0).toLocaleString()}`, highlight: true },
            { label: 'Shift Duration', value: `${shop.standardWorkingHours || 9}H` }
          ].map((stat, i) => (
            <div key={i} className="bg-accent/10 p-4 rounded-2xl border border-border">
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">{stat.label}</p>
              <p className={cn("text-xl font-black tracking-tighter", stat.highlight ? "text-primary drop-shadow-[0_0_10px_rgba(var(--primary),0.5)]" : "text-foreground")}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="space-y-10">
          <section>
            <SectionHeader icon={Key} title="Account Security" subtitle="Login Credential Management" />
            <div className="bg-card rounded-[2rem] p-6 border border-border space-y-4">
              <div className="flex items-center justify-between p-4 bg-accent/10 rounded-2xl border border-border">
                <div>
                  <p className="text-sm font-bold text-foreground">Change Login Password</p>
                  <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Secure reset link will be sent to your email.</p>
                </div>
                <button 
                  onClick={handleSendPasswordReset}
                  className="px-6 py-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-black rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-primary/20"
                >
                  Trigger Reset
                </button>
              </div>
            </div>
          </section>

          <section>
            <SectionHeader icon={Monitor} title="Environment Interface" subtitle="UI Theme Configuration" />
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setTheme('light')} className={cn("p-6 rounded-[2rem] text-left transition-all border group", theme === 'light' ? 'bg-secondary border-primary shadow-xl' : 'bg-card border-border hover:bg-accent/40')}>
                <div className="flex justify-between mb-4">
                  <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500"><Sun className="h-5 w-5" /></div>
                  {theme === 'light' && <CheckCircle2 className="h-5 w-5 text-primary" />}
                </div>
                <p className={cn("text-xs font-black uppercase tracking-widest", theme === 'light' ? "text-foreground" : "text-muted-foreground")}>Daylight Protocol</p>
              </button>

              <button onClick={() => setTheme('dark')} className={cn("p-6 rounded-[2rem] text-left transition-all border group", theme === 'dark' ? 'bg-secondary border-primary shadow-xl' : 'bg-card border-border hover:bg-accent/40')}>
                <div className="flex justify-between mb-4">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500"><Moon className="h-5 w-5" /></div>
                  {theme === 'dark' && <CheckCircle2 className="h-5 w-5 text-primary" />}
                </div>
                <p className={cn("text-xs font-black uppercase tracking-widest", theme === 'dark' ? "text-foreground" : "text-muted-foreground")}>Night Ops Mode</p>
              </button>
            </div>
          </section>

          <section className="bg-card rounded-[2rem] p-6 border border-border flex items-center justify-between">
             <div className="flex items-center gap-4">
                <img src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}&backgroundColor=141414`} alt="avatar" className="h-12 w-12 rounded-full border border-border bg-accent/20" />
                <div>
                  <p className="text-sm font-black tracking-tight text-foreground">{user?.email}</p>
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">{role} Clearance</p>
                </div>
              </div>
              <button onClick={() => auth.signOut()} className="h-10 w-10 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 rounded-xl flex items-center justify-center transition-all border border-red-500/20">
                <LogOut className="h-4 w-4 ml-1" />
              </button>
          </section>
        </div>

        <div className="space-y-10">
          <section>
             <SectionHeader icon={Database} title="Data Telemetry" subtitle="Exports & Compliance" />
             <div className="bg-card rounded-[2rem] p-6 border border-border space-y-3">
                <button onClick={handleInventoryCSV} disabled={exporting === 'inv-csv'} className="w-full flex items-center justify-between p-4 bg-accent/10 hover:bg-accent/20 rounded-2xl transition-all border border-border group">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500"><FileSpreadsheet className="h-4 w-4" /></div>
                    <div className="text-left"><p className="text-sm font-bold text-foreground group-hover:text-emerald-400 transition-colors">Asset Ledger (CSV)</p></div>
                  </div>
                  <Download className="h-4 w-4 text-muted-foreground group-hover:text-emerald-400" />
                </button>
                
                <button onClick={handleSalesCSV} disabled={exporting === 'sales-csv'} className="w-full flex items-center justify-between p-4 bg-accent/10 hover:bg-accent/20 rounded-2xl transition-all border border-border group">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500"><RefreshCcw className="h-4 w-4" /></div>
                    <div className="text-left"><p className="text-sm font-bold text-foreground group-hover:text-blue-400 transition-colors">Transaction History (CSV)</p></div>
                  </div>
                  <Download className="h-4 w-4 text-muted-foreground group-hover:text-blue-400" />
                </button>

                <div className="grid grid-cols-2 gap-3 pt-3 mt-3 border-t border-border">
                   <button onClick={() => generateGSTR1(sales, shop.gst)} className="py-3 bg-accent/10 hover:bg-accent/20 text-foreground rounded-xl border border-border text-[9px] font-black uppercase tracking-widest transition-all">Export GSTR-1</button>
                   <button onClick={() => generateGSTR3B(sales)} className="py-3 bg-accent/10 hover:bg-accent/20 text-foreground rounded-xl border border-border text-[9px] font-black uppercase tracking-widest transition-all">Export GSTR-3B</button>
                </div>
             </div>
          </section>

          {canEditSettings && (
            <>
              <section>
                <SectionHeader icon={ShieldAlert} title="Security Node" subtitle="Access & Integrity Controls" />
                <div className="bg-card rounded-[2rem] p-6 border border-red-500/10 space-y-6">
                   <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-3">Master PIN Rotation</p>
                      <div className="flex gap-3">
                        <input type="password" maxLength={4} placeholder="Old PIN" className="w-1/3 bg-accent/20 border border-border rounded-xl px-4 py-3 text-center text-sm font-black tracking-[0.5em] focus:border-primary focus:ring-1 focus:ring-primary outline-none text-foreground" value={oldAdminPin} onChange={e => setOldAdminPin(e.target.value.replace(/[^0-9]/g, ''))} />
                        <input type="password" maxLength={4} placeholder="New PIN" className="w-1/3 bg-accent/20 border border-border rounded-xl px-4 py-3 text-center text-sm font-black tracking-[0.5em] focus:border-primary focus:ring-1 focus:ring-primary outline-none text-foreground" value={newAdminPin} onChange={e => setNewAdminPin(e.target.value.replace(/[^0-9]/g, ''))} />
                        <button onClick={handleRotatePin} disabled={pinRotating || newAdminPin.length < 4} className="w-1/3 bg-primary/10 hover:bg-primary/20 disabled:opacity-50 text-primary rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-primary/20">
                           {pinRotating ? 'Encrypting...' : 'Update'}
                        </button>
                      </div>
                   </div>

                   <div className="pt-6 border-t border-border">
                      <button onClick={() => setResetConfirmOpen(true)} className="w-full py-4 bg-red-500/5 hover:bg-red-500/20 text-red-500 rounded-2xl border border-red-500/20 font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3">
                        <AlertTriangle className="h-4 w-4" /> Initialize Core Wipe (Delete All Inventory)
                      </button>
                   </div>
                </div>
              </section>

              <section>
                <SectionHeader icon={Lock} title="Credential Vault" subtitle="Recovery & Access Management" />
                <div className="bg-card rounded-[2rem] p-6 border border-border space-y-6">
                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Administrative Recovery Email</p>
                    <div className="flex gap-3">
                      <input 
                        type="email" 
                        placeholder="recovery@zarra.com" 
                        className="flex-1 bg-accent/20 border border-border rounded-xl px-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none text-foreground" 
                        value={recoveryEmail} 
                        onChange={e => setRecoveryEmail(e.target.value)} 
                      />
                      <button onClick={handleUpdateRecovery} disabled={updatingRecovery} className="px-6 bg-primary/10 hover:bg-primary/20 disabled:opacity-50 text-primary rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-primary/20">
                         {updatingRecovery ? 'Syncing...' : 'Commit'}
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">This address will receive PIN reset authorizations if standard auth is bypassed.</p>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      <input type="file" ref={fileInputRef} accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => handleFileUpload(e, importType)} />

      {editOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditOpen(false)} />
          <div className="relative z-10 w-full max-w-lg bg-card border border-border rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <h2 className="text-2xl font-black text-foreground mb-6">Modify Parameters</h2>
            
            <div className="space-y-4 mb-8">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Workspace Designation</label>
                <input className="w-full bg-accent/20 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Contact Protocol (10 Digits)</label>
                <input maxLength={10} className={cn("w-full bg-accent/20 border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none transition-colors", editForm.phone && !isValidIndianPhone(editForm.phone) ? "border-red-500/50 focus:border-red-500" : "border-border focus:border-primary/50")} value={editForm.phone} onChange={e => setEditForm({...editForm, phone: sanitizePhone(e.target.value)})} placeholder="9876543210" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">GST Identifier</label>
                <input className="w-full bg-accent/20 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 uppercase transition-colors" value={editForm.gst} onChange={e => setEditForm({...editForm, gst: e.target.value})} />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setEditOpen(false)} className="flex-1 py-4 rounded-xl font-black text-[10px] bg-accent/20 hover:bg-accent/30 border border-border transition-all uppercase tracking-widest text-muted-foreground">Abort</button>
              <button onClick={handleSaveShop} disabled={editForm.phone.length !== 10 || !isValidIndianPhone(editForm.phone)} className="flex-1 py-4 rounded-xl font-black text-[10px] transition-all uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50">Commit Changes</button>
            </div>
          </div>
        </div>
      )}

      {migrationData && (
        <ConfirmDialog
          open={!!migrationData} title={`${migrationData.type.toUpperCase()} Analysis Complete`}
          description={`Neural engine mapping ready. ${migrationData.validItems.length} records verified. Inject into database?`}
          confirmText="Execute Injection" variant="danger"
          onConfirm={executeMigration} onClose={() => setMigrationData(null)}
        />
      )}

      <ConfirmDialog
        open={resetConfirmOpen} title="Initialize Core Wipe?"
        description="Warning: This action physically purges all inventory documents. Recovery is impossible. Proceed?"
        confirmText="Acknowledge Purge" variant="danger"
        onConfirm={async () => { await clearInventory(); setResetConfirmOpen(false); }}
        onClose={() => setResetConfirmOpen(false)}
      />

      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] animate-in slide-in-from-bottom-8 fade-in duration-300">
          <div className="bg-card border border-border text-foreground px-6 py-4 rounded-2xl shadow-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> {toast}
          </div>
        </div>
      )}
      <div className="mt-20 pt-10 border-t border-border text-center">
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.5em]">Release v1.3.3 • Patched Architecture</p>
      </div>
    </div>
  );
}
