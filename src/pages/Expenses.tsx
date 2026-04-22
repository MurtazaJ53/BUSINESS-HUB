import React, { useState } from 'react';
import { 
  TrendingUp, 
  Plus, 
  Trash2, 
  Coffee, 
  Home, 
  Zap, 
  Users as Staff, 
  ShoppingBag, 
  MoreHorizontal,
  Calendar,
  Wallet,
  PieChart
} from 'lucide-react';
import { useSqlQuery } from '@/db/hooks';
import { useBusinessStore } from '@/lib/useBusinessStore';
import { formatCurrency, cn } from '@/lib/utils';
import type { Expense } from '@/lib/types';
import ConfirmDialog from '@/components/ConfirmDialog';
import ErrorModal from '@/components/ErrorModal';

const CATEGORIES = [
  { name: 'Rent & Place', icon: Home, color: 'text-blue-500' },
  { name: 'Staff Salary', icon: Staff, color: 'text-purple-500' },
  { name: 'Electricity/Bills', icon: Zap, color: 'text-amber-500' },
  { name: 'Inventory Purchase', icon: ShoppingBag, color: 'text-primary' },
  { name: 'Tea & Snacks', icon: Coffee, color: 'text-emerald-500' },
  { name: 'Maintenance', icon: Plus, color: 'text-red-500' },
  { name: 'Others', icon: MoreHorizontal, color: 'text-muted-foreground' },
];

export default function Expenses() {
  const { addExpense, deleteExpense } = useBusinessStore();
  const expenses = useSqlQuery<Expense>('SELECT * FROM expenses WHERE tombstone = 0 ORDER BY date DESC', [], ['expenses']);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState({ show: false, title: '', message: '' });
  
  const [formData, setFormData] = useState({
    amount: '',
    category: 'Others',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount) || 0;
    const description = formData.description.trim();

    try {
      if (!amount || !description) {
        setErrorModal({
          show: true,
          title: 'Missing Info',
          message: 'Please enter both an amount and a description for your expense.'
        });
        return;
      }

      await addExpense({
        id: `exp-${Date.now()}`,
        category: formData.category,
        amount: amount,
        description: description,
        date: formData.date,
        createdAt: new Date().toISOString()
      });
      
      setIsAdding(false);
      setFormData({ amount: '', category: 'Others', description: '', date: new Date().toISOString().split('T')[0] });
    } catch (err: any) {
      setErrorModal({
        show: true,
        title: 'Save Failed',
        message: err.message || 'There was a connection error while saving your expense.'
      });
    }
  };

  const currentMonth = new Date().toISOString().split('-').slice(0, 2).join('-');
  const monthTotal = expenses
    .filter((e: Expense) => e.date.startsWith(currentMonth))
    .reduce((sum: number, e: Expense) => sum + e.amount, 0);

  const categoryTotals = CATEGORIES.map(cat => ({
    ...cat,
    total: expenses.filter((e: Expense) => e.category === cat.name).reduce((sum: number, e: Expense) => sum + e.amount, 0)
  })).sort((a: any, b: any) => b.total - a.total);

  return (
    <div className="space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/50">
        <div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter leading-none mb-2">Expense Ledger</h1>
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest opacity-70">Overhead & Shop Cost Management</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="premium-gradient text-white px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 transition-all uppercase tracking-widest"
        >
          <Plus className="h-4 w-4" /> Add New Expense
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-3xl relative overflow-hidden group">
          <Wallet className="absolute -right-2 -bottom-2 h-24 w-24 text-primary/5 -rotate-12 group-hover:rotate-0 transition-transform duration-500" />
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">M-T-D Spending</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black italic">{formatCurrency(monthTotal)}</span>
            <TrendingUp className="h-4 w-4 text-primary mb-2" />
          </div>
        </div>

        <div className="md:col-span-2 glass-card p-6 rounded-3xl flex items-center gap-8 overflow-x-auto scrollbar-none">
          {categoryTotals.map((cat, i) => (
            <div key={i} className="flex items-center gap-3 shrink-0">
              <div className={cn("h-10 w-10 rounded-xl bg-accent flex items-center justify-center", cat.color)}>
                <cat.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">{cat.name}</p>
                <p className="text-sm font-black">{formatCurrency(cat.total)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Expense List */}
      <div className="glass-card rounded-3xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full text-left border-collapse min-w-[650px]">
            <thead>
              <tr className="bg-accent/30">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Date</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Amount</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center justify-center opacity-30">
                      <PieChart className="h-12 w-12 mb-3" />
                      <p className="text-[10px] font-black uppercase tracking-[0.2em]">No Expenses Recorded</p>
                    </div>
                  </td>
                </tr>
            ) : (
              expenses
                .sort((a: Expense, b: Expense) => b.date.localeCompare(a.date))
                .map((exp: Expense) => {
                  const CategoryIcon = CATEGORIES.find(c => c.name === exp.category)?.icon || MoreHorizontal;
                  return (
                    <tr key={exp.id} className="group hover:bg-red-500/[0.02] transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center text-muted-foreground">
                            <CategoryIcon className="h-4 w-4" />
                          </div>
                          <span className="text-xs font-bold">{exp.category}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-xs font-medium italic opacity-70">
                        {exp.description || '—'}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 text-xs font-bold">
                          <Calendar className="h-3 w-3 opacity-40" />
                          {exp.date}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right font-black text-red-500 text-sm">
                        -{formatCurrency(exp.amount)}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex justify-center">
                          <button 
                            onClick={() => setDeletingId(exp.id)}
                            className="p-2 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-xl transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
            )}
          </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsAdding(false)} />
          <div className="relative z-10 w-full max-w-md glass-card rounded-3xl p-8 border-primary/20 animate-in zoom-in duration-200">
            <h2 className="text-2xl font-black mb-6 tracking-tight">Record Expense</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Category</label>
                <select 
                  className="w-full bg-accent border border-border rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none font-bold"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Amount Paid</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-primary">₹</span>
                  <input 
                    autoFocus
                    required
                    type="number" 
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-accent border border-border rounded-xl py-3 pl-8 pr-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none font-black"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Description</label>
                <input 
                  type="text" 
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. Electricity bill for March"
                  className="w-full bg-accent border border-border rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Date</label>
                <input 
                  type="date" 
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full bg-accent border border-border rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none font-black"
                />
              </div>
              <div className="pt-4 grid grid-cols-2 gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsAdding(false)}
                  className="py-3 px-4 rounded-xl font-bold text-sm border border-border hover:bg-accent transition-all uppercase tracking-widest text-muted-foreground"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="py-3 px-4 rounded-xl font-black text-sm premium-gradient text-white hover:shadow-xl hover:-translate-y-0.5 transition-all uppercase tracking-widest"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={() => {
          if (deletingId) {
            deleteExpense(deletingId);
            setDeletingId(null);
          }
        }}
        title="Delete Expense Entry?"
        description="This will permanently remove this record from your shop's overhead history. This cannot be undone."
        confirmText="Yes, Delete Record"
        variant="danger"
      />
      <ErrorModal 
        isOpen={errorModal.show}
        title={errorModal.title}
        message={errorModal.message}
        onClose={() => setErrorModal({ ...errorModal, show: false })}
      />
    </div>
  );
}

