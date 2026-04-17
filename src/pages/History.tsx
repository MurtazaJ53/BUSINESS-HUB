import React, { useState } from 'react';
import { 
  Search, 
  Trash2, 
  Eye, 
  Calendar, 
  User, 
  ChevronRight,
  Receipt,
  FilterX,
  Pencil,
  X,
  Check,
  CreditCard,
  IndianRupee,
  ShieldCheck,
  Printer
} from 'lucide-react';
import { useBusinessStore } from '@/lib/useBusinessStore';
import { formatCurrency, cn } from '@/lib/utils';
import { printReceipt } from '@/lib/printerService';
import { loadShopSettings } from '@/lib/shopSettings';
import type { Sale } from '@/lib/types';
import ReceiptModal from '@/components/ReceiptModal';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function History() {
  const { sales, expenses, deleteSale, deleteExpense, updateSale, role } = useBusinessStore();
  const [tab, setTab] = useState<'sales' | 'expenses'>('sales');
  const [search, setSearch] = useState('');
  const [viewingSale, setViewingSale] = useState<Sale | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string>('All Time');

  // Edit form state
  const [editForm, setEditForm] = useState({
    customerName: '',
    paymentMode: '' as Sale['paymentMode'],
    date: ''
  });

  const handleEditOpen = (sale: Sale) => {
    setEditingSale(sale);
    setEditForm({
      customerName: sale.customerName || '',
      paymentMode: sale.paymentMode,
      date: sale.date
    });
  };

  const handleUpdate = async () => {
    if (!editingSale) return;
    await updateSale({
      ...editingSale,
      customerName: editForm.customerName || undefined,
      paymentMode: editForm.paymentMode,
      date: editForm.date
    });
    setEditingSale(null);
  };

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const last7Days = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  const filteredSales = sales
    .filter(s => {
      const matchSearch = s.id.toLowerCase().includes(search.toLowerCase()) || 
                          (s.customerName?.toLowerCase() ?? '').includes(search.toLowerCase());
      
      let matchDate = true;
      if (dateFilter === 'Today') matchDate = s.date === today;
      else if (dateFilter === 'Yesterday') matchDate = s.date === yesterday;
      else if (dateFilter === 'Last 7 Days') matchDate = s.date >= last7Days;

      return matchSearch && matchDate;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  const filteredExpenses = expenses
    .filter(e => {
      const matchSearch = e.category.toLowerCase().includes(search.toLowerCase()) || 
                          e.description.toLowerCase().includes(search.toLowerCase());
      
      let matchDate = true;
      if (dateFilter === 'Today') matchDate = e.date === today;
      else if (dateFilter === 'Yesterday') matchDate = e.date === yesterday;
      else if (dateFilter === 'Last 7 Days') matchDate = e.date >= last7Days;

      return matchSearch && matchDate;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  const handleDelete = () => {
    if (deletingId) {
      if (tab === 'sales') deleteSale(deletingId);
      else deleteExpense(deletingId);
      setDeletingId(null);
    }
  };

  const dateFilters = ['All Time', 'Today', 'Yesterday', 'Last 7 Days'];
  const paymentModes = ['CASH', 'UPI', 'CARD', 'CREDIT', 'ONLINE', 'OTHERS'];

  return (
    <div className="space-y-10 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter leading-none mb-2">History Log</h1>
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest opacity-70">Complete Ledger Activity</p>
          </div>
          
          <div className="flex bg-accent/50 p-1 rounded-2xl border border-border/50 h-fit">
            <button 
              onClick={() => setTab('sales')}
              className={cn(
                "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                tab === 'sales' ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Sales
            </button>
            <button 
              onClick={() => setTab('expenses')}
              className={cn(
                "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                tab === 'expenses' ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Expenses
            </button>
          </div>
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {dateFilters.map(f => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border",
                dateFilter === f 
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" 
                  : "bg-card border-border text-muted-foreground hover:border-primary/50"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder={tab === 'sales' ? "Search invoice # or customer name..." : "Search expense category or description..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-card border border-border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all shadow-sm"
        />
      </div>

      {/* Content Feed */}
      <div className="glass-card rounded-[2.5rem] overflow-hidden border border-border/50">
        <div className="overflow-x-auto scrollbar-none">
          {tab === 'sales' ? (
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-accent/30 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  <th className="px-6 py-5">Date & Invoice</th>
                  <th className="px-6 py-5">Customer</th>
                  <th className="px-6 py-5 text-center">Items</th>
                  <th className="px-6 py-5">Payment</th>
                  <th className="px-6 py-5 text-right">Amount</th>
                  <th className="px-6 py-5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center opacity-30">
                        <FilterX className="h-12 w-12 mb-3" />
                        <p className="text-sm font-bold uppercase tracking-widest">No transactions found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => (
                    <tr key={sale.id} className="group hover:bg-primary/[0.02] transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform",
                            sale.id.startsWith('PAY-') ? "bg-green-500/10 text-green-600" : "bg-primary/5 text-primary"
                          )}>
                            {sale.id.startsWith('PAY-') ? (
                              <IndianRupee className="h-5 w-5" />
                            ) : (
                              sale.date === today ? <Receipt className="h-5 w-5" /> : <Calendar className="h-5 w-5 opacity-60" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-black uppercase tracking-tighter">
                              {sale.id.startsWith('PAY-') ? 'PAYMENT' : `INV-${sale.id.replace('sale-', '').toUpperCase()}`}
                            </p>
                            <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 mt-0.5">
                              {sale.date}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-accent flex items-center justify-center">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <span className="text-sm font-bold truncate max-w-[120px]">
                            {sale.customerName || 'Walk-in'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="text-xs font-black bg-accent px-2.5 py-1 rounded-full">
                          {sale.items.reduce((acc, i) => acc + i.quantity, 0)}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "h-2 w-2 rounded-full",
                            sale.id.startsWith('PAY-') ? "bg-green-500 animate-pulse" : 
                            (sale.payments && sale.payments.length > 1 ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" : 
                            (sale.paymentMode === 'CASH' ? "bg-green-500" : "bg-primary"))
                          )} />
                          <span className="text-[11px] font-black uppercase tracking-widest leading-none">
                            {sale.id.startsWith('PAY-') 
                              ? 'CASH COLLECTION' 
                              : (sale.payments && sale.payments.length > 1 
                                  ? 'SPLIT' 
                                  : sale.paymentMode)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <p className="text-sm font-black text-foreground">
                          {formatCurrency(sale.total)}
                        </p>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => {
                              const shop = loadShopSettings();
                              printReceipt(sale, shop);
                            }}
                            className="p-2 hover:bg-primary/10 hover:text-primary rounded-xl transition-all"
                            title="Print Receipt"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => setViewingSale(sale)}
                            className="p-2 hover:bg-primary/10 hover:text-primary rounded-xl transition-all"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {role === 'admin' && (
                            <>
                              <button 
                                onClick={() => handleEditOpen(sale)}
                                className="p-2 hover:bg-primary/10 hover:text-primary rounded-xl transition-all"
                                title="Edit Details"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => setDeletingId(sale.id)}
                                className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-all"
                                title="Delete Sale"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-accent/30 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  <th className="px-6 py-5">Date & Type</th>
                  <th className="px-6 py-5">Category</th>
                  <th className="px-6 py-5">Description</th>
                  <th className="px-6 py-5 text-right">Amount</th>
                  <th className="px-6 py-5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center opacity-30">
                        <FilterX className="h-12 w-12 mb-3" />
                        <p className="text-sm font-bold uppercase tracking-widest">No expenses found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="group hover:bg-red-500/[0.02] transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-red-500/5 text-red-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                            <TrendingUp className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-black uppercase tracking-tighter text-red-600">EXPENSE</p>
                            <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 mt-0.5">
                              {exp.date}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-[10px] font-black bg-accent px-2.5 py-1 rounded-full uppercase tracking-widest">
                          {exp.category}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-xs font-bold truncate max-w-[200px]">{exp.description || 'No description'}</p>
                      </td>
                      <td className="px-6 py-5 text-right font-black text-red-600 tabular-nums">
                        -{formatCurrency(exp.amount)}
                      </td>
                      <td className="px-6 py-5 text-center">
                        {role === 'admin' && (
                          <button 
                            onClick={() => setDeletingId(exp.id)}
                            className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-all"
                            title="Delete Expense"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingSale && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingSale(null)} />
          <div className="relative z-10 w-full max-w-md glass-card rounded-3xl p-8 shadow-2xl animate-in">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black">Edit Order Details</h2>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">INV-{editingSale.id.replace('sale-', '').toUpperCase()}</p>
              </div>
              <button onClick={() => setEditingSale(null)} className="p-2 hover:bg-accent rounded-xl transition-all"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Customer Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={editForm.customerName}
                    onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
                    className="w-full bg-accent border border-border rounded-xl px-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    placeholder="Walk-in Customer"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Order Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                    className="w-full bg-accent border border-border rounded-xl px-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Payment Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {paymentModes.map(mode => (
                    <button
                      key={mode}
                      onClick={() => setEditForm({ ...editForm, paymentMode: mode as any })}
                      className={cn(
                        "py-3 rounded-xl text-[10px] font-black transition-all border",
                        editForm.paymentMode === mode 
                          ? "bg-primary text-primary-foreground border-primary" 
                          : "bg-background border-border text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <button
                  onClick={handleUpdate}
                  className="w-full premium-gradient text-white py-4 rounded-2xl font-black text-sm hover:shadow-xl transition-all uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <Check className="h-5 w-5" /> Save Changes
                </button>
                <p className="text-[9px] text-center text-muted-foreground font-bold italic">
                  Note: Values like items and prices cannot be edited to maintain stock integrity.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewingSale && (
        <ReceiptModal 
          sale={viewingSale}
          onClose={() => setViewingSale(null)}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Permanently Delete Sale?"
        description="This action will remove the record and restore items back to your stock. This cannot be undone."
        confirmText="Yes, Delete Sale"
        variant="danger"
      />
    </div>
  );
}
