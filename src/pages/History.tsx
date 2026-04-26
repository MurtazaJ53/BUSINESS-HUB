import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
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
  TrendingUp,
  ShieldCheck,
  Printer
} from 'lucide-react';
import { useLiveQuery } from '@/db/hooks';
import { expensesRepo } from '@/db/repositories/expensesRepo';
import { salesRepo, type SaleHistorySummary } from '@/db/repositories/salesRepo';
import { useBusinessStore } from '@/lib/useBusinessStore';
import { usePermission } from '@/hooks/usePermission';
import { formatCurrency, cn } from '@/lib/utils';
import { printReceipt } from '@/lib/printerService';
import { loadShopSettings } from '@/lib/shopSettings';
import type { Sale, Expense } from '@/lib/types';
import ReceiptModal from '@/components/ReceiptModal';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function History() {
  const { deleteSale, deleteExpense, updateSale } = useBusinessStore();
  const canEditSale = usePermission('sales', 'edit');
  const canVoidSale = usePermission('sales', 'void_sale');
  const canDeleteExpense = usePermission('expenses', 'delete');
  const [tab, setTab] = useState<'sales' | 'expenses'>('sales');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [viewingSale, setViewingSale] = useState<Sale | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [loadingSaleId, setLoadingSaleId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string>('All Time');
  const [page, setPage] = useState(1);
  const pageSize = 100;

  // Edit form state
  const [editForm, setEditForm] = useState({
    customerName: '',
    paymentMode: '' as Sale['paymentMode'],
    date: ''
  });

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

  const salesFilters = useMemo(() => {
    const filters: { search?: string; dateFrom?: string; dateTo?: string } = {};
    if (deferredSearch.trim()) filters.search = deferredSearch.trim();
    if (dateFilter === 'Today') {
      filters.dateFrom = today;
      filters.dateTo = today;
    } else if (dateFilter === 'Yesterday') {
      filters.dateFrom = yesterday;
      filters.dateTo = yesterday;
    } else if (dateFilter === 'Last 7 Days') {
      filters.dateFrom = last7Days;
      filters.dateTo = today;
    }
    return filters;
  }, [dateFilter, deferredSearch, last7Days, today, yesterday]);

  const historyMetrics = useLiveQuery(
    () => salesRepo.getHistoryMetrics(salesFilters).then((metrics) => [{ ...metrics }]),
    ['sales', 'sale_items', 'sale_payments'],
    [salesFilters.search || '', salesFilters.dateFrom || '', salesFilters.dateTo || ''],
  );

  const salesPage = useLiveQuery<SaleHistorySummary>(
    () => salesRepo.getHistoryPage(salesFilters, page, pageSize),
    ['sales', 'sale_items', 'sale_payments'],
    [page, pageSize, salesFilters.search || '', salesFilters.dateFrom || '', salesFilters.dateTo || ''],
  );

  const expenseMetrics = useLiveQuery(
    () => expensesRepo.getMetrics(salesFilters).then((metrics) => [{ ...metrics }]),
    ['expenses'],
    [salesFilters.search || '', salesFilters.dateFrom || '', salesFilters.dateTo || ''],
  );

  const expensePage = useLiveQuery<Expense>(
    () => expensesRepo.getPage(salesFilters, page, pageSize),
    ['expenses'],
    [page, pageSize, salesFilters.search || '', salesFilters.dateFrom || '', salesFilters.dateTo || ''],
  );

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, dateFilter, tab]);

  const openSale = async (saleId: string): Promise<Sale | null> => {
    setLoadingSaleId(saleId);
    try {
      return await salesRepo.getById(saleId);
    } catch (error) {
      console.error('[History] Failed to load sale details', error);
      return null;
    } finally {
      setLoadingSaleId(null);
    }
  };

  const handleEditOpen = async (saleId: string) => {
    const sale = await openSale(saleId);
    if (!sale) return;
    setEditingSale(sale);
    setEditForm({
      customerName: sale.customerName || '',
      paymentMode: sale.paymentMode,
      date: sale.date
    });
  };

  const handleViewSale = async (saleId: string) => {
    const sale = await openSale(saleId);
    if (sale) setViewingSale(sale);
  };

  const handlePrintSale = async (saleId: string) => {
    const sale = await openSale(saleId);
    if (!sale) return;
    const shop = loadShopSettings();
    printReceipt(sale, shop);
  };

  const handleDelete = () => {
    if (deletingId) {
      if (tab === 'sales') deleteSale(deletingId);
      else deleteExpense(deletingId);
      setDeletingId(null);
    }
  };

  const totalSalesAmount = historyMetrics[0]?.totalAmount ?? 0;
  const filteredSalesCount = historyMetrics[0]?.totalCount ?? 0;
  const totalExpensesAmount = expenseMetrics[0]?.totalAmount ?? 0;
  const filteredExpenseCount = expenseMetrics[0]?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil((tab === 'sales' ? filteredSalesCount : filteredExpenseCount) / pageSize));

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
          
          <div className="flex bg-accent/50 p-1.5 rounded-2xl border border-border/50 h-fit">
            <button 
              onClick={() => setTab('sales')}
              className={cn(
                "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                tab === 'sales' ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Sales
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[8px] font-bold",
                tab === 'sales' ? "bg-primary-foreground/20" : "bg-accent/50 text-muted-foreground"
              )}>
                {filteredSalesCount}
              </span>
            </button>
            <button 
              onClick={() => setTab('expenses')}
              className={cn(
                "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                tab === 'expenses' ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Expenses
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[8px] font-bold",
                tab === 'expenses' ? "bg-primary-foreground/20" : "bg-accent/50 text-muted-foreground"
              )}>
                {filteredExpenseCount}
              </span>
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
      {/* Summary Header - ADMIN ONLY */}
      {usePermission('analytics', 'view') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={cn(
            "glass-card p-6 rounded-[2rem] border-l-4 transition-all duration-500",
            tab === 'sales' ? "border-l-primary scale-100 opacity-100" : "border-l-transparent scale-95 opacity-50 grayscale"
          )}>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Current Revenue</p>
            <div className="flex items-center justify-between">
              <h3 className="text-3xl font-black italic tracking-tighter">{formatCurrency(totalSalesAmount)}</h3>
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <IndianRupee className="h-5 w-5 text-primary" />
              </div>
            </div>
            <p className="text-[10px] font-bold text-primary mt-1 uppercase tracking-widest">{filteredSalesCount} Successful Orders</p>
          </div>

          <div className={cn(
            "glass-card p-6 rounded-[2rem] border-l-4 transition-all duration-500",
            tab === 'expenses' ? "border-l-destructive scale-100 opacity-100" : "border-l-transparent scale-95 opacity-50 grayscale"
          )}>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Store Outflow</p>
            <div className="flex items-center justify-between">
              <h3 className="text-3xl font-black italic tracking-tighter text-destructive">{formatCurrency(totalExpensesAmount)}</h3>
              <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-destructive rotate-180" />
              </div>
            </div>
            <p className="text-[10px] font-bold text-destructive mt-1 uppercase tracking-widest">{filteredExpenseCount} Overhead Records</p>
          </div>
        </div>
      )}

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
                {salesPage.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center opacity-30">
                        <FilterX className="h-12 w-12 mb-3" />
                        <p className="text-sm font-bold uppercase tracking-widest">No transactions found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  salesPage.map((sale) => (
                    <tr key={sale.id} className="group hover:bg-primary/[0.02] transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform",
                            sale.id.startsWith('PAY-') ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/5 text-primary"
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
                              {Boolean(sale.sourceMeta?.provider) && (
                                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-primary">
                                  Imported
                                </span>
                              )}
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
                          {sale.itemQuantity}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "h-2 w-2 rounded-full",
                            sale.id.startsWith('PAY-') ? "bg-emerald-500 animate-pulse" : 
                            (sale.paymentCount > 1 ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" : 
                            (sale.paymentMode === 'CASH' ? "bg-emerald-500" : "bg-primary"))
                          )} />
                          <span className="text-[11px] font-black uppercase tracking-widest leading-none">
                            {sale.id.startsWith('PAY-') 
                              ? 'CASH COLLECTION' 
                              : (sale.paymentCount > 1 
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
                            onClick={() => void handlePrintSale(sale.id)}
                            className="p-2 hover:bg-primary/10 hover:text-primary rounded-xl transition-all"
                            title="Print Receipt"
                            disabled={loadingSaleId === sale.id}
                          >
                            <Printer className={cn("h-4 w-4", loadingSaleId === sale.id && "animate-pulse")} />
                          </button>
                          <button 
                            onClick={() => void handleViewSale(sale.id)}
                            className="p-2 hover:bg-primary/10 hover:text-primary rounded-xl transition-all"
                            title="View Details"
                            disabled={loadingSaleId === sale.id}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {canEditSale && (
                            <button 
                              onClick={() => void handleEditOpen(sale.id)}
                              className="p-2 hover:bg-primary/10 hover:text-primary rounded-xl transition-all"
                              title="Edit Details"
                              disabled={loadingSaleId === sale.id}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {canVoidSale && (
                            <button 
                              onClick={() => setDeletingId(sale.id)}
                              className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-xl transition-all"
                              title="Delete Sale"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
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
                {expensePage.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center opacity-30">
                        <FilterX className="h-12 w-12 mb-3" />
                        <p className="text-sm font-bold uppercase tracking-widest">No expenses found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  expensePage.map((exp: Expense) => (
                    <tr key={exp.id} className="group hover:bg-destructive/[0.02] transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-destructive/5 text-destructive flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                            <TrendingUp className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-black uppercase tracking-tighter text-destructive">EXPENSE</p>
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
                      <td className="px-6 py-5 text-right font-black text-destructive tabular-nums">
                        -{formatCurrency(exp.amount)}
                      </td>
                      <td className="px-6 py-5 text-center">
                        {canDeleteExpense && (
                          <button 
                            onClick={() => setDeletingId(exp.id)}
                            className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-xl transition-all"
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

      {totalPages > 1 && (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Showing page {page} of {totalPages} - {(tab === 'sales' ? filteredSalesCount : filteredExpenseCount).toLocaleString()} {tab === 'sales' ? 'receipts' : 'expenses'}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-xl border border-border bg-card text-xs font-black uppercase tracking-widest text-muted-foreground transition-all disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-xl border border-border bg-card text-xs font-black uppercase tracking-widest text-muted-foreground transition-all disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingSale && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setEditingSale(null)} />
          <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-2xl animate-in">
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
                  className="w-full premium-gradient text-primary-foreground py-4 rounded-2xl font-black text-sm hover:shadow-xl transition-all uppercase tracking-widest flex items-center justify-center gap-2"
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
        title={tab === 'sales' ? "Permanently Delete Sale?" : "Delete Expense Record?"}
        description={tab === 'sales' 
          ? "This action will remove the record and restore items back to your stock. This cannot be undone."
          : "This will permanently remove this expense from your overhead audit trail. This cannot be undone."
        }
        confirmText={tab === 'sales' ? "Yes, Delete Sale" : "Yes, Delete Expense"}
        variant="danger"
      />
    </div>
  );
}

