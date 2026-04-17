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
  Building
} from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, setDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { UserPlus, Ticket, LogOut, X } from 'lucide-react';
import { useBusinessStore } from '@/lib/useBusinessStore';
import { downloadFile, convertToCSV, exportSalesReport } from '@/lib/exportUtils';
import { formatCurrency, cn, isValidIndianPhone, sanitizePhone } from '@/lib/utils';
import ConfirmDialog from '@/components/ConfirmDialog';
import { loadShopSettings } from '@/lib/shopSettings';
import { useAuthStore } from '@/lib/useAuthStore';
import type { InventoryItem, ShopSettings } from '@/lib/types';

export default function Settings() {
  const { inventory, sales, customers, shop, updateShop, clearInventory, theme, setTheme, shopId } = useBusinessStore();
  const { role, user } = useAuthStore();
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [invites, setInvites] = useState<{ id: string, code: string }[]>([]);
  const [generatingInvite, setGeneratingInvite] = useState(false);

  // Subscriptions for Invitations
  React.useEffect(() => {
    if (shopId && role === 'admin') {
      const q = collection(db, `shops/${shopId}/invitations`);
      return onSnapshot(q, (snap) => {
        setInvites(snap.docs.map(d => ({ id: d.id, code: d.data().code })));
      });
    }
  }, [shopId, role]);
  
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };
  
  const [editForm, setEditForm] = useState(shop);

  const handleSaveShop = () => {
    updateShop(editForm);
    setEditOpen(false);
  };

  const handleInventoryCSV = () => {
    setExporting('inv-csv');
    // Sanitize for CSV
    const csvData = inventory.map((i: InventoryItem) => ({
      Name: i.name,
      SKU: i.sku || 'N/A',
      Category: i.category,
      Subcategory: i.subcategory || '',
      CostPrice: i.costPrice || 0,
      SellPrice: i.price,
      Stock: i.stock ?? 0,
      AddedOn: i.createdAt
    }));
    const csv = convertToCSV(csvData);
    downloadFile(csv, `Inventory_Export_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    setTimeout(() => setExporting(null), 1000);
  };

  const handleSalesCSV = () => {
    setExporting('sales-csv');
    exportSalesReport(sales);
    setTimeout(() => setExporting(null), 1000);
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

      {/* STAFF & INVITATIONS - ADMIN ONLY */}
      {role === 'admin' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-black tracking-tight">Staff & Team Access</h3>
            </div>
            <button 
              onClick={async () => {
                if (!shopId) return;
                setGeneratingInvite(true);
                const code = Math.random().toString(36).substring(2, 8).toUpperCase();
                await setDoc(doc(db, `shops/${shopId}/invitations`, code), {
                  code,
                  createdAt: new Date().toISOString()
                });
                // Also update the shop document with a search helper for the code
                await updateDoc(doc(db, 'shops', shopId), { inviteCode: code });
                setGeneratingInvite(false);
                showToast('New Invitation Code Generated');
              }}
              disabled={generatingInvite}
              className="px-4 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-2"
            >
              <Ticket className="h-4 w-4" />
              Generate Invite Code
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {invites.length === 0 ? (
              <div className="md:col-span-3 glass-card p-10 rounded-[2rem] text-center border-dashed border-zinc-500/20">
                <Users className="h-10 w-10 text-zinc-500 mx-auto mb-4 opacity-20" />
                <p className="text-sm font-bold text-zinc-500">No active invitation codes.</p>
                <p className="text-[10px] text-zinc-600 mt-1 uppercase tracking-widest font-black">Generate one to add staff members</p>
              </div>
            ) : (
              invites.map(invite => (
                <div key={invite.id} className="glass-card p-6 rounded-3xl border-primary/20 flex flex-col items-center justify-center group relative overflow-hidden">
                  <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Staff Code</p>
                  <h4 className="text-2xl font-black tracking-[0.2em] text-primary">{invite.code}</h4>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(invite.code);
                      showToast('Code Copied to Clipboard');
                    }}
                    className="mt-4 text-[9px] font-black uppercase tracking-widest bg-zinc-500/10 px-3 py-1.5 rounded-lg hover:bg-zinc-500/20 transition-all"
                  >
                    Copy & Share
                  </button>
                  <button 
                    onClick={async () => {
                      await deleteDoc(doc(db, `shops/${shopId}/invitations`, invite.id));
                      showToast('Invitation Code Revoked');
                    }}
                    className="absolute top-2 right-2 p-1.5 text-zinc-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
          
          <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-start gap-4">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-bold text-zinc-400 leading-relaxed">
                <span className="text-primary font-black">Admin Protocol:</span> Share these codes with your staff. They can enter the code on the Login screen to join your shop hub. Staff members can create sales and view inventory, but cannot access Expenses, Reports, or these Settings.
              </p>
            </div>
          </div>
        </div>
      )}

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
            className="flex items-center gap-2 px-6 py-3 bg-red-500/10 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/10"
          >
            <LogOut className="h-4 w-4" />
            Log Out Hub
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
          </div>
        </div>

        {/* Security & Maintenance */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive className="h-5 w-5 text-destructive" />
            <h3 className="text-lg font-black tracking-tight">System Maintenance</h3>
          </div>
          
          <div className="glass-card rounded-3xl p-6 space-y-4">
            <div className="p-4 bg-destructive/5 border border-destructive/10 rounded-2xl">
              <div className="flex items-center gap-3 text-destructive mb-2">
                <AlertTriangle className="h-4 w-4" />
                <p className="text-xs font-black uppercase tracking-widest">Danger Zone</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Resetting the inventory will delete every product, SKU, and stock count permanently. This cannot be undone unless you have a JSON backup.
              </p>
              <button 
                onClick={() => setResetConfirmOpen(true)}
                className="w-full mt-4 py-3 bg-destructive text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:bg-destructive/90 hover:shadow-lg hover:shadow-destructive/20"
              >
                Reset Inventory Data
              </button>
            </div>

            <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-2xl border border-primary/10">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <p className="text-[10px] text-muted-foreground font-bold leading-tight">
                Your data is stored locally in your browser. Clearing your browser cache may delete your shop records. <span className="text-primary underline">Download backups weekly.</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Shop Editor Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditOpen(false)} />
          <div className="relative z-10 w-full max-w-xl glass-card rounded-[2.5rem] p-8 shadow-2xl animate-in">
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
                disabled={!isValidIndianPhone(editForm.phone)}
                className={cn(
                  "flex-1 py-4 rounded-2xl font-black text-sm transition-all uppercase tracking-widest",
                  isValidIndianPhone(editForm.phone)
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
