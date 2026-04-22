import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Download, 
  FileSpreadsheet, 
  AlertTriangle,
  HardDrive,
  Database,
  Store,
  Monitor,
  CheckCircle2,
  Lock,
  ShieldCheck,
  Users,
  Sun,
  Moon,
  RefreshCcw,
  Sparkles,
  Building2,
  Smartphone,
  Mail,
  MapPin,
  Trash2,
  PlusCircle,
  RotateCcw,
  Building,
  AlertCircle,
  Upload,
  ArrowRight
} from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, setDoc, doc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import bcrypt from 'bcryptjs';
import { UserPlus, Ticket, LogOut, X, MessageCircle } from 'lucide-react';
import { useBusinessStore } from '@/lib/useBusinessStore';
import { downloadFile, convertToCSV, exportSalesReport } from '@/lib/exportUtils';
import { formatCurrency, cn, isValidIndianPhone, sanitizePhone } from '@/lib/utils';
import ConfirmDialog from '@/components/ConfirmDialog';
import { loadShopSettings } from '@/lib/shopSettings';
import { useAuthStore } from '@/lib/useAuthStore';
import { MigrationResult } from '@/lib/migrationEngine';
import { InventoryItem, Staff } from '@/lib/types';
import { sendStaffInvite } from '@/lib/mail';
import { shareInviteWhatsApp } from '@/lib/whatsapp';

export default function Settings() {
  const { 
    inventory, inventoryPrivate, sales, customers, shop, shopPrivate, updateShop, 
    clearInventory, theme, setTheme, shopId, setActiveTab,
    addInventoryItem, upsertCustomer, addSale, invitations 
  } = useBusinessStore();

  const { role, user } = useAuthStore();
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };
  
  // Migration State
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [importType, setImportType] = useState<'inventory' | 'customer' | 'sale'>('inventory');
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);
  const [migrationData, setMigrationData] = useState<MigrationResult | null>(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  
  const [editForm, setEditForm] = useState<any>({ 
    ...shop
  });
  const [newAdminPin, setNewAdminPin] = useState('');
  const [pinRotating, setPinRotating] = useState(false);

  // Sync editForm when shop or shopPrivate changes (e.g. on load)
  React.useEffect(() => {
    setEditForm({
      ...shop
    });
  }, [shop]);

  const handleSaveShop = async () => {
    try {
      await updateShop(editForm);
      setEditOpen(false);
      showToast('Profile Updated Successfully');
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleRotatePin = async () => {
    if (newAdminPin.length < 4) return;
    setPinRotating(true);
    try {
      const { shopId } = useBusinessStore.getState();
      if (!shopId) throw new Error("Shop ID not identified.");
      
      // 1. Hash locally
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(newAdminPin, salt);
      
      // 2. Save to private vault
      await setDoc(doc(db, `shops/${shopId}/private`, 'auth'), {
        adminPinHash: hash,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid
      }, { merge: true });
      
      showToast('Master PIN Updated Successfully');
      setNewAdminPin('');
    } catch (err: any) {
      showToast(`Security Error: ${err.message}`);
    } finally {
      setPinRotating(false);
    }
  };

  const handleInventoryCSV = () => {
    setExporting('inv-csv');
    // Sanitize for CSV
    const csvData = inventory.map((i: InventoryItem) => {
      const privateData = role === 'admin' ? inventoryPrivate.find((pi: any) => pi.id === i.id) : null;
      return {
        Name: i.name,
        SKU: i.sku || 'N/A',
        Category: i.category,
        Subcategory: i.subcategory || '',
        CostPrice: privateData?.costPrice || 0,
        SellPrice: i.price,
        Stock: i.stock ?? 0,
        AddedOn: i.createdAt
      };
    });
    const csv = convertToCSV(csvData);
    downloadFile(csv, `Inventory_Export_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
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
    
    setMigrationStatus(`Parsing ${type} data...`);
    const { parseGenericExcel } = await import('@/lib/migrationEngine');
    const result = await parseGenericExcel(file, type);
    
    if (!result.success || result.validItems.length === 0) {
      showToast(`Import Failed: ${result.errors[0] || 'No valid records found'}`);
      setMigrationStatus(null);
    } else {
      setMigrationData(result);
      setMigrationStatus(null);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const executeMigration = async () => {
    if (!migrationData) return;
    setMigrationStatus(`Importing ${migrationData.validItems.length} records...`);
    
    let count = 0;
    try {
      for (const item of migrationData.validItems) {
        if (migrationData.type === 'inventory') {
          await addInventoryItem({
            id: `inv-${Date.now()}-${count}`,
            ...item,
            createdAt: new Date().toISOString()
          });
        } else if (migrationData.type === 'customer') {
          await upsertCustomer({
            id: `cust-${Date.now()}-${count}`,
            name: item.name,
            phone: item.phone,
            balance: item.balance,
            totalSpent: item.totalSpent,
            createdAt: new Date().toISOString()
          });
        } else if (migrationData.type === 'sale') {
          await addSale({
            id: `sale-${Date.now()}-${count}`,
            ...item,
            status: 'COMPLETED'
          });
        }
        count++;
      }
      showToast(`Success: Imported ${count} ${migrationData.type} records!`);
    } catch (e: any) {
      showToast(`Partial Success: ${count} added. Error: ${e.message}`);
    }
    setMigrationData(null);
    setMigrationStatus(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tighter">Control Center</h1>
          <p className="text-muted-foreground mt-1">Configure shop settings and data management</p>
        </div>
        <div className="h-12 w-12 premium-gradient rounded-2xl flex items-center justify-center text-white shadow-lg">
          <SettingsIcon className="h-6 w-6" />
        </div>
      </div>

      {/* Shop Info Summary */}
      <div className="glass-card rounded-3xl p-8 border-primary/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
          <Store className="h-40 w-40" />
        </div>
        <div className="flex items-start justify-between mb-8 relative z-10">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <Store className="h-10 w-10" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black tracking-tight">{shop.name}</h2>
                <button 
                  onClick={() => { setEditForm(shop); setEditOpen(true); }}
                  className="px-3 py-1 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-sm border border-primary/20"
                >
                  Edit Profile
                </button>
              </div>
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-[0.2em]">{shop.tagline}</p>
              <p className="text-xs text-muted-foreground mt-1 opacity-60">{shop.address || 'No address set'}</p>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-border/50">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Inventory</p>
            <p className="text-xl font-black italic">{inventory.length}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Sales</p>
            <p className="text-xl font-black italic">{sales.length}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Customers</p>
            <p className="text-xl font-black italic">{customers.length}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Store Value</p>
            <p className="text-xl font-black italic text-primary">₹{inventory.reduce((sum: number, i: InventoryItem) => sum + (i.price * (i.stock || 0)), 0).toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Shift Base</p>
            <p className="text-xl font-black italic text-primary">{shop.standardWorkingHours || 9}h</p>
          </div>
        </div>
      </div>

      {/* Theme / Appearance Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Monitor className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-black tracking-tight">Display & Appearance</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setTheme('light')}
            className={`glass-card p-6 rounded-[2rem] text-left transition-all relative overflow-hidden group ${
              theme === 'light' ? 'ring-2 ring-primary border-primary/50' : 'hover:bg-accent/50'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Sun className="h-5 w-5" />
              </div>
              {theme === 'light' && <CheckCircle2 className="h-5 w-5 text-primary" />}
            </div>
            <p className="text-sm font-black uppercase tracking-widest">White Mode</p>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold">Clean, professional light theme</p>
            <div className="mt-4 flex gap-1.5 pointer-events-none">
              <div className="h-2 w-8 bg-zinc-200 rounded-full" />
              <div className="h-2 w-4 bg-primary/30 rounded-full" />
            </div>
          </button>

          <button
            onClick={() => setTheme('dark')}
            className={`glass-card p-6 rounded-[2rem] text-left transition-all relative overflow-hidden group ${
              theme === 'dark' ? 'ring-2 ring-primary border-primary/50 bg-zinc-900' : 'hover:bg-accent/50'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Moon className="h-5 w-5" />
              </div>
              {theme === 'dark' && <CheckCircle2 className="h-5 w-5 text-primary" />}
            </div>
            <p className="text-sm font-black uppercase tracking-widest text-zinc-100">Dark Mode</p>
            <p className="text-[10px] text-zinc-500 mt-1 font-bold">Modern, elite dark theme</p>
            <div className="mt-4 flex gap-1.5 pointer-events-none">
              <div className="h-2 w-8 bg-zinc-800 rounded-full" />
              <div className="h-2 w-4 bg-primary/30 rounded-full" />
            </div>
          </button>
        </div>
      </div>

      {/* Profile & Account */}
      <div className="space-y-4 pt-4 border-t border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center overflow-hidden border-2 border-primary/20">
               <img src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} alt="avatar" />
            </div>
            <div>
              <p className="text-sm font-black tracking-tight">{user?.email}</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{role} Account</p>
            </div>
          </div>
          <button 
            onClick={() => auth.signOut()}
            className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-red-500/10 to-transparent hover:from-red-600 hover:to-red-500 text-red-500 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-red-500/5 group border border-red-500/20"
          >
            <div className="h-8 w-8 rounded-xl bg-red-500/20 flex items-center justify-center group-hover:bg-white/20 transition-colors">
              <LogOut className="h-4 w-4" />
            </div>
            <span>Terminate Hub Session</span>
          </button>
        </div>
      </div>

      {/* Data Management Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Backup & Export */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Database className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-black tracking-tight">Data Backup & Export</h3>
          </div>
          
          <div className="glass-card rounded-3xl p-6 space-y-3">
            <button 
              onClick={handleInventoryCSV}
              disabled={exporting === 'inv-csv'}
              className="w-full flex items-center justify-between p-4 bg-accent/50 hover:bg-primary/10 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
                <div className="text-left">
                  <p className="text-sm font-bold">Inventory Assets</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-black">CSV Report</p>
                </div>
              </div>
              <Download className="h-4 w-4 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
            </button>

            <button 
              onClick={handleSalesCSV}
              disabled={exporting === 'sales-csv'}
              className="w-full flex items-center justify-between p-4 bg-accent/50 hover:bg-primary/10 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-3">
                <RefreshCcw className="h-5 w-5 text-blue-500" />
                <div className="text-left">
                  <p className="text-sm font-bold">Detailed Sales Log</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-black">CSV Report</p>
                </div>
              </div>
              <Download className="h-4 w-4 text-muted-foreground group-hover:text-blue-500 transition-colors" />
            </button>
            
            {/* Zobaze Migration Button */}
            <div className="pt-4 border-t border-border/50">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 ml-1">Legacy Migration Engine</p>
              <input 
                type="file" 
                ref={fileInputRef}
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => handleFileUpload(e, importType)}
              />
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => { setImportType('inventory'); setTimeout(() => fileInputRef.current?.click(), 10); }}
                  disabled={migrationStatus !== null || role !== 'admin'}
                  className="flex flex-col items-center gap-2 p-4 bg-orange-500/5 hover:bg-orange-500/10 text-orange-500 rounded-2xl transition-all border border-orange-500/10 opacity-70 hover:opacity-100"
                >
                  <Database className="h-5 w-5" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Import Stock</span>
                </button>
                <button 
                  onClick={() => { setImportType('customer'); setTimeout(() => fileInputRef.current?.click(), 10); }}
                  disabled={migrationStatus !== null || role !== 'admin'}
                  className="flex flex-col items-center gap-2 p-4 bg-blue-600/5 hover:bg-blue-600/10 text-blue-600 rounded-2xl transition-all border border-blue-600/10 opacity-70 hover:opacity-100"
                >
                  <Users className="h-5 w-5" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Import Users</span>
                </button>
                <button 
                  onClick={() => { setImportType('sale'); setTimeout(() => fileInputRef.current?.click(), 10); }}
                  disabled={migrationStatus !== null || role !== 'admin'}
                  className="flex flex-col items-center gap-2 p-4 bg-emerald-600/5 hover:bg-emerald-600/10 text-emerald-600 rounded-2xl transition-all border border-emerald-600/10 opacity-70 hover:opacity-100"
                >
                  <RefreshCcw className="h-5 w-5" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Import Sales</span>
                </button>
                <button 
                  onClick={() => { setImportType('inventory'); setTimeout(() => fileInputRef.current?.click(), 10); }}
                  disabled={migrationStatus !== null || role !== 'admin'}
                  className="flex flex-col items-center gap-2 p-4 bg-purple-600/5 hover:bg-purple-600/10 text-purple-600 rounded-2xl transition-all border border-purple-600/10 opacity-70 hover:opacity-100"
                >
                  <Sparkles className="h-5 w-5" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Master Import</span>
                </button>
              </div>
              {migrationStatus && (
                <div className="mt-4 p-3 bg-accent/50 rounded-xl flex items-center gap-3">
                  <RotateCcw className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{migrationStatus}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Security & Maintenance */}
        {role === 'admin' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="h-5 w-5 text-destructive" />
              <h3 className="text-lg font-black tracking-tight">System Maintenance</h3>
            </div>
            
            <div className="glass-card rounded-3xl p-6 space-y-4">
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Pin Security Control</p>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest ml-1 text-primary">New Master Admin PIN</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <input 
                        type="password"
                        maxLength={4}
                        placeholder="Enter 4-digit PIN"
                        className="w-full pl-8 pr-4 py-2 bg-accent/30 border border-border rounded-xl text-xs font-black tracking-[0.5em] focus:ring-2 focus:ring-primary/20"
                        value={newAdminPin}
                        onChange={e => setNewAdminPin(e.target.value.replace(/[^0-9]/g, ''))}
                      />
                    </div>
                  </div>
                  
                  <button 
                    onClick={handleRotatePin}
                    disabled={pinRotating || newAdminPin.length < 4}
                    className={cn(
                      "w-full py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2",
                      newAdminPin.length === 4 
                        ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary hover:text-white" 
                        : "bg-accent/50 text-muted-foreground border-transparent opacity-50"
                    )}
                  >
                    {pinRotating ? (
                      <>
                        <RefreshCcw className="h-3 w-3 animate-spin" />
                        Encrypting...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-3 w-3" />
                        Rotate Master PIN
                      </>
                    )}
                  </button>
                  <p className="text-[9px] text-muted-foreground italic text-center px-4">
                    Security: PINs are hashed using bcrypt before being stored in the digital vault.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-destructive/5 border border-destructive/10 rounded-2xl">
                <div className="flex items-center gap-3 text-destructive mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <p className="text-xs font-black uppercase tracking-widest">Danger Zone</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Resetting the inventory will delete every product, SKU, and stock count permanently. This cannot be undone!
                </p>
                <button 
                  onClick={() => setResetConfirmOpen(true)}
                  className="w-full mt-4 py-3 bg-destructive text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:bg-destructive/90 hover:shadow-lg hover:shadow-destructive/20"
                >
                  Reset Inventory Data
                </button>
              </div>

              {/* Security Advancement (Admin Only) */}
              <div className="glass-card p-8 rounded-[2.5rem] border border-white/5 space-y-6 mt-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                    <Database className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black">Security Advancement</h2>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">Data Sequestration & Vault</p>
                  </div>
                </div>
                
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Upgrade your shop to use the new sequestered data architecture. This moves sensitive salaries, PINs, and cost prices into a restricted private vault.
                </p>

                <button
                  type="button"
                  onClick={() => setActiveTab('sequestration')}
                  className="w-full py-4 rounded-2xl border border-white/10 font-black text-[10px] uppercase tracking-widest hover:bg-white/5 transition-all flex items-center justify-center gap-2 group"
                >
                  Open Security Vault
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Shop Editor Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-10 overflow-y-auto">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditOpen(false)} />
          <div className="relative z-10 w-full max-w-xl glass-card rounded-[2.5rem] p-8 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500">
            <h2 className="text-3xl font-black mb-1">Edit Shop Profile</h2>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-8 opacity-60">This info appears on your receipts</p>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest ml-1 opacity-50">Shop Name</label>
                <input 
                  className="w-full bg-accent/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={editForm.name}
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest ml-1 opacity-50">Tagline</label>
                <input 
                  className="w-full bg-accent/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={editForm.tagline}
                  onChange={e => setEditForm({...editForm, tagline: e.target.value})}
                />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest ml-1 opacity-50">Address</label>
                <input 
                  className="w-full bg-accent/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={editForm.address}
                  onChange={e => setEditForm({...editForm, address: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1 opacity-50">Phone Number</label>
                  {editForm.phone && !isValidIndianPhone(editForm.phone) && (
                    <span className="text-[9px] text-red-500 font-bold flex items-center gap-0.5 animate-pulse">
                      <AlertCircle className="h-2.5 w-2.5" /> 10-digit req.
                    </span>
                  )}
                </div>
                <input 
                  maxLength={10}
                  className={cn(
                    "w-full bg-accent/50 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all font-bold",
                    editForm.phone && !isValidIndianPhone(editForm.phone) ? "border-red-500/50 ring-red-500/20 text-red-500" : "border-border focus:ring-primary/20"
                  )}
                  value={editForm.phone}
                  onChange={e => setEditForm({...editForm, phone: sanitizePhone(e.target.value)})}
                  placeholder="9876543210"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest ml-1 opacity-50">GST Number</label>
                <input 
                  className="w-full bg-accent/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={editForm.gst}
                  onChange={e => setEditForm({...editForm, gst: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest ml-1 opacity-50">Working Hours / Day</label>
                <input 
                  type="number"
                  className="w-full bg-accent/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-black"
                  value={editForm.standardWorkingHours}
                  onChange={e => setEditForm({...editForm, standardWorkingHours: Number(e.target.value)})}
                />
              </div>
              <div className="col-span-2 space-y-1 pt-2">
                <div className="flex items-center justify-between p-4 bg-accent/30 rounded-2xl border border-border/50">
                   <div>
                      <p className="text-sm font-black tracking-tight">Staff Attendance Recording</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Allow staff members to clock in/out themselves</p>
                   </div>
                   <button 
                     onClick={() => setEditForm({...editForm, allowStaffAttendance: !editForm.allowStaffAttendance})}
                     className={cn(
                       "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                       editForm.allowStaffAttendance ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"
                     )}
                   >
                     {editForm.allowStaffAttendance ? 'Enabled' : 'Disabled'}
                   </button>
                </div>
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest ml-1 opacity-50">Receipt Footer Note</label>
                <input 
                  className="w-full bg-accent/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={editForm.footer}
                  onChange={e => setEditForm({...editForm, footer: e.target.value})}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setEditOpen(false)} className="flex-1 py-4 rounded-2xl font-bold text-sm bg-accent hover:bg-accent/80 transition-all uppercase tracking-widest text-muted-foreground">Cancel</button>
              <button 
                onClick={handleSaveShop} 
                disabled={editForm.phone.length !== 10 || !isValidIndianPhone(editForm.phone)}
                className={cn(
                  "flex-1 py-4 rounded-2xl font-black text-sm transition-all uppercase tracking-widest",
                  editForm.phone.length === 10 && isValidIndianPhone(editForm.phone)
                    ? "premium-gradient text-white shadow-xl hover:-translate-y-0.5"
                    : "bg-accent text-muted-foreground cursor-not-allowed opacity-50"
                )}
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {resetConfirmOpen && (
        <ConfirmDialog
          open={resetConfirmOpen}
          title="Nuke Inventory?"
          description="You are about to wipe your entire product database. This action is terminal and cannot be reversed. Are you sure?"
          confirmText="Nuke All Data"
          variant="danger"
          onConfirm={async () => {
            await clearInventory();
            setResetConfirmOpen(false);
          }}
          onClose={() => setResetConfirmOpen(false)}
        />
      )}

      {/* Migration Confirmation Modal */}
      {migrationData && (
        <ConfirmDialog
          open={!!migrationData}
          title={`${migrationData.type.toUpperCase()} Analysis Complete`}
          description={`The neural engine mapping is ready. ${migrationData.validItems.length} records detected from your file. Inject into Business Hub?`}
          confirmText="Inject Data"
          variant="danger"
          onConfirm={executeMigration}
          onClose={() => setMigrationData(null)}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="bg-primary text-white px-8 py-4 rounded-3xl shadow-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3">
            <CheckCircle2 className="h-4 w-4" />
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
