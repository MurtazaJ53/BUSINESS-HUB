import React, { useState, useEffect } from 'react';
import {
  Plus, Minus, Trash2, ShoppingCart, Search, Check,
  Printer, RotateCcw, Package, User, Percent, AlertCircle, AlertTriangle, Calendar,
  ArrowRight
} from 'lucide-react';
import { useBusinessStore } from '@/lib/useBusinessStore';
import { formatCurrency, cn } from '@/lib/utils';
import ReceiptModal from '@/components/ReceiptModal';
import type { Sale, SaleItem } from '@/lib/types';

type PayMode = 'CASH' | 'UPI' | 'CARD' | 'CREDIT' | 'ONLINE' | 'OTHERS';

const PAY_MODES: PayMode[] = ['CASH', 'UPI', 'CARD', 'CREDIT', 'ONLINE', 'OTHERS'];

export default function POS() {
  const { inventory, customers, addSale, updateInventoryItem } = useBusinessStore();

  const [cart, setCart] = useState<SaleItem[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [customerName, setCustomerName] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed');
  const [paymentMode, setPaymentMode] = useState<PayMode>('CASH');
  const [customItem, setCustomItem] = useState({ name: '', price: '' });
  const [success, setSuccess] = useState(false);
  const [isCharging, setIsCharging] = useState(false);
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [lastReceipt, setLastReceipt] = useState<Sale | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [stockWarningItems, setStockWarningItems] = useState<{item: SaleItem, stock: number}[]>([]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        document.getElementById('pos-search')?.focus();
      }
      if (e.ctrlKey && e.key === 'Enter' && cart.length > 0 && !isCharging) {
        e.preventDefault();
        setIsCharging(true);
      }
      if (e.key === 'Escape') {
        setIsCharging(false);
        setReceiptOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, isCharging]);

  const categories = ['All', ...Array.from(new Set(inventory.map((p) => p.category)))];

  const filtered = inventory.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku?.toLowerCase() ?? '').includes(search.toLowerCase());
    const matchCat = category === 'All' || p.category === category;
    return matchSearch && matchCat;
  });

  const addToCart = (product: typeof inventory[0]) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === product.id);
      if (existing) {
        return prev.map((c) =>
          c.itemId === product.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, {
        itemId: product.id,
        name: product.name,
        quantity: 1,
        price: product.price,
        costPrice: product.costPrice,
      }];
    });
  };

  const addCustom = () => {
    if (!customItem.name || !customItem.price) return;
    const id = `custom-${Date.now()}`;
    setCart((prev) => [...prev, {
      itemId: id,
      name: customItem.name,
      quantity: 1,
      price: parseFloat(customItem.price) || 0,
    }]);
    setCustomItem({ name: '', price: '' });
  };

  const updateQty = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => c.itemId === itemId ? { ...c, quantity: c.quantity + delta } : c)
        .filter((c) => c.quantity > 0)
    );
  };

  const subtotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const discountAmount = discountType === 'fixed' ? discount : (subtotal * discount) / 100;
  const total = Math.max(0, subtotal - discountAmount);

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    const warnings: {item: SaleItem, stock: number}[] = [];
    for (const cartItem of cart) {
      if (cartItem.itemId.startsWith('custom-')) continue;
      const invItem = inventory.find((i) => i.id === cartItem.itemId);
      if (invItem && (invItem.stock ?? 0) < cartItem.quantity) {
        warnings.push({ item: cartItem, stock: invItem.stock ?? 0 });
      }
    }

    if (warnings.length > 0) {
      setStockWarningItems(warnings);
      return;
    }
    
    setIsCharging(true);
  };

  const proceedToReview = () => {
    const draftSale: Sale = {
      id: `sale-${Date.now().toString().slice(-8)}`,
      items: cart,
      total,
      discount: discountAmount,
      paymentMode,
      customerName: customerName || undefined,
      customerId: selectedCustomerId || undefined,
      date: saleDate,
      createdAt: new Date().toISOString(),
    };

    setLastReceipt(draftSale);
    setReceiptOpen(true);
    setStockWarningItems([]);
    setIsCharging(false);
  };

  const confirmSale = async () => {
    if (!lastReceipt) return;
    try {
      await addSale(lastReceipt);

      for (const cartItem of lastReceipt.items) {
        if (cartItem.itemId.startsWith('custom-')) continue;
        const invItem = inventory.find((i) => i.id === cartItem.itemId);
        if (invItem && invItem.stock !== undefined) {
          await updateInventoryItem({
            ...invItem,
            stock: invItem.stock - cartItem.quantity,
          });
        }
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setCart([]);
        setCustomerName('');
        setSelectedCustomerId(null);
        setDiscount(0);
        setSaleDate(new Date().toISOString().split('T')[0]);
        setPaymentMode('CASH');
        setLastReceipt(null);
        setReceiptOpen(false);
      }, 2500);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-8rem)]">
      <div className="flex-1 space-y-4 min-w-0">
        <div>
          <h1 className="text-4xl font-black tracking-tighter">POS System</h1>
          <p className="text-muted-foreground mt-1">High-speed point of sale checkout</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            id="pos-search"
            type="text"
            placeholder="Search products, SKU (Ctrl+F)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-none snap-x h-16 items-center">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                "px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all snap-start border shadow-sm",
                category === cat
                  ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-105'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Custom item name..."
            value={customItem.name}
            onChange={(e) => setCustomItem({ ...customItem, name: e.target.value })}
            className="flex-1 px-3 py-2 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <input
            type="number"
            placeholder="₹ Price"
            value={customItem.price}
            onChange={(e) => setCustomItem({ ...customItem, price: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && addCustom()}
            className="w-28 px-3 py-2 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button onClick={addCustom} className="px-4 py-2 bg-accent border border-border rounded-xl font-bold text-sm hover:bg-accent/80 transition-all">
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground opacity-40">
            <Package className="h-16 w-16 mx-auto mb-3" />
            <p className="font-bold">No products found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((product) => {
              const outOfStock = product.stock !== undefined && product.stock <= 0;
              return (
                <button
                  key={product.id}
                  onClick={() => !outOfStock && addToCart(product)}
                  disabled={outOfStock}
                  className={`glass-card p-4 rounded-2xl text-left transition-all duration-200 group ${
                    outOfStock ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-xl hover:-translate-y-0.5'
                  }`}
                >
                  <div className="h-9 w-9 premium-gradient rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Package className="h-4 w-4 text-white" />
                  </div>
                  <p className="text-sm font-bold leading-tight line-clamp-2">{product.name}</p>
                  <p className="text-primary font-black mt-1">{formatCurrency(product.price)}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="lg:w-80 xl:w-96 shrink-0">
        <div className="glass-card rounded-3xl p-6 lg:sticky lg:top-24 space-y-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Current Order</h2>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="ml-auto text-muted-foreground hover:text-destructive transition-colors">
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Customer Name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-accent border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all font-bold"
            />
          </div>

          {cart.length > 0 && (
            <>
              <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.itemId} className="flex items-center gap-2 p-1.5 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground">{formatCurrency(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.itemId, -1)} className="h-6 w-6 rounded-lg bg-accent flex items-center justify-center"><Minus className="h-3 w-3" /></button>
                      <span className="w-6 text-center font-black text-xs">{item.quantity}</span>
                      <button onClick={() => updateQty(item.itemId, 1)} className="h-6 w-6 rounded-lg bg-accent flex items-center justify-center"><Plus className="h-3 w-3" /></button>
                    </div>
                    <span className="text-xs font-black w-14 text-right">{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Discount"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  className="flex-1 px-3 py-2 bg-accent border border-border rounded-xl text-xs"
                />
                <button 
                  onClick={() => setDiscountType(prev => prev === 'fixed' ? 'percent' : 'fixed')}
                  className="px-3 py-2 bg-accent rounded-xl text-xs font-bold"
                >
                  {discountType === 'fixed' ? '₹' : '%'}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {PAY_MODES.map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setPaymentMode(mode)}
                    className={`py-1.5 rounded-xl text-xs font-bold transition-all ${paymentMode === mode ? 'premium-gradient text-white' : 'bg-accent'}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <button
                onClick={handleCheckout}
                className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm premium-gradient text-white hover:shadow-xl transition-all"
              >
                Charge {formatCurrency(total)}
              </button>
            </>
          )}
        </div>
      </div>

      {isCharging && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCharging(false)} />
          <div className="relative z-10 w-full max-w-md glass-card rounded-[2.5rem] p-8 shadow-2xl">
            <h2 className="text-3xl font-black mb-1">Finalize Sale</h2>
            <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10 my-6">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-muted-foreground uppercase">Total</span>
                <span className="text-4xl font-black text-primary">{formatCurrency(total)}</span>
              </div>
            </div>
            <button
              onClick={proceedToReview}
              className="w-full premium-gradient text-white py-5 rounded-2xl font-black text-base hover:shadow-xl transition-all uppercase tracking-widest flex items-center justify-center gap-3"
            >
              Complete Transaction <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {receiptOpen && lastReceipt && (
        <ReceiptModal
          sale={{ ...lastReceipt, id: lastReceipt.id.slice(-6) }}
          onConfirm={confirmSale}
          onClose={() => setReceiptOpen(false)}
        />
      )}

      {stockWarningItems.length > 0 && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setStockWarningItems([])} />
          <div className="relative z-10 w-full max-w-md glass-card rounded-3xl p-8 border-red-500/20">
            <div className="flex items-center gap-4 text-red-500 mb-6 font-black text-xl">
              <AlertCircle className="h-8 w-8" /> Not Enough Stock
            </div>
            <div className="space-y-3 mb-8">
              {stockWarningItems.map(({ item, stock }, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-red-500/5 border border-red-500/10 rounded-2xl">
                  <p className="text-xs font-black">{item.name}</p>
                  <p className="text-sm font-black text-red-500">{item.quantity} requested ({stock} left)</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setStockWarningItems([])} className="py-3 rounded-2xl font-bold text-sm border border-border">Go back</button>
              <button onClick={proceedToReview} className="py-3 rounded-2xl font-black text-sm premium-gradient text-white">Force Sale</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

