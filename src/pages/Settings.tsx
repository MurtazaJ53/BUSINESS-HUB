import React, { useState, useRef, useEffect } from 'react';
import { 
  Settings as SettingsIcon, Download, FileSpreadsheet, AlertTriangle,
  Database, Store, Monitor, CheckCircle2, Key,
  Sun, Moon, RefreshCcw, LogOut, MapPin, TrendingUp, Lock, ShieldCheck,
  ArrowRight, ShieldAlert, Fingerprint, Loader2, Archive, Clock3, Trash2, HardDriveDownload
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, functions } from '@/lib/firebase';
import { useLiveQuery, useSqlQuery, useSalesQuery } from '@/db/hooks';
import { useBusinessStore } from '@/lib/useBusinessStore';
import { useAuthStore } from '@/lib/useAuthStore';
import { downloadFile, convertToCSV, exportSalesReport, generateGSTR1, generateGSTR3B } from '@/lib/exportUtils';
import { formatCurrency, cn, isValidIndianPhone, sanitizePhone } from '@/lib/utils';
import { usePermission } from '@/hooks/usePermission';
import ConfirmDialog from '@/components/ConfirmDialog';
import { MigrationResult } from '@/lib/migrationEngine';
import { InventoryItem, Sale, Customer } from '@/lib/types';
import {
  createBackup,
  deleteBackup,
  getBackupPayload,
  getBackupSettings,
  listBackups,
  saveBackupSettings,
  type BackupRecord,
  type BackupSettings,
} from '@/lib/backup';

const SectionHeader = ({ icon: Icon, title, subtitle }: { icon: any, title: string, subtitle?: string }) => (
  <div className="flex items-center gap-4 mb-6 animate-in fade-in slide-in-from-left-4">
    <div className="h-10 w-10 bg-accent border border-border rounded-xl flex items-center justify-center shadow-sm">
      <Icon className="h-5 w-5 text-primary" />
    </div>
    <div>
      <h3 className="text-xl font-black tracking-tight text-foreground">{title}</h3>
      {subtitle && <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{subtitle}</p>}
    </div>
  </div>
);

export default function Settings() {
  const navigate = useNavigate();
  const { shop, updateShop, clearInventory, theme, setTheme, addInventoryItem, upsertCustomer, addSale, lastBackupDate } = useBusinessStore();
  const { role, user } = useAuthStore();
  
  const canEditSettings = usePermission('settings', 'edit') || role === 'admin';
  const canViewInventoryCost = usePermission('inventory', 'view_cost') || role === 'admin';
  
  const inventory = useSqlQuery<InventoryItem>('SELECT * FROM inventory WHERE tombstone = 0 ORDER BY name ASC', [], ['inventory']);
  const inventoryPrivate = useSqlQuery<any>('SELECT * FROM inventory_private WHERE tombstone = 0', [], ['inventory_private']);
  const sales = useSalesQuery();
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
  const [backupSettings, setBackupSettings] = useState<BackupSettings>({ enabled: true, scheduledTime: '18:00', retentionCount: 14 });
  const [savingBackupSettings, setSavingBackupSettings] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [deletingBackupId, setDeletingBackupId] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({ ...shop });
  const backups = useLiveQuery<BackupRecord>(() => listBackups(), ['local_backups']);

  useEffect(() => setEditForm({ ...shop }), [shop]);
  useEffect(() => {
    void getBackupSettings().then(setBackupSettings);
  }, []);

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
      setNewAdminPin(''); setOldAdminPin('');
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
      showToast(`Security Link dispatched to ${user.email}`);
    } catch (err: any) {
      showToast(`Security Error: ${err.message}`);
    }
  };

  const handleInventoryCSV = () => {
    setExporting('inv-csv');
    const csvData = inventory.map((i: InventoryItem) => {
      const privateData = canViewInventoryCost ? inventoryPrivate.find((pi: any) => pi.id === i.id) : null;
      return { Name: i.name, SKU: i.sku || 'N/A', Category: i.category, CostPrice: privateData?.costPrice || 0, SellPrice: i.price, Stock: i.stock ?? 0, AddedOn: i.createdAt };
    });
    downloadFile(convertToCSV(csvData), `Zarra_Inventory_Master_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
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
      await Promise.all(migrationData.validItems.map(async (item, idx) => {
        const idTs = Date.now();
        if (migrationData.type === 'inventory') await addInventoryItem({ id: `inv-${idTs}-${idx}`, ...item, createdAt: new Date().toISOString() });
        else if (migrationData.type === 'customer') await upsertCustomer({ id: `cust-${idTs}-${idx}`, name: item.name, phone: item.phone, balance: item.balance, totalSpent: item.totalSpent, createdAt: new Date().toISOString() });
        else if (migrationData.type === 'sale') await addSale({ id: `sale-${idTs}-${idx}`, ...item, status: 'COMPLETED' });
        count++;
      }));
      showToast(`Migration Complete: ${count} ${migrationData.type}s injected.`);
    } catch (e: any) {
      showToast(`Partial Failure: ${count} injected. Error: ${e.message}`);
    }
    setMigrationData(null); setMigrationStatus(null);
  };

  const handleSaveBackupSettings = async () => {
    setSavingBackupSettings(true);
    try {
      await saveBackupSettings(backupSettings);
      showToast('Backup schedule updated');
    } catch (error: any) {
      showToast(`Backup schedule failed: ${error.message}`);
    } finally {
      setSavingBackupSettings(false);
    }
  };

  const handleManualBackup = async () => {
    setBackupBusy(true);
    try {
      const backup = await createBackup('manual');
      showToast(`Backup stored: ${backup.label}`);
    } catch (error: any) {
      showToast(`Backup failed: ${error.message}`);
    } finally {
      setBackupBusy(false);
    }
  };

  const handleDownloadBackup = async (backupId: string, backupLabel: string) => {
    try {
      const payload = await getBackupPayload(backupId);
      if (!payload) throw new Error('Backup package not found.');
      const safeName = backupLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      downloadFile(payload, `${safeName}.json`, 'application/json');
    } catch (error: any) {
      showToast(`Download failed: ${error.message}`);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    setDeletingBackupId(backupId);
    try {
      await deleteBackup(backupId);
      showToast('Backup removed from local vault');
    } catch (error: any) {
      showToast(`Delete failed: ${error.message}`);
    } finally {
      setDeletingBackupId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in pb-24 font-sans min-h-screen text-foreground bg-background">
      
      {/* 🚀 Header */}
      <div className="flex items-end justify-between border-b border-border pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter drop-shadow-md">Command Center</h1>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] mt-2">System Configuration & Data Ops</p>
        </div>
        <div className="h-14 w-14 premium-gradient rounded-2xl flex items-center justify-center text-primary-foreground shadow-neon-primary">
          <SettingsIcon className="h-6 w-6 animate-[spin_10s_linear_infinite]" />
        </div>
      </div>

      {/* 🏢 Workspace Identity Card */}
      <div className="glass-card rounded-[2.5rem] p-8 relative overflow-hidden">
        <Store className="absolute -bottom-10 -right-10 h-64 w-64 text-foreground/[0.02] pointer-events-none" />
        
        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-center gap-6">
            <div className="h-20 w-20 rounded-[1.5rem] bg-accent border border-border flex items-center justify-center text-primary shadow-inner">
              <Store className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-center gap-4">
                <h2 className="text-3xl font-black tracking-tight">{shop.name}</h2>
                {canEditSettings && (
                  <button onClick={() => { setEditForm(shop); setEditOpen(true); }} className="px-4 py-1.5 bg-accent/50 text-muted-foreground hover:text-foreground rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-border hover:bg-accent">
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
            <div key={i} className="bg-accent/50 p-4 rounded-2xl border border-border">
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">{stat.label}</p>
              <p className={cn("text-xl font-black tracking-tighter", stat.highlight ? "text-primary" : "text-foreground")}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* --- LEFT COLUMN --- */}
        <div className="space-y-10">
          <section>
            <SectionHeader icon={Key} title="Account Security" subtitle="Login Credential Management" />
            <div className="glass-card rounded-[2rem] p-6 space-y-4">
              <div className="flex items-center justify-between p-4 bg-accent/50 rounded-2xl border border-border">
                <div>
                  <p className="text-sm font-bold text-foreground">Cryptographic Reset</p>
                  <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Dispatches a secure auth link to your email.</p>
                </div>
                <button onClick={handleSendPasswordReset} className="px-6 py-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-primary/20">
                  Trigger Reset
                </button>
              </div>
            </div>
          </section>

          <section>
            <SectionHeader icon={Monitor} title="Environment Interface" subtitle="UI Theme Configuration" />
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setTheme('light')} className={cn("p-6 rounded-[2.5rem] text-left transition-all border group", theme === 'light' ? 'bg-card border-primary shadow-lg' : 'bg-accent/30 border-border hover:bg-accent/80')}>
                <div className="flex justify-between mb-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500"><Sun className="h-5 w-5" /></div>
                  {theme === 'light' && <CheckCircle2 className="h-5 w-5 text-primary" />}
                </div>
                <p className={cn("text-xs font-black uppercase tracking-widest", theme === 'light' ? "text-foreground" : "text-muted-foreground")}>Daylight Protocol</p>
              </button>

              <button onClick={() => setTheme('dark')} className={cn("p-6 rounded-[2.5rem] text-left transition-all border group", theme === 'dark' ? 'bg-card border-primary shadow-neon-primary' : 'bg-accent/30 border-border hover:bg-accent/80')}>
                <div className="flex justify-between mb-4">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><Moon className="h-5 w-5" /></div>
                  {theme === 'dark' && <CheckCircle2 className="h-5 w-5 text-primary" />}
                </div>
                <p className={cn("text-xs font-black uppercase tracking-widest", theme === 'dark' ? "text-foreground" : "text-muted-foreground")}>Night Ops Mode</p>
              </button>
            </div>
          </section>

          <section className="glass-card rounded-[2.5rem] p-6 flex items-center justify-between">
             <div className="flex items-center gap-4">
                <img src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}&backgroundColor=transparent`} alt="avatar" className="h-12 w-12 rounded-full border border-border bg-accent" />
                <div>
                  <p className="text-sm font-black tracking-tight text-foreground">{user?.email}</p>
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">{role} Clearance</p>
                </div>
              </div>
              <button onClick={() => auth.signOut()} className="h-10 w-10 bg-destructive/10 hover:bg-destructive hover:text-primary-foreground text-destructive rounded-xl flex items-center justify-center transition-all border border-destructive/20 hover:shadow-neon-destructive">
                <LogOut className="h-4 w-4 ml-1" />
              </button>
          </section>
        </div>

        {/* --- RIGHT COLUMN --- */}
        <div className="space-y-10">
          <section>
            <SectionHeader icon={Archive} title="Backup Vault" subtitle="Daily Local Safety Snapshots" />
            <div className="glass-card rounded-[2.5rem] p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-border bg-accent/30 p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Last Backup</p>
                  <p className="text-sm font-black text-foreground">
                    {lastBackupDate ? new Date(lastBackupDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not yet created'}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-accent/30 p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Stored Copies</p>
                  <p className="text-2xl font-black text-primary">{backups.length}</p>
                </div>
                <div className="rounded-2xl border border-border bg-accent/30 p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Schedule</p>
                  <p className="text-sm font-black text-foreground">{backupSettings.enabled ? backupSettings.scheduledTime : 'Disabled'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Auto Daily Backup</label>
                  <button
                    onClick={() => setBackupSettings((prev) => ({ ...prev, enabled: !prev.enabled }))}
                    className={cn(
                      "w-full h-12 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all",
                      backupSettings.enabled
                        ? "bg-primary/10 text-primary border-primary/20"
                        : "bg-accent/40 text-muted-foreground border-border"
                    )}
                  >
                    {backupSettings.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Daily Time</label>
                  <input
                    type="time"
                    value={backupSettings.scheduledTime}
                    onChange={(e) => setBackupSettings((prev) => ({ ...prev, scheduledTime: e.target.value }))}
                    className="w-full h-12 rounded-2xl bg-accent/40 border border-border px-4 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Retention</label>
                  <select
                    value={backupSettings.retentionCount}
                    onChange={(e) => setBackupSettings((prev) => ({ ...prev, retentionCount: Number(e.target.value) }))}
                    className="w-full h-12 rounded-2xl bg-accent/40 border border-border px-4 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {[7, 14, 21, 30].map((days) => (
                      <option key={days} value={days}>Keep {days} backups</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleSaveBackupSettings}
                  disabled={savingBackupSettings}
                  className="flex-1 py-4 rounded-2xl bg-accent hover:bg-accent/80 border border-border text-[10px] font-black uppercase tracking-widest text-foreground transition-all disabled:opacity-60"
                >
                  {savingBackupSettings ? 'Saving...' : 'Save Backup Rules'}
                </button>
                <button
                  onClick={handleManualBackup}
                  disabled={backupBusy}
                  className="flex-1 py-4 rounded-2xl premium-gradient text-primary-foreground text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/20 disabled:opacity-60"
                >
                  {backupBusy ? 'Creating Backup...' : 'Backup Now'}
                </button>
              </div>

              <div className="rounded-[2rem] border border-border bg-accent/20 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Clock3 className="h-4 w-4 text-primary" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Local Backup History</p>
                </div>
                {backups.length === 0 ? (
                  <p className="text-sm text-muted-foreground font-medium">No local backups yet. Run your first snapshot now.</p>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {backups.slice(0, 12).map((backup) => (
                      <div key={backup.id} className="rounded-2xl border border-border bg-background/60 p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-black text-foreground truncate">{backup.label}</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">
                              {backup.trigger} - {(backup.sizeBytes / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDownloadBackup(backup.id, backup.label)}
                              className="h-10 w-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center"
                              title="Download backup package"
                            >
                              <HardDriveDownload className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteBackup(backup.id)}
                              disabled={deletingBackupId === backup.id}
                              className="h-10 w-10 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 flex items-center justify-center disabled:opacity-50"
                              title="Delete local backup"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section>
             <SectionHeader icon={Database} title="Data Telemetry" subtitle="Exports & Compliance" />
             <div className="glass-card rounded-[2.5rem] p-6 space-y-3">
                <button onClick={handleInventoryCSV} disabled={exporting === 'inv-csv'} className="w-full flex items-center justify-between p-4 bg-accent/50 hover:bg-accent rounded-2xl transition-all border border-border group">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500"><FileSpreadsheet className="h-4 w-4" /></div>
                    <div className="text-left"><p className="text-sm font-bold text-foreground group-hover:text-emerald-500 transition-colors">Asset Ledger (CSV)</p></div>
                  </div>
                  <Download className="h-4 w-4 text-muted-foreground group-hover:text-emerald-500" />
                </button>
                
                <button onClick={handleSalesCSV} disabled={exporting === 'sales-csv'} className="w-full flex items-center justify-between p-4 bg-accent/50 hover:bg-accent rounded-2xl transition-all border border-border group">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary"><RefreshCcw className="h-4 w-4" /></div>
                    <div className="text-left"><p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">Transaction History (CSV)</p></div>
                  </div>
                  <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                </button>

                <div className="grid grid-cols-2 gap-3 pt-3 mt-3 border-t border-border">
                   <button onClick={() => generateGSTR1(sales, shop.gst)} className="py-3 bg-accent/50 hover:bg-accent text-foreground rounded-xl border border-border text-[9px] font-black uppercase tracking-widest transition-all">Export GSTR-1</button>
                   <button onClick={() => generateGSTR3B(sales)} className="py-3 bg-accent/50 hover:bg-accent text-foreground rounded-xl border border-border text-[9px] font-black uppercase tracking-widest transition-all">Export GSTR-3B</button>
                </div>
             </div>
          </section>

          {canEditSettings && (
            <>
              <section>
                <SectionHeader icon={ShieldAlert} title="Security Node" subtitle="Access & Integrity Controls" />
                <div className="glass-card rounded-[2.5rem] p-6 border border-destructive/10 space-y-6">
                   <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-3">Master PIN Rotation</p>
                      <div className="flex gap-3">
                        <input type="password" maxLength={4} placeholder="Old PIN" className="w-1/3 bg-accent/50 border border-border rounded-xl px-4 py-3 text-center text-sm font-black tracking-[0.5em] focus:border-primary focus:ring-1 outline-none text-foreground transition-colors" value={oldAdminPin} onChange={e => setOldAdminPin(e.target.value.replace(/[^0-9]/g, ''))} />
                        <input type="password" maxLength={4} placeholder="New PIN" className="w-1/3 bg-accent/50 border border-border rounded-xl px-4 py-3 text-center text-sm font-black tracking-[0.5em] focus:border-primary focus:ring-1 outline-none text-foreground transition-colors" value={newAdminPin} onChange={e => setNewAdminPin(e.target.value.replace(/[^0-9]/g, ''))} />
                        <button onClick={handleRotatePin} disabled={pinRotating || newAdminPin.length < 4} className="w-1/3 bg-primary/10 hover:bg-primary/20 disabled:opacity-50 text-primary rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-primary/20">
                           {pinRotating ? 'Encrypting...' : 'Update'}
                        </button>
                      </div>
                   </div>

                   <div className="pt-6 border-t border-destructive/10">
                      <button onClick={() => setResetConfirmOpen(true)} className="w-full py-4 bg-destructive/5 hover:bg-destructive/10 text-destructive rounded-2xl border border-destructive/20 font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3">
                        <AlertTriangle className="h-4 w-4" /> Initialize Core Wipe
                      </button>
                   </div>
                </div>
              </section>

              <section>
                <SectionHeader icon={Lock} title="Credential Vault" subtitle="Recovery & Access Management" />
                <div className="glass-card rounded-[2.5rem] p-6 space-y-6">
                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Administrative Recovery Email</p>
                    <div className="flex gap-3">
                      <input type="email" placeholder="recovery@zarra.com" className="flex-1 bg-accent/50 border border-border rounded-xl px-4 py-3 text-sm focus:border-primary focus:ring-1 outline-none text-foreground transition-colors" value={recoveryEmail} onChange={e => setRecoveryEmail(e.target.value)} />
                      <button onClick={handleUpdateRecovery} disabled={updatingRecovery} className="px-6 bg-primary/10 hover:bg-primary/20 disabled:opacity-50 text-primary rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-primary/20">
                         {updatingRecovery ? 'Syncing...' : 'Commit'}
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-medium">This address receives PIN authorizations if standard biometrics fail.</p>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {/* --- INVISIBLE INPUTS & MODALS --- */}
      <input type="file" ref={fileInputRef} accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => handleFileUpload(e, importType)} />

      {editOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-md animate-in fade-in" onClick={() => setEditOpen(false)} />
          <div className="relative z-10 w-full max-w-lg bg-card border border-border rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <h2 className="text-2xl font-black text-foreground mb-6">Modify Parameters</h2>
            
            <div className="space-y-4 mb-8">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Workspace Designation</label>
                <input className="w-full bg-accent/50 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Contact Protocol (10 Digits)</label>
                <input maxLength={10} className={cn("w-full bg-accent/50 border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none transition-colors", editForm.phone && !isValidIndianPhone(editForm.phone) ? "border-destructive/50 focus:border-destructive" : "border-border focus:border-primary/50")} value={editForm.phone} onChange={e => setEditForm({...editForm, phone: sanitizePhone(e.target.value)})} placeholder="9876543210" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">GST Identifier</label>
                <input className="w-full bg-accent/50 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 uppercase transition-colors" value={editForm.gst} onChange={e => setEditForm({...editForm, gst: e.target.value})} />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setEditOpen(false)} className="flex-1 py-4 rounded-xl font-black text-[10px] bg-accent hover:bg-accent/80 border border-border transition-all uppercase tracking-widest text-muted-foreground">Abort</button>
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
    </div>
  );
}
