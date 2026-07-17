import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, 
  Package, 
  ArrowUpCircle, 
  TrendingDown,
  ShoppingCart,
  ShieldCheck,
  Plus
} from 'lucide-react';
import { useSqlQuery } from '@/db/hooks';
import { useBusinessStore } from '@/lib/useBusinessStore';
import type { InventoryItem } from '@/lib/types';

export default function StockAlerts() {
  const navigate = useNavigate();
  const { updateStock } = useBusinessStore();
  const inventory = useSqlQuery<InventoryItem>('SELECT * FROM inventory WHERE tombstone = 0 ORDER BY name ASC', [], ['inventory']);

  const lowStockThreshold = 5;
  const lowStock = inventory.filter((p: InventoryItem) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= lowStockThreshold);
  const outOfStock = inventory.filter((p: InventoryItem) => (p.stock ?? 0) <= 0);
  const criticalItems = inventory.filter((p: InventoryItem) => (p.stock ?? 0) <= lowStockThreshold);

  const handleRestock = async (id: string, amount: number) => {
    await updateStock(id, amount);
  };

  return (
    <div className="space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/50">
        <div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter leading-none mb-2 text-red-500">Stock Alerts</h1>
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest opacity-70">Inventory Reorder Control Center</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 rounded-2xl border border-red-500/20 animate-pulse">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="text-xs font-black text-red-500 uppercase tracking-widest">{criticalItems.length} Items Require Attention</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-3xl relative overflow-hidden group border-red-500/20 bg-red-500/5">
          <div className="flex justify-between items-start mb-4">
            <div className="h-10 w-10 rounded-xl bg-red-500 flex items-center justify-center text-white shadow-lg">
              <TrendingDown className="h-5 w-5" />
            </div>
            <span className="text-xs font-black bg-red-500/20 text-red-500 px-2.5 py-1 rounded-full">{outOfStock.length} Critical</span>
          </div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Out of Stock</p>
          <p className="text-3xl font-black mt-1">{outOfStock.length}</p>
        </div>

        <div className="glass-card p-6 rounded-3xl relative overflow-hidden group border-amber-500/20 bg-amber-500/5">
          <div className="flex justify-between items-start mb-4">
            <div className="h-10 w-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-lg">
              <Package className="h-5 w-5" />
            </div>
            <span className="text-xs font-black bg-amber-500/20 text-amber-500 px-2.5 py-1 rounded-full">{lowStock.length} Warning</span>
          </div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Running Low</p>
          <p className="text-3xl font-black mt-1">{lowStock.length}</p>
        </div>

        <div className="glass-card p-6 rounded-3xl flex flex-col justify-center border-primary/20 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-all group" onClick={() => navigate('/inventory')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Full Inventory</p>
              <p className="text-2xl font-black italic">{inventory.length} SKUs Total</p>
            </div>
            <ArrowUpCircle className="h-8 w-8 text-primary group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* Alerts Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Urgent: Out of Stock */}
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-red-500 flex items-center gap-2">
            🚨 Urgent Reorder Required
          </h3>
          <div className="space-y-3">
            {outOfStock.length === 0 ? (
              <div className="p-10 glass-card rounded-3xl border-border/30 text-center">
                <ShieldCheck className="h-10 w-10 mx-auto text-green-500/30 mb-2" />
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Zero items out of stock</p>
              </div>
            ) : (
              outOfStock.map((product: InventoryItem) => (
                <div key={product.id} className="glass-card p-5 rounded-2xl border-red-500/10 flex items-center gap-4 group">
                  <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                    <Package className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{product.name}</p>
                    <p className="text-[10px] text-red-500 font-black uppercase tracking-tighter mt-0.5">⚠️ Out of Stock</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleRestock(product.id, 10)} className="h-10 w-16 bg-red-500 text-white rounded-xl font-black text-xs hover:shadow-lg transition-all">+10</button>
                    <button onClick={() => handleRestock(product.id, 50)} className="h-10 w-16 bg-accent border border-border rounded-xl font-black text-xs hover:bg-black hover:text-white transition-all">+50</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Warning: Running Low */}
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-amber-500 flex items-center gap-2">
            ⚠️ Low Stock Warnings
          </h3>
          <div className="space-y-3">
            {lowStock.length === 0 ? (
              <div className="p-10 glass-card rounded-3xl border-border/30 text-center">
                <ShieldCheck className="h-10 w-10 mx-auto text-green-500/30 mb-2" />
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Stock levels healthy</p>
              </div>
            ) : (
              lowStock.map((product: InventoryItem) => (
                <div key={product.id} className="glass-card p-5 rounded-2xl border-amber-500/10 flex items-center gap-4 group">
                  <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                    <Package className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{product.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-amber-600 font-black uppercase tracking-tighter">Running Low ({product.stock})</span>
                      <div className="h-1 flex-1 bg-amber-500/10 rounded-full max-w-[60px]">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(product.stock! / 5) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleRestock(product.id, 10)} className="p-2.5 bg-accent hover:bg-amber-500 hover:text-white rounded-xl transition-all"><Plus className="h-4 w-4" /></button>
                    <button 
                      onClick={() => navigate('/sell')}
                      className="p-2.5 bg-accent hover:bg-primary hover:text-white rounded-xl transition-all"
                      title="Sell remaining"
                    >
                      <ShoppingCart className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

