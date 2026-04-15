import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Download, 
  FileJson, 
  FileSpreadsheet, 
  Trash2, 
  AlertTriangle,
  HardDrive,
  Database,
  Store,
  RefreshCcw,
  CheckCircle2,
  Moon,
  Sun,
  Monitor
} from 'lucide-react';
import { useBusinessStore } from '@/lib/useBusinessStore';
import { downloadFile, convertToCSV, exportSalesReport } from '@/lib/exportUtils';
import ConfirmDialog from '@/components/ConfirmDialog';
import { loadShopSettings } from '@/lib/shopSettings';

export default function Settings() {
  const { inventory, sales, customers, shop, updateShop, importData, clearInventory, theme, setTheme } = useBusinessStore();
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [restoreData, setRestoreData] = useState<any>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  
  const [editForm, setEditForm] = useState(shop);

  const handleJSONRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.inventory || data.sales || data.customers) {
          setRestoreData(data);
          setRestoreConfirmOpen(true);
        } else {
          alert("Invalid backup file format.");
        }
      } catch {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const handleSaveShop = () => {
    updateShop(editForm);
    setEditOpen(false);
  };

  const handleJSONBackup = () => {
    setExporting('json');
    const fullState = {
      inventory,
      sales,
      customers,
      shopMetadata: shop,
      exportDate: new Date().toISOString()
    };
    downloadFile(
      JSON.stringify(fullState, null, 2),
      `BusinessHub_FullBackup_${new Date().toISOString().split('T')[0]}.json`,
      'application/json'
    );
    setTimeout(() => setExporting(null), 1000);
  };

  const handleInventoryCSV = () => {
    setExporting('inv-csv');
    // Sanitize for CSV
    const csvData = inventory.map(i => ({
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
              <h2 className="text-2xl font-black tracking-tight">{shop.name}</h2>
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-[0.2em]">{shop.tagline}</p>
              <p className="text-xs text-muted-foreground mt-1 opacity-60">{shop.address || 'No address set'}</p>
            </div>
          </div>
          <button 
            onClick={() => { setEditForm(shop); setEditOpen(true); }}
            className="px-4 py-2 bg-primary/10 text-primary rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all"
          >
            Edit Profile
          </button>
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
            <p className="text-xl font-black italic text-primary">₹{inventory.reduce((sum, i) => sum + (i.price * (i.stock || 0)), 0).toLocaleString()}</p>
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
              onClick={handleJSONBackup}
              disabled={exporting === 'json'}
              className="w-full flex items-center justify-between p-4 bg-accent/30 hover:bg-primary/10 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-3">
                <Download className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <p className="text-sm font-bold">Export Full Backup</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-black">JSON Format</p>
                </div>
              </div>
            </button>

            <label className="w-full flex items-center justify-between p-4 bg-accent/30 hover:bg-amber-500/10 rounded-2xl transition-all group cursor-pointer border border-transparent hover:border-amber-500/20">
              <div className="flex items-center gap-3">
                <RefreshCcw className="h-5 w-5 text-amber-500" />
                <div className="text-left">
                  <p className="text-sm font-bold">Restore from Backup</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-black">Import JSON File</p>
                </div>
              </div>
              <input 
                type="file" 
                accept=".json" 
                className="hidden" 
                onChange={handleJSONRestore}
              />
            </label>

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
                <label className="text-[10px] font-black uppercase tracking-widest ml-1 opacity-50">Phone Number</label>
                <input 
                  className="w-full bg-accent/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={editForm.phone}
                  onChange={e => setEditForm({...editForm, phone: e.target.value})}
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
              <button onClick={() => setEditOpen(false)} className="flex-1 py-4 rounded-2xl font-bold text-sm bg-accent hover:bg-accent/80 transition-all">Cancel</button>
              <button onClick={handleSaveShop} className="flex-1 premium-gradient text-white py-4 rounded-2xl font-black text-sm hover:shadow-xl transition-all uppercase tracking-widest">Save Settings</button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation */}
      <ConfirmDialog
        open={restoreConfirmOpen}
        title="Restore Full Database?"
        description="This will overwrite all current items, sales, and settings with the data from your backup file. This cannot be undone."
        confirmText="Yes, Restore Everything"
        variant="danger"
        onConfirm={async () => {
          await importData(restoreData);
          setRestoreConfirmOpen(false);
          setRestoreData(null);
        }}
        onClose={() => {
          setRestoreConfirmOpen(false);
          setRestoreData(null);
        }}
      />

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
    </div>
  );
}
