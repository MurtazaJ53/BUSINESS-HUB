import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Minus, Trash2, ShoppingCart, Search, Check,
  Printer, RotateCcw, Package, User, Phone, Percent, AlertCircle, AlertTriangle, Calendar,
  ArrowRight, CheckCircle2, Sparkles, PlusCircle, X
} from 'lucide-react';
import { useBusinessStore } from '@/lib/useBusinessStore';
import { formatCurrency, cn, isValidIndianPhone, sanitizePhone } from '@/lib/utils';
import ReceiptModal from '@/components/ReceiptModal';
import ErrorModal from '@/components/ErrorModal';
import type { Sale, SaleItem } from '@/lib/types';

type PayMode = 'CASH' | 'UPI' | 'CARD' | 'CREDIT' | 'ONLINE' | 'OTHERS';

const PAY_MODES: PayMode[] = ['CASH', 'UPI', 'CARD', 'CREDIT', 'ONLINE', 'OTHERS'];

export default function POS() {
  const { inventory, customers, addSale, updateInventoryItem, shop, role } = useBusinessStore();

  const [cart, setCart] = useState<SaleItem[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [discountValue, setDiscountValue] = useState('0');
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed');
  const [payments, setPayments] = useState<{ mode: string; amount: number }[]>([{ mode: 'CASH', amount: 0 }]);
  const [success, setSuccess] = useState(false);
  const [isCharging, setIsCharging] = useState(false);
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [customItem, setCustomItem] = useState({ name: '', price: '' });
  const [lastReceipt, setLastReceipt] = useState<Sale | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [stockWarningItems, setStockWarningItems] = useState<{item: SaleItem, stock: number}[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [footerNote, setFooterNote] = useState(shop.footer || '');
  const [errorModal, setErrorModal] = useState({ show: false, title: '', message: '' });
  const [terminalStep, setTerminalStep] = useState<'catalog' | 'checkout'>('catalog');
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

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
        setIsSearchingCustomer(false);
      }
    };
    
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.customer-search-container')) {
        setIsSearchingCustomer(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [cart, isCharging]);
  
  // Pre-fill Footer Note when shop settings load from cloud
  useEffect(() => {
    if (shop.footer && !footerNote) {
      setFooterNote(shop.footer);
    }
  }, [shop.footer]);

  const categories = ['All', ...Array.from(new Set(inventory.map((p) => p.category)))];

  const filtered = inventory.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku?.toLowerCase() ?? '').includes(search.toLowerCase());
    const matchCat = category === 'All' || p.category === category;
    return matchSearch && matchCat;
  });

  const latestProducts = useMemo(() => {
    return [...inventory]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10); // Show top 10 newest arrivals
  }, [inventory]);
  
  // CUSTOMER AUTOCOMPLETE ENGINE
  const filteredCustomers = useMemo(() => {
    if (!customerName || selectedCustomerId) return [];
    return customers.filter(c => 
      c.name.toLowerCase().includes(customerName.toLowerCase()) ||
      c.phone.includes(customerName)
    ).slice(0, 5);
  }, [customers, customerName, selectedCustomerId]);

  const addToCart = (product: typeof inventory[0], isReturn: boolean = false) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === product.id && c.isReturn === isReturn);
      if (existing) {
        // If it exists, pull it to the TOP and increment
        const others = prev.filter((c) => !(c.itemId === product.id && c.isReturn === isReturn));
        return [{ ...existing, quantity: existing.quantity + 1 }, ...others];
      }
      // New items always go to the TOP for high-visibility
      return [{
        itemId: product.id,
        name: product.name,
        quantity: 1,
        price: product.price,
        costPrice: product.costPrice,
        isReturn
      }, ...prev];
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

  const updateQty = (itemId: string, isReturn: boolean, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.itemId === itemId && !!c.isReturn === isReturn) ? { ...c, quantity: c.quantity + delta } : c)
        .filter((c) => c.quantity > 0)
    );
  };

  const updatePrice = (itemId: string, isReturn: boolean, newPrice: number) => {
    setCart((prev) =>
      prev.map((c) => (c.itemId === itemId && !!c.isReturn === isReturn) ? { ...c, price: newPrice } : c)
    );
  };

  const removeFromCart = (itemId: string, isReturn: boolean) => {
    setCart((prev) => prev.filter((c) => !(c.itemId === itemId && !!c.isReturn === isReturn)));
  };
  
  const addServiceCharge = (amount: number = 20) => {
    const id = `custom-fee-${Date.now()}`;
    setCart((prev) => [...prev, {
      itemId: id,
      name: "Replacement / Service Fee",
      quantity: 1,
      price: amount,
    }]);
    showToast(`Added ₹${amount} Service Fee`);
  };

  const subTotal = () => cart.reduce((sum, c) => {
    const itemTotal = c.price * c.quantity;
    return c.isReturn ? sum - itemTotal : sum + itemTotal;
  }, 0);
  
  const calcTotal = () => {
    const dv = parseFloat(discountValue) || 0;
    const sub = subTotal();
    const disc = discountType === 'fixed' ? dv : (sub * (dv / 100));
    return Math.max(0, sub - disc);
  };

  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalDue = calcTotal();
  const remainingBalance = Math.max(0, totalDue - totalPayments);
  const hasMultiplePayments = payments.length > 1;
  // HARD FORCE: Allow 0.5 rupee tolerance
  // If totalDue is negative, it's a refund, so we check if the refund is recorded (negative payment) or just proceed
  const isPaid = totalDue >= 0 
    ? (totalPayments >= (totalDue - 0.5))
    : (totalPayments <= (totalDue + 0.5));
  
  // CONTACT VALIDATION: Ensure EXACTLY 10-digit Indian standard
  const phoneLengthValid = customerPhone.trim().length === 0 || customerPhone.trim().length === 10;
  const isPhoneValid = phoneLengthValid && (!customerPhone.trim() || isValidIndianPhone(customerPhone));
  
  // CREDIT SECURITY: Mandatory Name + VALID 10-digit Phone for Udhaar
  const hasCredit = payments.some(p => p.mode === 'CREDIT');
  const creditDetailsValid = customerName.trim() && customerPhone.trim().length === 10 && isValidIndianPhone(customerPhone);
  
  // FINAL LOCK: Terminal only unlocks if payment is full and contact is valid
  const canCharge = isPaid && (!hasCredit || creditDetailsValid) && isPhoneValid;

  // Auto-update first payment if only one exists
  useEffect(() => {
    if (payments.length === 1 && Math.abs(payments[0].amount - calcTotal()) > 0.1) {
      setPayments([{ mode: payments[0].mode, amount: calcTotal() }]);
    }
  }, [cart, discountValue, discountType, payments.length]);

  const handleCheckout = async (force: boolean = false) => {
    if (cart.length === 0 || isProcessing) return;
    setIsProcessing(true);

    if (!force) {
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
        setIsProcessing(false);
        return;
      }
    }

    setStockWarningItems([]);

    const total = calcTotal();
    const discountAmount = subTotal() - total;
    const finalSale: Sale = {
      id: `sale-${Date.now().toString().slice(-8)}`,
      items: [...cart],
      total,
      discount: discountAmount,
      discountType,
      discountValue,
      paymentMode: payments[0].mode as any,
      payments: [...payments],
      // SANITIZATION: Ensure NO undefined values ever reach Firestore
      customerName: customerName.trim() || "Cash Customer",
      customerPhone: customerPhone.trim() || "",
      customerId: selectedCustomerId || "",
      footerNote: footerNote.trim() || "",
      date: saleDate,
      createdAt: new Date().toISOString(),
    };

    try {
      await addSale(finalSale);
      // Final Update and Reset
      setLastReceipt(finalSale);
      setReceiptOpen(true);
      
      for (const cartItem of finalSale.items) {
        if (cartItem.itemId.startsWith('custom-')) continue;
        const invItem = inventory.find((i) => i.id === cartItem.itemId);
        if (invItem && invItem.stock !== undefined) {
          const newStock = cartItem.isReturn 
            ? invItem.stock + cartItem.quantity 
            : invItem.stock - cartItem.quantity;
            
          await updateInventoryItem({
            ...invItem,
            stock: newStock,
          });
        }
      }
    } catch (e: any) {
      console.error("Turbo Checkout Failed:", e);
      setErrorModal({
        show: true,
        title: 'Checkout Failed',
        message: e.message || 'There was a connection error while saving your sale.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForNextSale = () => {
    setCart([]);
    setDiscountValue('');
    setPayments([{ mode: 'CASH', amount: 0 }]);
    setCustomerName('');
    setCustomerPhone('');
    setSelectedCustomerId(null);
    setReceiptOpen(false);
    setLastReceipt(null);
    setFooterNote(shop.footer || '');
    setTerminalStep('catalog');
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-8rem)] pb-24 lg:pb-0">
      {/* STEP 1: CATALOG VIEW (Always visible on Desktop, Conditional on Mobile) */}
      <div className={cn(
        "flex-1 space-y-4 min-w-0",
        terminalStep === 'checkout' ? "hidden lg:block" : "block"
      )}>
        <div>
          <h1 className="text-4xl font-black tracking-tighter">Sales Hub</h1>
          <p className="text-muted-foreground mt-1 text-xs">High-speed elite terminal checkout</p>
        </div>

        {/* Category Tabs - NOW AT TOP */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x h-16 items-center">
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


        {/* EXECUTIVE CART COMMAND: NOW AT THE TOP FOR PERMANENT OVERSIGHT */}
        {cart.length > 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-700">
            <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-primary flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShoppingCart className="h-4 w-4" />
                Latest Added
              </div>
              <span className="text-[10px] opacity-50">{cart.length} ITEMS TOTAL</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {cart.slice(0, 6).map(item => (
                <div
                  key={`${item.itemId}-${!!item.isReturn}`}
                  className={`flex items-center gap-3 p-3 border rounded-3xl animate-in zoom-in-95 duration-300 shadow-sm ${
                    item.isReturn ? 'bg-red-500/5 border-red-500/20' : 'bg-primary/5 border-primary/20'
                  }`}
                >
                  <div className={`h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center shadow-md ${item.isReturn ? 'bg-red-500' : 'premium-gradient'}`}>
                    {item.isReturn ? <RotateCcw className="h-5 w-5 text-white" /> : <Package className="h-5 w-5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-[11px] font-black uppercase tracking-tight truncate">{item.name}</p>
                      {item.isReturn && <span className="text-[7px] font-black uppercase bg-red-500 text-white px-1 rounded">Return</span>}
                    </div>
                    <div className="flex flex-col gap-1">
                      {role === 'admin' && item.costPrice !== undefined && !item.isReturn && (
                        <span className="text-[8px] font-black text-emerald-500/80 uppercase">
                          +₹{((item.price - item.costPrice) * item.quantity).toFixed(0)} Profit
                        </span>
                      )}
                      <div className="flex items-center gap-1">
                        <span className={`text-[10px] font-black ${item.isReturn ? 'text-red-500' : 'text-primary'}`}>{item.isReturn ? '-' : ''}₹</span>
                        <input 
                          type="number"
                          value={item.price}
                          onChange={(e) => updatePrice(item.itemId, !!item.isReturn, parseFloat(e.target.value) || 0)}
                          className={`bg-transparent border-none p-0 text-[10px] font-black w-14 focus:ring-0 ${item.isReturn ? 'text-red-500' : 'text-primary'}`}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center bg-card rounded-2xl border border-border/50 p-1 gap-1">
                    <button 
                      onClick={() => updateQty(item.itemId, !!item.isReturn, -1)}
                      className="p-1 hover:bg-accent rounded-lg transition-colors text-muted-foreground"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-[10px] font-black min-w-[1rem] text-center">{item.quantity}</span>
                    <button 
                      onClick={() => updateQty(item.itemId, !!item.isReturn, 1)}
                      className={`p-1 hover:bg-accent rounded-lg transition-colors ${item.isReturn ? 'text-red-500' : 'text-primary'}`}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <div className="w-px h-3 bg-border/50 mx-0.5" />
                    <button 
                      onClick={() => removeFromCart(item.itemId, !!item.isReturn)}
                      className="p-1 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {cart.length > 6 && (
              <p className="text-[9px] text-center text-muted-foreground font-bold uppercase tracking-widest opacity-50">+ {cart.length - 6} more in checkout sidebar</p>
            )}
            <div className="h-px bg-border/50 my-2" />
          </div>
        )}

        {/* Search Bar - NOW BELOW ORDERS FOR ZERO-DISTURBANCE PRODUCT FILTERING */}
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <input
            id="pos-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search catalog named/barcode..."
            className="w-full bg-accent/30 border-border/50 text-foreground placeholder:text-muted-foreground/60 rounded-2xl py-4 pl-12 pr-12 focus:ring-2 focus:ring-primary/50 transition-all font-bold text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded-lg transition-all animate-in fade-in zoom-in"
            >
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        {/* Custom Actions Hub */}
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
          <button 
            onClick={addCustom} 
            className="px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:scale-105 active:scale-95 transition-all shadow-md"
            title="Add Custom Item"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button 
            onClick={() => addServiceCharge(20)}
            className="px-4 py-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl font-black text-xs hover:bg-emerald-500 hover:text-white transition-all shadow-sm flex flex-col items-center justify-center min-w-[64px]"
            title="Quick Replacement Fee (₹20)"
          >
            <span className="text-[8px] opacity-70 uppercase leading-none mb-0.5">FEE</span>
            <span>+₹20</span>
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
                <div
                  key={product.id}
                  onClick={() => !outOfStock && addToCart(product)}
                  className={`glass-card p-4 rounded-3xl text-left transition-all duration-300 group relative cursor-pointer active:scale-95 ${
                    outOfStock ? 'opacity-70 grayscale-[0.5] cursor-not-allowed' : 'hover:shadow-2xl hover:-translate-y-1 hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="h-10 w-10 premium-gradient rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500">
                      <Package className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex gap-1.5 grayscale group-hover:grayscale-0 transition-all">
                      <button
                        onClick={(e) => { e.stopPropagation(); addToCart(product, true); }}
                        className="h-8 w-8 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm"
                        title="Add as Return"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                      {!outOfStock && (
                        <div
                          className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all shadow-sm"
                          title="Add to Sale"
                        >
                          <Plus className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 mt-1">
                    <h3 className="font-extrabold text-[12px] uppercase tracking-tight truncate leading-tight">{product.name}</h3>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="px-2 py-0.5 bg-accent/50 text-zinc-400 text-[9px] font-black uppercase rounded-lg border border-border/50">
                        {product.categoryShort || product.category.slice(0, 4)}
                      </span>
                      {product.size && (
                        <span className="px-3 py-1 bg-purple-500/10 text-purple-500 text-[12px] font-black uppercase rounded-lg border border-purple-500/20 shadow-sm leading-none">
                          {product.size}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-lg border ${
                        outOfStock ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      }`}>
                        Stk: {product.stock || 0}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-end mt-4 pt-2 border-t border-border/10">
                    <p className="font-black text-xl tracking-tighter text-foreground leading-none">
                      {formatCurrency(product.price)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* STEP 2: CHECKOUT VIEW (Always visible on Desktop, Conditional on Mobile) */}
      <div className={cn(
        "lg:w-80 xl:w-96 shrink-0",
        terminalStep === 'catalog' ? "hidden lg:block" : "block"
      )}>
        {/* BACK BUTTON (Mobile Only) */}
        <button 
          onClick={() => setTerminalStep('catalog')}
          className="lg:hidden flex items-center gap-2 text-primary font-black uppercase tracking-widest mb-4 bg-primary/10 px-4 py-2 rounded-xl"
        >
          <ArrowRight className="h-4 w-4 rotate-180" /> Add More Items
        </button>

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

          <div className="space-y-2 relative customer-search-container">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Customer Name"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  if (selectedCustomerId) setSelectedCustomerId(null);
                }}
                onFocus={() => setIsSearchingCustomer(true)}
                className={cn(
                  "w-full pl-9 pr-3 py-2 bg-accent border border-border rounded-xl text-xs focus:outline-none focus:ring-2 transition-all font-bold",
                  hasCredit && !customerName ? "border-red-500/50 ring-red-500/20" : "focus:ring-primary/30"
                )}
              />
              
              {/* Autocomplete Dropdown */}
              {isSearchingCustomer && filteredCustomers.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-[100] mt-1 bg-background border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                  {filteredCustomers.map(c => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setCustomerName(c.name);
                        setCustomerPhone(c.phone);
                        setSelectedCustomerId(c.id);
                        setIsSearchingCustomer(false);
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-primary/5 border-b border-border/50 last:border-0 transition-colors group"
                    >
                      <p className="text-xs font-bold group-hover:text-primary">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground">{c.phone}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder={hasCredit ? "Valid 10-digit mobile" : "Phone (Optional)"}
                value={customerPhone}
                maxLength={10}
                onChange={(e) => setCustomerPhone(sanitizePhone(e.target.value))}
                className={cn(
                  "w-full pl-9 pr-3 py-2 bg-accent border border-border rounded-xl text-xs focus:outline-none focus:ring-2 transition-all font-bold",
                  (hasCredit && !customerPhone) || (!isPhoneValid && customerPhone) ? "border-red-500/50 ring-red-500/20 text-red-500" : "focus:ring-primary/30"
                )}
              />
              
              {/* Validation Warning */}
              {!isPhoneValid && customerPhone && (
                <p className="text-[9px] text-red-500 mt-1 font-bold flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="h-3 w-3" /> Enter valid 10-digit number
                </p>
              )}

              {hasCredit && !customerPhone && (
                <p className="text-[10px] text-red-500 mt-2 font-black uppercase tracking-tighter flex items-center gap-1 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                  <AlertCircle className="h-3 w-3" /> Name & VALID Phone required for Credit
                </p>
              )}
            </div>
          </div>

          {cart.length > 0 && (
            <>
              <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                {cart.map((c) => (
                  <div key={`${c.itemId}-${!!c.isReturn}`} className="flex items-center gap-2 p-1.5 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-extrabold text-sm truncate">{c.name}</p>
                        {c.isReturn && (
                          <span className="bg-red-500 text-white text-[8px] font-black px-1 rounded uppercase">Return</span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">{formatCurrency(c.price)} / unit</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5">
                        {role === 'admin' && c.costPrice !== undefined && !c.isReturn && (
                          <span className="text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-lg border border-emerald-500/20 animate-in fade-in zoom-in duration-500">
                            +₹{((c.price - c.costPrice) * c.quantity).toFixed(0)} PROFIT
                          </span>
                        )}
                        <div className="flex items-center gap-1">
                          <span className={`text-sm font-black ${c.isReturn ? 'text-red-500' : 'text-foreground'}`}>{c.isReturn ? '-' : ''}₹</span>
                          <input 
                            type="number"
                            value={c.price}
                            onChange={(e) => updatePrice(c.itemId, !!c.isReturn, parseFloat(e.target.value) || 0)}
                            className={`bg-transparent border-none p-0 text-sm font-black w-14 focus:ring-0 text-right ${c.isReturn ? 'text-red-500' : 'text-foreground'}`}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-1 bg-accent/50 rounded-xl p-1">
                        <button onClick={() => updateQty(c.itemId, !!c.isReturn, -1)} className="h-6 w-6 rounded-lg bg-accent flex items-center justify-center"><Minus className="h-3 w-3" /></button>
                        <span className="w-6 text-center font-black text-xs">{c.quantity}</span>
                        <button onClick={() => updateQty(c.itemId, !!c.isReturn, 1)} className="h-6 w-6 rounded-lg bg-accent flex items-center justify-center"><Plus className="h-3 w-3" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Discount"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="flex-1 px-3 py-2 bg-accent border border-border rounded-xl text-xs"
                />
                <button 
                  onClick={() => setDiscountType(prev => prev === 'fixed' ? 'percent' : 'fixed')}
                  className="px-3 py-2 bg-accent rounded-xl text-xs font-bold"
                >
                  {discountType === 'fixed' ? '₹' : '%'}
                </button>
              </div>

              {/* Payment Ledger Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Payment Breakdown</p>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${remainingBalance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {remainingBalance > 0 ? `Unpaid: ${formatCurrency(remainingBalance)}` : 'Full Payment Covered'}
                  </p>
                </div>
                
                <div className="space-y-4">
                  {payments.map((p, idx) => (
                    <div key={idx} className="glass-card rounded-2xl p-4 border-border/40 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Payment {idx + 1}</p>
                        {payments.length > 1 && (
                          <button 
                            onClick={() => setPayments(payments.filter((_, i) => i !== idx))}
                            className="text-red-500/60 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Mode Grid */}
                      <div className="grid grid-cols-3 gap-1.5 mb-3">
                        {PAY_MODES.map((mode) => (
                          <button
                            key={mode}
                            onClick={() => {
                              const np = [...payments];
                              np[idx].mode = mode;
                              setPayments(np);
                            }}
                            className={`py-2 rounded-xl text-[10px] font-black tracking-tight transition-all uppercase ${
                              p.mode === mode 
                                ? 'premium-gradient text-white shadow-md' 
                                : 'bg-accent/40 text-muted-foreground hover:bg-accent'
                            }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>

                      {/* Amount Input */}
                      <div className="relative">
                        <input
                          type="number"
                          value={p.amount || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const np = [...payments];
                            np[idx].amount = val;
                            setPayments(np);
                          }}
                          className="w-full bg-accent/60 border border-border/50 rounded-xl pl-3 pr-8 py-3 text-sm font-black outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                          placeholder="Enter Amount"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-xs opacity-30 text-primary">₹</span>
                      </div>
                    </div>
                  ))}
                </div>

                {(!hasMultiplePayments || remainingBalance > 0) && (
                  <button
                    onClick={() => {
                      const amountToAdd = remainingBalance > 0 ? remainingBalance : 0;
                      setPayments([...payments, { mode: 'UPI', amount: amountToAdd }]);
                    }}
                    className="w-full py-2.5 border border-dashed border-primary/30 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Split Payment
                  </button>
                )}
                
                {/* Special Footer Note Field */}
                <div className="pt-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1.5 grayscale opacity-70">
                    <Sparkles className="h-3 w-3" /> Special Footer Note
                  </p>
                  <textarea 
                    value={footerNote}
                    onChange={(e) => setFooterNote(e.target.value)}
                    placeholder="Type a special note for this receipt..."
                    className="w-full bg-accent/40 border border-border/50 rounded-xl p-3 text-[11px] font-semibold min-h-[60px] focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                  />
                </div>
              </div>

              <button
                onClick={() => handleCheckout(false)}
                disabled={!canCharge || isProcessing}
                className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-3 ${
                  canCharge && !isProcessing
                    ? 'premium-gradient text-white shadow-xl hover:-translate-y-0.5 active:scale-95' 
                    : 'bg-accent text-muted-foreground cursor-not-allowed opacity-50'
                }`}
              >
                {isProcessing && <RotateCcw className="h-4 w-4 animate-spin" />}
                {isProcessing ? 'Saving Transaction...' : `Charge ${formatCurrency(calcTotal())}`}
              </button>
            </>
          )}
        </div>
      </div>

      {/* FLOATING ACTION BAR (Mobile Only - Catalog View) */}
      {terminalStep === 'catalog' && cart.length > 0 && (
        <div className="lg:hidden fixed bottom-6 left-6 right-6 z-[200] animate-in slide-in-from-bottom-5">
          <button 
            onClick={() => setTerminalStep('checkout')}
            className="w-full premium-gradient text-white py-4 rounded-3xl font-black uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all border border-white/20"
          >
            <div className="bg-white/20 px-2 py-0.5 rounded-lg text-xs">
              {cart.length}
            </div>
            Review Order
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      )}


      {/* TOAST SYSTEM - HIGH-SPEED FEEDBACK */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1000] animate-in slide-in-from-bottom-5">
          <div className="bg-zinc-900/90 backdrop-blur-md border border-white/10 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-black uppercase tracking-widest text-white">{toast}</span>
          </div>
        </div>
      )}

      <ErrorModal 
        isOpen={errorModal.show}
        title={errorModal.title}
        message={errorModal.message}
        onClose={() => setErrorModal({ ...errorModal, show: false })}
      />

      {receiptOpen && lastReceipt && (
        <ReceiptModal
          sale={lastReceipt}
          onConfirm={resetForNextSale}
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
              <button onClick={() => handleCheckout(true)} className="py-3 rounded-2xl font-black text-sm premium-gradient text-white">Force Sale</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

