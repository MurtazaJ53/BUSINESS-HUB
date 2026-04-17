import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus, Minus, Package, Trash2, Pencil, Search, Tag, Database,
  X, FileText, ClipboardPaste, Copy, AlertCircle, AlertTriangle, Sparkles, Loader2
} from 'lucide-react';
import ErrorModal from '@/components/ErrorModal';
import { useBusinessStore } from '@/lib/useBusinessStore';
import { formatCurrency } from '@/lib/utils';
import type { InventoryItem } from '@/lib/types';
import ConfirmDialog from '@/components/ConfirmDialog';

// ─── Tiny UI primitives (no shadcn dependency) ─────────────────────────────

const Input = ({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={`w-full px-3 py-2 bg-accent border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all ${className}`}
    {...props}
  />
);

const Label = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <label className={`text-xs font-bold uppercase tracking-wider text-muted-foreground ${className}`}>
    {children}
  </label>
);

function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative glass-card rounded-3xl shadow-2xl flex flex-col max-h-[90vh] ${
          wide ? 'w-full max-w-4xl' : 'w-full max-w-lg'
        }`}
      >
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <h2 className="font-black text-xl">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-xl transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface MatrixRow {
  sub: string;
  size: string;
  price: string;
  costPrice: string;
  stock: string;
}

interface BulkRow {
  name: string;
  price: string;
  costPrice: string;
  stock: string;
  category: string;
  subcategory: string;
  size: string;
}

const emptyForm = {
  name: '', price: '', costPrice: '', sku: '', category: '',
  subcategory: '', size: '', description: '', stock: '',
};

const emptyBulkRow = (): BulkRow => ({
  name: '', price: '', costPrice: '', stock: '', category: '', subcategory: '', size: '',
});

// ─── Main Component ─────────────────────────────────────────────────────────

export default function Inventory() {
  const { 
    inventory, 
    addInventoryItem, 
    updateInventoryItem, 
    updateStock,
    deleteInventoryItem, 
    clearInventory,
    inventorySearchTerm,
    setInventorySearchTerm
  } = useBusinessStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [errorModal, setErrorModal] = useState({ show: false, title: '', message: '' });
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [variantMatrix, setVariantMatrix] = useState<MatrixRow[]>([]);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>(Array(5).fill(null).map(emptyBulkRow));
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // ── Autocomplete data ──
  const uniqueCategories = useMemo(
    () => Array.from(new Set(inventory.map((i) => i.category))).filter(Boolean),
    [inventory]
  );

  // ── Variant matrix sync ──
  useEffect(() => {
    const sizes = form.size.includes(',')
      ? form.size.split(',').map((s) => s.trim()).filter(Boolean)
      : [form.size.trim()].filter(Boolean);
    const subs = form.subcategory.includes(',')
      ? form.subcategory.split(',').map((s) => s.trim()).filter(Boolean)
      : [form.subcategory.trim()].filter(Boolean);

    if (sizes.length > 1 || subs.length > 1) {
      const newMatrix: MatrixRow[] = [];
      const finalSubs = subs.length > 0 ? subs : [''];
      const finalSizes = sizes.length > 0 ? sizes : [''];
      for (const sub of finalSubs) {
        for (const size of finalSizes) {
          const existing = variantMatrix.find((m) => m.sub === sub && m.size === size);
          newMatrix.push({
            sub, size,
            price: existing?.price || form.price || '0',
            costPrice: existing?.costPrice || form.costPrice || '0',
            stock: existing?.stock || form.stock || '0',
          });
        }
      }
      setVariantMatrix(newMatrix);
    } else {
      setVariantMatrix([]);
    }
  }, [form.size, form.subcategory, form.price, form.costPrice, form.stock, addOpen]);

  // ── Sync search from dashboard ──
  useEffect(() => {
    if (inventorySearchTerm) {
      setSearch(inventorySearchTerm);
      setInventorySearchTerm('');
    }
  }, [inventorySearchTerm, setInventorySearchTerm]);

  // ── Filtered list ──
  const filtered = useMemo(() =>
    inventory.filter((item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase()) ||
      (item.subcategory?.toLowerCase() ?? '').includes(search.toLowerCase()) ||
      (item.size?.toLowerCase() ?? '').includes(search.toLowerCase()) ||
      (item.sku?.toLowerCase() ?? '').includes(search.toLowerCase())
    ),
    [inventory, search]
  );

  // ── Stats ──
  const stats = useMemo(() => ({
    totalItems: inventory.length,
    totalStock: inventory.reduce((s, i) => s + (i.stock || 0), 0),
    inventoryValue: inventory.reduce((s, i) => s + i.price * (i.stock || 0), 0),
    potentialProfit: inventory.reduce((s, i) => {
      if (i.costPrice && i.stock) return s + (i.price - i.costPrice) * i.stock;
      return s;
    }, 0),
    lowStock: inventory.filter((i) => i.stock !== undefined && i.stock <= 5).length,
  }), [inventory]);

  // ── Add (single / variant) ──
  const handleAdd = async () => {
    if (!form.name || !form.price) { showToast('Name and price are required'); return; }
    try {
      if (variantMatrix.length > 0) {
        let count = 0;
        for (const row of variantMatrix) {
          const itemData: InventoryItem = {
            id: `item-${Date.now()}-${count}`,
            name: form.name,
            price: parseFloat(row.price) || 0,
            costPrice: row.costPrice ? parseFloat(row.costPrice) : 0,
            sku: form.sku ? `${form.sku}-${row.sub || ''}-${row.size || ''}`.replace(/--/g, '-') : "",
            category: form.category || 'General',
            subcategory: row.sub || "",
            size: row.size || "",
            description: form.description || "",
            stock: row.stock ? parseInt(row.stock) : 0,
            createdAt: new Date().toISOString(),
          };
          await addInventoryItem(itemData);
          count++;
        }
        showToast(`Added ${count} variations!`);
      } else {
        const itemData: InventoryItem = {
          id: `item-${Date.now()}`,
          name: form.name,
          price: parseFloat(form.price) || 0,
          costPrice: form.costPrice ? parseFloat(form.costPrice) : 0,
          sku: form.sku || "",
          category: form.category || 'General',
          subcategory: form.subcategory || "",
          size: form.size || "",
          description: form.description || "",
          stock: form.stock ? parseInt(form.stock) : 0,
          createdAt: new Date().toISOString(),
        };
        await addInventoryItem(itemData);
        showToast('Item added to inventory!');
      }
      setAddOpen(false);
      setForm(emptyForm);
      setVariantMatrix([]);
    } catch (err: any) {
      console.error(err);
      setErrorModal({
        show: true,
        title: 'Save Failed',
        message: err.message || 'There was an error saving this item to your inventory.'
      });
    }
  };

  // ── Update ──
  const handleUpdate = async () => {
    if (!editingItem || !editForm.name || !editForm.price) return;
    await updateInventoryItem({
      ...editingItem,
      name: editForm.name,
      price: parseFloat(editForm.price) || 0,
      costPrice: editForm.costPrice ? parseFloat(editForm.costPrice) : undefined,
      sku: editForm.sku || undefined,
      category: editForm.category || 'General',
      subcategory: editForm.subcategory || undefined,
      size: editForm.size || undefined,
      description: editForm.description || undefined,
      stock: editForm.stock ? parseInt(editForm.stock) : undefined,
    });
    setEditingItem(null);
    showToast('Item updated!');
  };

  // ── Duplicate ──
  const handleDuplicate = (item: InventoryItem) => {
    setForm({
      name: item.name, price: String(item.price), costPrice: item.costPrice ? String(item.costPrice) : '',
      sku: '', category: item.category, subcategory: item.subcategory || '', size: '', description: item.description || '', stock: '',
    });
    setAddOpen(true);
    showToast(`Copied ${item.name}. Enter the new size!`);
  };

  // ── Bulk ──
  const handleBulkAdd = async () => {
    const validRows = bulkRows.filter((r) => r.name && r.price && !isNaN(parseFloat(r.price)));
    if (validRows.length === 0) { showToast('No valid items to import'); return; }
    
    setIsProcessing(true);
    let count = 0;
    const timestamp = Date.now();

    try {
      for (const row of validRows) {
        const sizes = row.size.includes(',')
          ? row.size.split(',').map((s) => s.trim()).filter(Boolean)
          : [row.size.trim() || ''];

        for (const size of sizes) {
          const uniqueId = `item-${timestamp}-${count}-${Math.random().toString(36).substr(2, 5)}`;
          await addInventoryItem({
            id: uniqueId,
            name: row.name,
            price: parseFloat(row.price),
            costPrice: row.costPrice && !isNaN(parseFloat(row.costPrice)) ? parseFloat(row.costPrice) : undefined,
            stock: row.stock && !isNaN(parseInt(row.stock)) ? parseInt(row.stock) : undefined,
            category: row.category || 'General',
            subcategory: row.subcategory || undefined,
            size: size || undefined,
            createdAt: new Date().toISOString(),
          });
          count++;
        }
      }

      setBulkRows(Array(5).fill(null).map(emptyBulkRow));
      setBulkOpen(false);
      showToast(`Success! Imported ${count} items with variants.`);
    } catch (error) {
      console.error("Bulk Add Failed:", error);
      showToast("Sync Error: Some items might not have saved.");
    } finally {
      setIsProcessing(false);
    }
  };

  const smartPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const lines = text.split('\n').filter((l) => l.trim());
      const newRows: BulkRow[] = lines.map((line) => {
        let parts = line.split('\t');
        if (parts.length < 2) parts = line.split(',');
        if (parts.length < 2) parts = line.split(';');
        return {
          name: parts[0] || '', price: parts[1] || '', costPrice: parts[2] || '',
          stock: parts[3] || '', category: parts[4] || '', subcategory: parts[5] || '', size: parts[6] || '',
        };
      });
      setBulkRows([...newRows, emptyBulkRow()]);
      showToast(`Parsed ${newRows.length} items!`);
    } catch {
      showToast('Failed to read clipboard');
    }
  };

  const handleRowChange = (idx: number, field: keyof BulkRow, value: string) => {
    const newRows = [...bulkRows];
    newRows[idx] = { ...newRows[idx], [field]: value };
    if (idx === bulkRows.length - 1 && value !== '') newRows.push(emptyBulkRow());
    setBulkRows(newRows);
  };

  return (
    <div className="space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/50">
        <div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter leading-none mb-2">Shop Inventory</h1>
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest opacity-70">{inventory.length} Products in Catalog</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Wipe button */}
          <button
            onClick={() => setConfirmClear(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-2xl text-destructive border border-destructive/20 hover:bg-destructive/10 transition-all"
          >
            <Trash2 className="h-4 w-4" /> Wipe Stock
          </button>
          <button
            onClick={() => setBulkOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-2xl border border-border hover:bg-accent transition-all"
          >
            <FileText className="h-4 w-4" /> Bulk Add
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 premium-gradient text-white px-5 py-2.5 text-sm font-bold rounded-2xl hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
          >
            <Plus className="h-4 w-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Inventory Value', value: formatCurrency(stats.inventoryValue), color: 'text-primary' },
          { label: 'Potential Profit', value: formatCurrency(stats.potentialProfit), color: 'text-green-400' },
          { label: 'Distinct Products', value: String(stats.totalItems), color: '' },
          { label: 'Total Stock Units', value: String(stats.totalStock), color: '' },
        ].map((s) => (
          <div key={s.label} className="glass-card p-5 rounded-2xl">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{s.label}</p>
            <p className={`text-2xl font-black mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {stats.lowStock > 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-sm font-semibold text-red-400">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {stats.lowStock} item{stats.lowStock !== 1 ? 's' : ''} running low on stock! Go to the Overview tab to see which ones.
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name, category, SKU, size..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-card border border-border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
        />
      </div>

      {/* Product Grid - Variant Aware */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground opacity-40">
          <Package className="h-16 w-16 mx-auto mb-4" />
          <p className="font-bold">{search ? 'No products match your search' : 'Your inventory is empty. Add your first product!'}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Object.entries(
            filtered.reduce((acc, item) => {
              if (!acc[item.name]) acc[item.name] = [];
              acc[item.name].push(item);
              return acc;
            }, {} as Record<string, typeof filtered>)
          ).map(([name, group]) => {
            const firstItem = group[0];
            const prices = group.map(i => i.price);
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            const totalStock = group.reduce((sum, i) => sum + (i.stock || 0), 0);
            const sizes = group.map(i => i.size).filter(Boolean).sort();
            const isLow = totalStock <= 5;
            const hasVariants = group.length > 1;

            return (
              <div
                key={name}
                className={`glass-card group rounded-2xl p-5 hover:shadow-xl transition-all duration-300 border ${
                  isLow ? 'border-red-500/20' : 'border-border/30'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="relative">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    {hasVariants && (
                      <span className="absolute -top-2 -right-2 bg-primary text-[8px] font-black text-white px-1.5 py-0.5 rounded-full shadow-lg border border-background animate-pulse">
                        {group.length} VAR
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!hasVariants && (
                      <button
                        onClick={() => handleDuplicate(firstItem)}
                        className="p-1.5 hover:bg-accent rounded-lg transition-colors"
                        title="Add Variant"
                      >
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditingItem(firstItem);
                        setEditForm({
                          name: firstItem.name, price: String(firstItem.price),
                          costPrice: firstItem.costPrice ? String(firstItem.costPrice) : '',
                          sku: firstItem.sku || '', category: firstItem.category,
                          subcategory: firstItem.subcategory || '', size: firstItem.size || '',
                          description: firstItem.description || '',
                          stock: firstItem.stock !== undefined ? String(firstItem.stock) : '',
                        });
                      }}
                      className="p-1.5 hover:bg-accent rounded-lg transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => {
                        Promise.all(group.map(i => deleteInventoryItem(i.id)))
                          .then(() => showToast(`Product & ${group.length} variants deleted`));
                      }}
                      className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors text-muted-foreground hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5 px-0.5" />
                    </button>
                  </div>
                </div>

                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter mt-0.5">
                    {firstItem.category}{firstItem.subcategory ? ` · ${firstItem.subcategory}` : ''}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1 mt-3 mb-4 min-h-[22px]">
                  {sizes.length > 0 ? (
                    sizes.map(s => (
                      <span key={s} className="text-[9px] bg-accent text-foreground px-2 py-0.5 rounded-md font-black uppercase">
                        {s}
                      </span>
                    ))
                  ) : (
                    <span className="text-[9px] italic text-muted-foreground opacity-50">No size variants</span>
                  )}
                </div>

                <div className="flex justify-between items-end">
                  <div>
                    {hasVariants ? (
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-black uppercase text-primary tracking-widest leading-none">Price Range</p>
                        <p className="text-xl font-black text-foreground">
                          {formatCurrency(minPrice)} - {formatCurrency(maxPrice)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-2xl font-black text-primary leading-none">{formatCurrency(firstItem.price)}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-muted-foreground uppercase opacity-60">Total Stock</p>
                    <p className={`text-sm font-black ${isLow ? 'text-destructive' : 'text-primary'}`}>
                      {totalStock} <span className="text-[9px] uppercase">Units</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Product Modal ── */}
      <Modal open={addOpen} onClose={() => { setAddOpen(false); setForm(emptyForm); setVariantMatrix([]); }} title="Add New Product">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Product Name *</Label>
              <Input placeholder="e.g. Wireless Mouse" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>SKU / Barcode</Label>
              <Input placeholder="Optional" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input placeholder="Category" value={form.category} list="hub-cats"
                onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <datalist id="hub-cats">{uniqueCategories.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="space-y-1.5">
              <Label>Sub-category</Label>
              <Input placeholder="Sub-category" value={form.subcategory}
                onChange={(e) => setForm({ ...form, subcategory: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="block min-h-[1.25rem]">Sell Price (₹) *</Label>
              <Input type="number" placeholder="0.00" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="block min-h-[1.25rem]">Cost Price (₹)</Label>
              <Input type="number" placeholder="0.00" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="block min-h-[1.25rem]">Stock</Label>
              <Input type="number" placeholder="∞" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="block min-h-[1.25rem]">Size / Variant</Label>
              <Input placeholder="S,M,L…" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} />
              <p className="text-[9px] text-muted-foreground italic leading-none mt-1">Comma-separated</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input placeholder="Optional details..." value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          {/* Variant Matrix */}
          {variantMatrix.length > 0 && (
            <div className="space-y-3 p-4 bg-primary/5 rounded-2xl border border-primary/10">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <Database className="h-3 w-3" /> Variation Pricing & Stock
              </p>
              <div className="overflow-x-auto rounded-xl border border-border/50">
                <table className="w-full text-xs">
                  <thead className="bg-accent/50">
                    <tr>
                      {['Variation', 'Sell Price', 'Cost Price', 'Stock'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-bold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {variantMatrix.map((row, idx) => (
                      <tr key={idx} className="border-t border-border/30">
                        <td className="px-3 py-1.5 font-semibold">
                          {row.sub && row.size ? `${row.sub} / ${row.size}` : row.sub || row.size || 'Default'}
                        </td>
                        {(['price', 'costPrice', 'stock'] as const).map((field) => (
                          <td key={field} className="px-1 py-1">
                            <input
                              type="number"
                              value={row[field]}
                              className="w-full px-2 py-1 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                              onChange={(e) => {
                                const nm = [...variantMatrix];
                                nm[idx] = { ...nm[idx], [field]: e.target.value };
                                setVariantMatrix(nm);
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <button
            onClick={handleAdd}
            className="w-full premium-gradient text-white py-3 rounded-2xl font-bold text-sm hover:shadow-xl transition-all"
          >
            {variantMatrix.length > 1 ? `Save ${variantMatrix.length} Variations` : 'Save Product'}
          </button>
        </div>
      </Modal>

      {/* ── Edit Product Modal ── */}
      <Modal open={!!editingItem} onClose={() => setEditingItem(null)} title="Edit Product">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Product Name</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>SKU</Label><Input value={editForm.sku} onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Category</Label><Input value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Sub-category</Label><Input value={editForm.subcategory} onChange={(e) => setEditForm({ ...editForm, subcategory: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1.5"><Label>Sell Price</Label><Input type="number" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Cost Price</Label><Input type="number" value={editForm.costPrice} onChange={(e) => setEditForm({ ...editForm, costPrice: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Stock</Label><Input type="number" value={editForm.stock} onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Size</Label><Input value={editForm.size} onChange={(e) => setEditForm({ ...editForm, size: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Description</Label><Input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></div>
          <div className="flex gap-3">
            <button onClick={() => setEditingItem(null)} className="flex-1 py-3 rounded-2xl font-bold text-sm border border-border hover:bg-accent transition-all">Cancel</button>
            <button onClick={handleUpdate} className="flex-1 premium-gradient text-white py-3 rounded-2xl font-bold text-sm hover:shadow-xl transition-all">Save Changes</button>
          </div>
        </div>
      </Modal>

      {/* ── Bulk Add Modal ── */}
      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title="Bulk Inventory Entry" wide>
        <div className="space-y-4">
          <div className="flex gap-2">
            <button onClick={smartPaste}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all">
              <ClipboardPaste className="h-4 w-4" /> Smart Paste
            </button>
            <button onClick={() => setBulkRows(Array(5).fill(null).map(emptyBulkRow))}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl border border-border hover:bg-accent transition-all">
              <Trash2 className="h-4 w-4" /> Clear
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Tip: Copy rows from Excel/Sheets and click Smart Paste!</p>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-xs">
              <thead className="bg-accent/50 sticky top-0">
                <tr>
                  {['#', 'Product Name *', 'Category', 'Sub-cat', 'Size (comma = variants)', 'Sell Price *', 'Cost Price', 'Stock', ''].map((h, i) => (
                    <th key={i} className="px-3 py-3 text-left font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bulkRows.map((row, idx) => (
                  <tr key={idx} className="group border-t border-border/50 hover:bg-accent/10 transition-colors">
                    <td className="px-3 py-1 text-muted-foreground font-mono text-center">{idx + 1}</td>
                    {(['name', 'category', 'subcategory', 'size', 'price', 'costPrice', 'stock'] as const).map((field) => (
                      <td key={field} className="p-1">
                        {field === 'size' ? (
                          <div className="relative">
                            <input
                              type="text"
                              value={row[field]}
                              placeholder="e.g. S,M,L or 11,12,32"
                              onChange={(e) => handleRowChange(idx, field, e.target.value)}
                              className="w-full h-8 px-2 bg-transparent border-transparent focus:border-primary/30 focus:bg-background border rounded-lg text-[11px] focus:outline-none transition-all min-w-[100px]"
                            />
                            {row[field].includes(',') && (
                              <span className="absolute -top-2.5 right-0 text-[9px] font-black uppercase bg-primary text-white px-1.5 py-0.5 rounded-full leading-none">
                                ×{row[field].split(',').filter(s => s.trim()).length} variants
                              </span>
                            )}
                          </div>
                        ) : (
                          <input
                            type={['price', 'costPrice', 'stock'].includes(field) ? 'number' : 'text'}
                            value={row[field]}
                            placeholder={field === 'name' ? 'Product Name' : field === 'price' ? '0.00' : field === 'stock' ? '∞' : ''}
                            onChange={(e) => handleRowChange(idx, field, e.target.value)}
                            className="w-full h-8 px-2 bg-transparent border-transparent focus:border-primary/30 focus:bg-background border rounded-lg text-[11px] focus:outline-none transition-all min-w-[80px]"
                          />
                        )}
                      </td>
                    ))}
                    <td className="p-1">
                      <button
                        onClick={() => {
                          const newRows = bulkRows.filter((_, i) => i !== idx);
                          setBulkRows(newRows.length ? newRows : Array(5).fill(null).map(emptyBulkRow));
                        }}
                        className="p-1 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center pt-2">
            <p className="text-xs text-muted-foreground">* Required fields</p>
            <div className="flex gap-3">
              <button onClick={() => setBulkOpen(false)} className="px-5 py-2.5 rounded-2xl font-bold text-sm border border-border hover:bg-accent transition-all">Cancel</button>
              <button
                onClick={handleBulkAdd}
                disabled={isProcessing || !bulkRows.some((r) => r.name && r.price)}
                className="premium-gradient text-white px-6 py-2.5 rounded-2xl font-bold text-sm hover:shadow-xl transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : 'Process & Save All'}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Confirm Clear Dialog ── */}
      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={async () => {
          await clearInventory();
          showToast('Inventory wiped!');
        }}
        title="Wipe Entire Stock?"
        description={`You are about to permanently delete all ${inventory.length} items. This action cannot be reversed.`}
        confirmText="Yes, Wipe All"
        variant="danger"
      />

      {/* ── Toast Notification ── */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4">
          <div className="bg-white text-black px-6 py-3 rounded-2xl shadow-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 border border-white/20">
            <Sparkles className="h-4 w-4 text-primary" />
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
