import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus, Minus, Package, Trash2, Pencil, Search, Tag, Database,
  X, FileText, ClipboardPaste, Copy, AlertCircle, AlertTriangle, Sparkles, Loader2,
  PackagePlus
} from 'lucide-react';
import { calculateSalesVelocity, calculateDaysRemaining } from '@/lib/analyticsUtils';
import ErrorModal from '@/components/ErrorModal';
import { useSqlQuery } from '@/db/hooks';
import { useBusinessStore } from '@/lib/useBusinessStore';
import { formatCurrency, cn } from '@/lib/utils';
import type { InventoryItem, Sale } from '@/lib/types';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useAuthStore } from '@/lib/useAuthStore';
import Modal from '@/components/Modal';
import Label from '@/components/Label';
import Input from '@/components/Input';
import { usePermission } from '@/hooks/usePermission';


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

// ─── Inventory Card Component ───────────────────────────────────────────────

const InventoryCard = ({ 
  item, 
  role, 
  onRestock, 
  setRestockForm, 
  onEdit, 
  setEditForm, 
  onDelete,
  sales
}: { 
  item: InventoryItem, 
  role: string,
  onRestock: (item: InventoryItem) => void,
  setRestockForm: any,
  onEdit: (item: InventoryItem) => void,
  setEditForm: any,
  onDelete: (id: string) => void,
  sales: Sale[]
}) => {
  const isLow = item.stock !== undefined && item.stock <= 5;
  const velocity = calculateSalesVelocity(item.id, sales);
  const daysLeft = calculateDaysRemaining(item.stock || 0, velocity);

  return (
    <div
      className={`glass-card group rounded-xl p-3 hover:shadow-lg transition-all border flex flex-col justify-between min-h-[160px] lg:min-h-[220px] ${
        isLow ? 'border-destructive/20' : 'border-border/20'
      }`}
    >
      <div className="space-y-2">
        <div className={`flex items-center justify-between gap-2 overflow-hidden ${usePermission('inventory', 'edit') || usePermission('inventory', 'delete') ? 'pr-12' : ''}`}>
          <p className="font-extrabold text-lg uppercase tracking-tight truncate flex-1">{item.name}</p>
          
          {(usePermission('inventory', 'edit') || usePermission('inventory', 'delete')) && (
            <div className="absolute top-2 right-2 flex gap-1.5 opacity-100 transition-all">
              {usePermission('inventory', 'edit') && (
                <>
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onRestock(item); 
                  setRestockForm({ qty: '', cost: (item.costPrice || 0).toString(), newSellPrice: '' }); 
                }}
                className="p-3 rounded-xl bg-emerald-500 text-white shadow-lg hover:scale-110 active:scale-95 transition-all"
                title="Restock Arrival"
              >
                <PackagePlus className="h-4 w-4" />
              </button>
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onEdit(item); 
                  setEditForm({ 
                    name: item.name, 
                    price: item.price.toString(), 
                    costPrice: item.costPrice?.toString() || '', 
                    sku: item.sku || '', 
                    category: item.category, 
                    subcategory: item.subcategory || '', 
                    size: item.size || '', 
                    description: item.description || '', 
                    stock: item.stock?.toString() || '0' 
                  }); 
                }}
                  className="p-3 rounded-xl bg-primary text-primary-foreground shadow-lg hover:scale-110 active:scale-95 transition-all"
                title="Edit Details"
              >
                <Pencil className="h-4 w-4" />
              </button>
              </>
              )}
              {usePermission('inventory', 'delete') && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                  className="p-3 rounded-xl bg-destructive text-white shadow-lg hover:scale-110 active:scale-95 transition-all"
                  title="Delete Product"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-black uppercase rounded-lg border border-primary/20">
            {item.category}
          </span>
          {item.size && (
            <span className="px-2.5 py-1 bg-purple-500/10 text-purple-500 text-xs font-black uppercase rounded-lg border border-purple-500/20">
              {item.size}
            </span>
          )}
          {item.velocity?.status && (
            <span className={cn(
              "px-2.5 py-1 text-[9px] font-black uppercase rounded-lg border flex items-center gap-1.5",
              item.velocity.status === 'fast' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" :
              item.velocity.status === 'medium' ? "bg-amber-500/10 text-amber-500 border-amber-500/30" :
              item.velocity.status === 'slow' ? "bg-amber-500/10 text-amber-500 border-amber-500/30" :
              "bg-destructive/10 text-destructive border-destructive/30"
            )}>
              <span className={cn(
                "h-1 w-1 rounded-full",
                item.velocity.status === 'fast' ? "bg-emerald-500 animate-pulse" :
                item.velocity.status === 'medium' ? "bg-amber-500" :
                item.velocity.status === 'slow' ? "bg-amber-500" : "bg-destructive"
              )} />
              {item.velocity.status}
            </span>
          )}
        </div>
      </div>

      <div className="mt-auto pt-4 border-t border-border/10">
        <div className="flex items-center justify-between bg-accent/20 p-3 rounded-xl gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-muted-foreground uppercase opacity-60 tracking-wider">Sell Price</span>
            <p className="font-black text-lg text-foreground">{formatCurrency(item.price)}</p>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black text-muted-foreground uppercase opacity-60 tracking-wider">In Stock</span>
            <p className={`font-black text-lg ${isLow ? 'text-destructive' : 'text-primary'}`}>
              {item.stock || 0}
            </p>
            {daysLeft !== 'Infinity' && (
              <span className={cn(
                "text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md mt-0.5",
                daysLeft <= 3 ? "bg-destructive/10 text-destructive animate-pulse" : "bg-primary/10 text-primary"
              )}>
                ±{daysLeft} days left
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

export default function Inventory() {
  const { addInventoryItem, updateInventoryItem, updateStock, deleteInventoryItem, clearInventory, inventorySearchTerm, setInventorySearchTerm, restockItem, role } = useBusinessStore();
  const inventory = useSqlQuery<InventoryItem>('SELECT * FROM inventory WHERE tombstone = 0 ORDER BY name ASC', [], ['inventory']);
  const inventoryPrivate = useSqlQuery<any>('SELECT * FROM inventory_private WHERE tombstone = 0', [], ['inventory_private']);
  const sales = useSqlQuery<Sale>('SELECT * FROM sales WHERE tombstone = 0 ORDER BY createdAt DESC', [], ['sales']);

  const canViewCost = usePermission('inventory', 'view_cost');

  const inventoryWithPrivate = useMemo(() => {
    if (!canViewCost) return inventory;
    return inventory.map((item: InventoryItem) => ({
      ...item,
      costPrice: inventoryPrivate.find((pi: any) => pi.id === item.id)?.costPrice
    }));
  }, [inventory, inventoryPrivate, canViewCost]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [search, setSearch] = useState('');
  const [localSearch, setLocalSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [restockOpen, setRestockOpen] = useState<InventoryItem | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [errorModal, setErrorModal] = useState({ show: false, title: '', message: '' });
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [restockForm, setRestockForm] = useState({ qty: '', cost: '', newSellPrice: '' });
  const [variantMatrix, setVariantMatrix] = useState<MatrixRow[]>([]);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>(Array(5).fill(null).map(emptyBulkRow));
  const [toast, setToast] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('All');

  // ─── Drill-down / Navigation State ──────────────────────────────────────
  const [drillDepth, setDrillDepth] = useState<0 | 1 | 2>(0);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeProductName, setActiveProductName] = useState<string | null>(null);

  // Sync with Browser History (Back Button Support)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.depth !== undefined) {
        setDrillDepth(event.state.depth);
        setActiveCategory(event.state.category);
        setActiveProductName(event.state.product);
      } else {
        setDrillDepth(0);
        setActiveCategory(null);
        setActiveProductName(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (depth: 0 | 1 | 2, cat: string | null = null, prod: string | null = null) => {
    setDrillDepth(depth);
    setActiveCategory(cat);
    setActiveProductName(prod);
    setLocalSearch('');
    window.history.pushState({ depth, category: cat, product: prod }, '');
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // ── Autocomplete data ──
  const uniqueCategoriesSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    inventoryWithPrivate.forEach((item: InventoryItem) => {
      const cat = item.category || 'General';
      if (!counts[cat]) counts[cat] = 0;
      const productNamesInCategory = new Set(inventoryWithPrivate.filter((i: InventoryItem) => (i.category || 'General') === cat).map((i: InventoryItem) => i.name));
      counts[cat] = productNamesInCategory.size;
    });
    return counts;
  }, [inventoryWithPrivate]);

  const filteredCategoriesSummary = useMemo(() => {
    if (!localSearch) return uniqueCategoriesSummary;
    const filtered: Record<string, number> = {};
    Object.entries(uniqueCategoriesSummary).forEach(([cat, count]) => {
      if (cat.toLowerCase().includes(localSearch.toLowerCase())) {
        filtered[cat] = count;
      }
    });
    return filtered;
  }, [uniqueCategoriesSummary, localSearch]);

  const productNamesInCategory = useMemo(() => {
    if (!activeCategory) return {};
    const groups: Record<string, { items: InventoryItem[], totalStock: number, totalCost: number, totalValue: number }> = {};
    inventoryWithPrivate.filter((i: InventoryItem) => (i.category || 'General') === activeCategory).forEach((item: InventoryItem) => {
      if (!groups[item.name]) groups[item.name] = { items: [], totalStock: 0, totalCost: 0, totalValue: 0 };
      groups[item.name].items.push(item);
      groups[item.name].totalStock += (item.stock || 0);
      groups[item.name].totalCost += (item.costPrice || 0) * (item.stock || 0);
      groups[item.name].totalValue += (item.price || 0) * (item.stock || 0);
    });
    return groups;
  }, [inventoryWithPrivate, activeCategory]);

  const filteredProductNamesInCategory = useMemo(() => {
    if (!localSearch) return productNamesInCategory;
    const filtered: Record<string, { items: InventoryItem[], totalStock: number, totalCost: number, totalValue: number }> = {};
    Object.entries(productNamesInCategory).forEach(([name, data]) => {
       if (name.toLowerCase().includes(localSearch.toLowerCase())) {
         filtered[name] = data;
       }
    });
    return filtered;
  }, [productNamesInCategory, localSearch]);

  const itemsInSelectedProduct = useMemo(() => {
    if (!activeCategory || !activeProductName) return [];
    return inventoryWithPrivate.filter((i: any) => (i.category || 'General') === activeCategory && i.name === activeProductName);
  }, [inventoryWithPrivate, activeCategory, activeProductName]);

  const filteredItemsInSelectedProduct = useMemo(() => {
    if (!localSearch) return itemsInSelectedProduct;
    return itemsInSelectedProduct.filter((i: any) => 
      i.name.toLowerCase().includes(localSearch.toLowerCase()) || 
      (i.sku?.toLowerCase() ?? '').includes(localSearch.toLowerCase()) ||
      (i.size?.toLowerCase() ?? '').includes(localSearch.toLowerCase())
    );
  }, [itemsInSelectedProduct, localSearch]);

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
    inventoryWithPrivate.filter((i: any) => {
      const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase()) || 
                           i.sku?.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || i.category === selectedCategory;
      const matchesSubcategory = selectedSubcategory === 'all' || i.subcategory === selectedSubcategory;
      return matchesSearch && matchesCategory && matchesSubcategory;
    }),
    [inventoryWithPrivate, search, selectedCategory, selectedSubcategory]
  );

  // ── Stats ──
  const stats = useMemo(() => ({
    totalItems: inventoryWithPrivate.length,
    totalStock: inventoryWithPrivate.reduce((s: number, i: any) => s + (i.stock || 0), 0),
    inventoryValue: inventoryWithPrivate.reduce((s: number, i: any) => s + i.price * (i.stock || 0), 0),
    potentialProfit: inventoryWithPrivate.reduce((s: number, i: any) => {
      if (i.costPrice !== undefined && i.stock !== undefined) return s + (i.price - i.costPrice) * i.stock;
      return s;
    }, 0),
    lowStock: inventoryWithPrivate.filter((i: any) => i.stock !== undefined && i.stock <= 5).length,
  }), [inventoryWithPrivate]);

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

  const handleRestock = async () => {
    if (!restockOpen) return;
    const q = parseFloat(restockForm.qty);
    const c = parseFloat(restockForm.cost);
    if (isNaN(q) || isNaN(c) || q <= 0) {
      showToast('Please enter valid quantity and cost');
      return;
    }

    try {
      setIsProcessing(true);
      
      // If a new sell price is provided, update it first
      const s = parseFloat(restockForm.newSellPrice);
      if (!isNaN(s) && s > 0) {
        await updateInventoryItem({ ...restockOpen, price: s });
      }

      await restockItem(restockOpen.id, q, c);
      showToast(`Restocked ${restockOpen.name} successfully!`);
      setRestockOpen(null);
      setRestockForm({ qty: '', cost: '', newSellPrice: '' });
    } catch (err: any) {
      setErrorModal({ show: true, title: 'Restock Error', message: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Update ──
  const handleUpdate = async () => {
    if (!editingItem) return;
    
    setIsProcessing(true);
    try {
      // Ensure we have at least a name
      const finalName = editForm.name || editingItem.name || "Unnamed Product";
      const finalPrice = parseFloat(String(editForm.price)) || 0;
      
      await updateInventoryItem({
        ...editingItem,
        name: finalName,
        price: finalPrice,
        costPrice: editForm.costPrice ? parseFloat(String(editForm.costPrice)) : 0,
        sku: editForm.sku || "",
        category: editForm.category || 'General',
        subcategory: editForm.subcategory || "",
        size: editForm.size || "",
        description: editForm.description || "",
        stock: editForm.stock ? parseInt(String(editForm.stock)) : 0,
      });
      setEditingItem(null);
      showToast('Item updated!');
    } catch (err: any) {
      console.error("Update Failed:", err);
      setErrorModal({ show: true, title: 'Update Error', message: err.message || 'Failed to save changes.' });
    } finally {
      setIsProcessing(false);
    }
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

        for (const sizeStr of sizes) {
          let variantSize = sizeStr;
          let variantPrice = parseFloat(row.price);

          // Support for Syntax SIZE:PRICE (e.g., S:100)
          if (sizeStr.includes(':')) {
            const [sz, pr] = sizeStr.split(':');
            variantSize = sz.trim();
            const parsedPr = parseFloat(pr);
            if (!isNaN(parsedPr)) variantPrice = parsedPr;
          }

          const uniqueId = `item-${timestamp}-${count}-${Math.random().toString(36).substr(2, 5)}`;
          await addInventoryItem({
            id: uniqueId,
            name: row.name,
            price: variantPrice,
            costPrice: row.costPrice && !isNaN(parseFloat(row.costPrice)) ? parseFloat(row.costPrice) : undefined,
            stock: row.stock && !isNaN(parseInt(row.stock)) ? parseInt(row.stock) : undefined,
            category: row.category || 'General',
            subcategory: row.subcategory || undefined,
            size: variantSize || undefined,
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
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest opacity-70">{inventoryWithPrivate.length} Products in Catalog</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ...(usePermission('inventory', 'view_cost') ? [
            { label: 'Inventory Value', value: formatCurrency(stats.inventoryValue || 0), color: 'text-primary' },
            { label: 'Potential Profit', value: formatCurrency(stats.potentialProfit || 0), color: 'text-emerald-500' },
          ] : []),
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
        <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-sm font-semibold text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {stats.lowStock} item{stats.lowStock !== 1 ? 's' : ''} running low on stock! Go to the Overview tab to see which ones.
        </div>
      )}

      {/* ── Breadcrumbs & Navigation ── */}
      {!search && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2 pb-1 overflow-x-auto whitespace-nowrap scrollbar-hide flex-1">
            <button 
              onClick={() => navigateTo(0)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                drillDepth === 0 ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              All Categories
            </button>
            
            {drillDepth >= 1 && activeCategory && (
              <>
                <span className="text-muted-foreground/30 font-bold">/</span>
                <button 
                  onClick={() => navigateTo(1, activeCategory)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    drillDepth === 1 ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {activeCategory}
                </button>
              </>
            )}

            {drillDepth >= 2 && activeProductName && (
              <>
                <span className="text-muted-foreground/30 font-bold">/</span>
                <button 
                  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-primary text-primary-foreground shadow-lg"
                >
                  {activeProductName}
                </button>
              </>
            )}
          </div>
          
          {/* LOCAL FILTER SEARCH BAR */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              type="text"
              placeholder={`Filter ${drillDepth === 0 ? 'Categories' : drillDepth === 1 ? 'Products' : 'Variants'}...`}
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-accent/30 border border-border/50 rounded-xl text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-1 focus:ring-primary/30 shadow-inner"
            />
            {localSearch && (
              <button 
                onClick={() => setLocalSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded-full"
              >
                <X className="h-2.5 w-2.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Management Actions - Command Center */}
      <div className="flex flex-wrap gap-3 p-4 bg-accent/20 border border-border/30 rounded-2xl">
        <button
          onClick={() => setConfirmClear(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl text-destructive border border-destructive/20 hover:bg-destructive/10 transition-all"
        >
          <Trash2 className="h-4 w-4" /> Wipe Stock
        </button>
        <button
          onClick={() => setBulkOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl border border-border hover:bg-accent transition-all"
        >
          <FileText className="h-4 w-4" /> Bulk Add
        </button>
        <button
          onClick={() => {
            setForm({ ...emptyForm, category: activeCategory || '' });
            setAddOpen(true);
          }}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 premium-gradient text-white px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
        >
          <Plus className="h-4 w-4" /> {activeCategory ? `Add in ${activeCategory}` : 'Add Product'}
        </button>
      </div>

      {/* Global Search Bar - SEARCHES ENTIRE INVENTORY */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
        <input
          type="text"
          placeholder="SEARCH ENTIRE SHOP (Bypass Categories)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-4 bg-card border-2 border-primary/20 rounded-2xl text-[12px] font-black uppercase tracking-widest placeholder:opacity-50 focus:outline-none focus:ring-4 focus:ring-primary/10 shadow-lg transition-all"
        />
      </div>

      {/* Content Switcher */}
      {search ? (
        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary">Search Results</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((item: InventoryItem) => (
              <InventoryCard 
                key={item.id} 
                item={item} 
                role={role || 'staff'} 
                onRestock={(item) => {
                  setRestockOpen(item);
                  setRestockForm({ qty: '', cost: (item.costPrice || 0).toString(), newSellPrice: '' });
                }}
                setRestockForm={setRestockForm}
                onEdit={(it) => {
                  setEditingItem(it);
                  setEditForm({ 
                    ...it, 
                    price: (it.price ?? 0).toString(), 
                    costPrice: (it.costPrice ?? 0).toString(), 
                    stock: (it.stock ?? 0).toString(),
                    sku: it.sku || '',
                    subcategory: it.subcategory || '',
                    size: it.size || '',
                    description: it.description || ''
                  });
                }}
                setEditForm={setEditForm}
                onDelete={deleteInventoryItem}
                sales={sales}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="min-h-[400px]">
          {/* LEVEL 0: Category Selection */}
          {drillDepth === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Object.entries(filteredCategoriesSummary).map(([cat, count]: [string, any]) => (
                <button
                  key={cat}
                  onClick={() => navigateTo(1, cat)}
                  className="glass-card group p-6 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 hover:scale-105 hover:shadow-2xl transition-all border-2 border-border/10 hover:border-primary/50"
                >
                  <div className="h-16 w-16 rounded-[1.5rem] bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Tag className="h-8 w-8 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="font-black text-lg uppercase tracking-tighter leading-tight truncate px-2">{cat}</p>
                    <p className="text-xs font-black text-muted-foreground uppercase opacity-40 tracking-widest mt-1">
                      {count} Products
                    </p>
                  </div>
                </button>
              ))}
              {Object.keys(filteredCategoriesSummary).length === 0 && (
                <div className="col-span-full py-20 text-center opacity-40">
                  <Database className="h-12 w-12 mx-auto mb-4" />
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Catalog Empty</p>
                </div>
              )}
            </div>
          )}

          {/* LEVEL 1: Product Name Selection */}
          {drillDepth === 1 && activeCategory && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Object.entries(filteredProductNamesInCategory).map(([name, data]: [string, any]) => (
                <button
                  key={name}
                  onClick={() => navigateTo(2, activeCategory, name)}
                  className="glass-card group p-5 rounded-[2rem] flex flex-col items-start gap-4 hover:scale-105 hover:shadow-2xl transition-all border border-border/20 hover:border-primary/40 text-left w-full"
                >
                  <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                    <Package className="h-5 w-5" />
                  </div>
                  <div className="w-full">
                    <p className="font-black text-base uppercase tracking-tight truncate w-full">{name}</p>
                    <div className="flex justify-between items-center mt-2">
                       <p className="text-xs font-black text-muted-foreground uppercase opacity-40 tracking-widest">
                        {data.items.length} Variants
                      </p>
                      <p className={`text-sm font-bold ${data.totalStock <= 5 ? 'text-destructive' : 'text-primary'}`}>
                        {data.totalStock} units
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* LEVEL 2: Variant Details */}
          {drillDepth === 2 && activeCategory && activeProductName && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItemsInSelectedProduct.map((item: InventoryItem) => (
                <InventoryCard 
                  key={item.id} 
                  item={item} 
                  role={role || 'staff'} 
                  onRestock={() => {
                    setRestockOpen(item);
                    setRestockForm({ qty: '', cost: (item.costPrice || 0).toString(), newSellPrice: '' });
                  }}
                  setRestockForm={setRestockForm}
                  onEdit={(it) => {
                    setEditingItem(it);
                    setEditForm({ 
                      ...it, 
                      price: (it.price ?? 0).toString(), 
                      costPrice: (it.costPrice ?? 0).toString(), 
                      stock: (it.stock ?? 0).toString(),
                      sku: it.sku || '',
                      subcategory: it.subcategory || '',
                      size: it.size || '',
                      description: it.description || ''
                    });
                  }}
                  setEditForm={setEditForm}
                  onDelete={deleteInventoryItem}
                  sales={sales}
                />
              ))}
            </div>
          )}
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
              <datalist id="hub-cats">{Object.keys(uniqueCategoriesSummary).map((c) => <option key={c} value={c} />)}</datalist>
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
            {usePermission('inventory', 'view_cost') && (
              <div className="space-y-1.5">
                <Label className="block min-h-[1.25rem]">Cost Price (₹)</Label>
                <Input type="number" placeholder="0.00" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
              </div>
            )}
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
                      {['Variation', 'Sell Price', ...(usePermission('inventory', 'view_cost') ? ['Cost Price'] : []), 'Stock'].map((h) => (
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
                        {(['price', ...(usePermission('inventory', 'view_cost') ? ['costPrice'] as const : []), 'stock'] as const).map((field) => (
                          <td key={field} className="px-1 py-1">
                            <input
                              type="number"
                              value={(row as any)[field]}
                              className="w-full px-2 py-1 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                              onChange={(e) => {
                                const nm = [...variantMatrix];
                                (nm[idx] as any)[field] = e.target.value;
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

      {/* ── Restock Arrival Modal ── */}
      <Modal open={!!restockOpen} onClose={() => setRestockOpen(null)} title="Restock Arrival 📦">
        <div className="space-y-6">
          <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 space-y-2">
            <h3 className="text-sm font-bold text-emerald-500 uppercase tracking-tighter">Current Status</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-black text-muted-foreground">Original Stock</span>
                <p className="text-lg font-black">{restockOpen?.stock || 0} units</p>
              </div>
              {usePermission('inventory', 'view_cost') && (
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-black text-muted-foreground">Current Cost</span>
                  <p className="text-lg font-black text-amber-500">{formatCurrency(restockOpen?.costPrice || 0)}</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-black text-muted-foreground">Quantity Added</Label>
              <Input 
                autoFocus
                type="number" 
                placeholder="e.g. 10" 
                value={restockForm.qty} 
                onChange={(e) => setRestockForm({ ...restockForm, qty: e.target.value })} 
              />
            </div>
            {usePermission('inventory', 'view_cost') && (
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-amber-500">New Purchase Price</Label>
                <Input 
                  type="number" 
                  placeholder="₹ Per Unit" 
                  value={restockForm.cost} 
                  onChange={(e) => setRestockForm({ ...restockForm, cost: e.target.value })} 
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-black text-primary">Optional: New Sell Price</Label>
            <Input 
              type="number" 
              placeholder={`Current: ₹${restockOpen?.price}`} 
              value={restockForm.newSellPrice} 
              onChange={(e) => setRestockForm({ ...restockForm, newSellPrice: e.target.value })} 
            />
            <p className="text-[9px] text-muted-foreground font-bold">Leave blank to keep current price</p>
          </div>

          {restockForm.qty && restockForm.cost && restockOpen && usePermission('inventory', 'view_cost') && (
            <div className="space-y-3">
              <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-between items-center">
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-black text-primary">New Avg Cost</span>
                    <p className="text-xl font-black text-primary">
                      {formatCurrency(
                        (( (restockOpen?.stock || 0) * (restockOpen?.costPrice || 0) ) + 
                         ( parseFloat(restockForm.qty) * parseFloat(restockForm.cost) )) / 
                        ( (restockOpen?.stock || 0) + parseFloat(restockForm.qty) )
                      )}
                    </p>
                  </div>
                  <div className="text-right space-y-0.5">
                    <span className="text-[10px] uppercase font-black text-muted-foreground">Total Units</span>
                    <p className="text-xl font-black">{(restockOpen?.stock || 0) + parseFloat(restockForm.qty)}</p>
                  </div>
                </div>
              </div>

              {restockForm.newSellPrice && (
                <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 animate-in zoom-in duration-300">
                   <div className="flex justify-between items-center">
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-black text-emerald-500">New Profit / Unit</span>
                      <p className="text-xl font-black text-emerald-500">
                        {formatCurrency(parseFloat(restockForm.newSellPrice) - parseFloat(restockForm.cost))}
                      </p>
                    </div>
                    <div className="text-right space-y-0.5">
                      <p className="text-[8px] font-black text-muted-foreground uppercase opacity-60">Insight</p>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-emerald-500 uppercase">Margin: {(( (parseFloat(restockForm.newSellPrice) - parseFloat(restockForm.cost)) / parseFloat(restockForm.newSellPrice) ) * 100).toFixed(1)}%</span>
                        <span className="text-[10px] font-black text-primary uppercase">Markup: {(( (parseFloat(restockForm.newSellPrice) - parseFloat(restockForm.cost)) / parseFloat(restockForm.cost) ) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button 
              onClick={() => setRestockOpen(null)} 
              disabled={isProcessing}
              className="flex-1 py-4 rounded-2xl font-bold text-sm border border-border hover:bg-accent transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleRestock} 
              disabled={isProcessing}
              className="flex-1 premium-gradient text-white py-4 rounded-2xl font-bold text-sm hover:shadow-xl transition-all shadow-lg active:scale-95 disabled:opacity-50"
            >
              {isProcessing ? 'Processing Arrival...' : 'Commit Arrival ✨'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Edit Product Modal ── */}
      <Modal open={!!editingItem} onClose={() => setEditingItem(null)} title="Edit Product">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-muted-foreground">Product Name</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-muted-foreground">SKU (Option)</Label><Input value={editForm.sku} onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-muted-foreground">Category</Label><Input value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-muted-foreground">Sub-category</Label><Input value={editForm.subcategory} onChange={(e) => setEditForm({ ...editForm, subcategory: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-muted-foreground">Sell Price</Label><Input type="number" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} /></div>
            {usePermission('inventory', 'view_cost') && (
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-amber-500">Cost Price</Label><Input type="number" value={editForm.costPrice} onChange={(e) => setEditForm({ ...editForm, costPrice: e.target.value })} /></div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-muted-foreground">Stock</Label><Input type="number" value={editForm.stock} onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-muted-foreground">Size</Label><Input value={editForm.size} onChange={(e) => setEditForm({ ...editForm, size: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-muted-foreground">Description</Label><Input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></div>
          <div className="flex gap-3">
            <button onClick={() => setEditingItem(null)} disabled={isProcessing} className="flex-1 py-3 rounded-2xl font-bold text-sm border border-border hover:bg-accent transition-all disabled:opacity-30">Cancel</button>
            <button onClick={handleUpdate} disabled={isProcessing} className="flex-1 premium-gradient text-white py-3 rounded-2xl font-bold text-sm hover:shadow-xl transition-all disabled:opacity-50">
              {isProcessing ? 'Updating...' : 'Save Changes'}
            </button>
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
                  {['#', 'Product Name *', 'Category', 'Sub-cat', 'Size (comma = variants)', 'Sell Price *', ...(usePermission('inventory', 'view_cost') ? ['Cost Price'] : []), 'Stock', ''].map((h, i) => (
                    <th key={i} className="px-3 py-3 text-left font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bulkRows.map((row, idx) => (
                  <tr key={idx} className="group border-t border-border/50 hover:bg-accent/10 transition-colors">
                    <td className="px-3 py-1 text-muted-foreground font-mono text-center">{idx + 1}</td>
                    {(['name', 'category', 'subcategory', 'size', 'price', ...(usePermission('inventory', 'view_cost') ? ['costPrice'] as const : []), 'stock'] as const).map((field) => (
                      <td key={field} className="p-1">
                        {field === 'size' ? (
                          <div className="relative">
                            <input
                              type="text"
                              value={(row as any)[field]}
                              placeholder="e.g. S,M,L or 11,12,32"
                              onChange={(e) => handleRowChange(idx, field as any, e.target.value)}
                              className="w-full h-8 px-2 bg-transparent border-transparent focus:border-primary/30 focus:bg-background border rounded-lg text-[11px] focus:outline-none transition-all min-w-[100px]"
                            />
                            {(row as any)[field].includes(',') && (
                              <span className="absolute -top-2.5 right-0 text-[9px] font-black uppercase bg-primary text-white px-1.5 py-0.5 rounded-full leading-none">
                                ×{(row as any)[field].split(',').filter((s: string) => s.trim()).length} variants
                              </span>
                            )}
                          </div>
                        ) : (
                          <input
                            type={['price', 'costPrice', 'stock'].includes(field) ? 'number' : 'text'}
                            value={(row as any)[field]}
                            placeholder={field === 'name' ? 'Product Name' : field === 'price' ? '0.00' : field === 'stock' ? '∞' : ''}
                            onChange={(e) => handleRowChange(idx, field as any, e.target.value)}
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
          <div className="bg-card border border-border text-foreground px-6 py-3 rounded-2xl shadow-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3">
            <Sparkles className="h-4 w-4 text-primary" />
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

