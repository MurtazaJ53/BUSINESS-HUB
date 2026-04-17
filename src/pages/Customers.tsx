import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  UserPlus, 
  Phone, 
  Mail, 
  IndianRupee, 
  Clock, 
  TrendingUp, 
  ArrowUpRight,
  Trash2,
  CheckCircle2,
  AlertCircle,
  History,
  X
} from 'lucide-react';
import { useBusinessStore } from '@/lib/useBusinessStore';
import { formatCurrency, isValidIndianPhone, sanitizePhone } from '@/lib/utils';
import type { Customer } from '@/lib/types';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function Customers() {
  const { customers, upsertCustomer, deleteCustomer, addCustomerPayment, sales } = useBusinessStore();
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [paymentCustomerId, setPaymentCustomerId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: ''
  });

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone.includes(search)
  ).sort((a, b) => b.balance - a.balance);

  const getCustomerHistory = (customerId: string) => {
    return sales.filter(s => s.customerId === customerId)
               .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  };

  const stats = {
    total: customers.length,
    activeCredits: customers.filter(c => c.balance > 0).length,
    totalCreditAmount: customers.reduce((sum, c) => sum + c.balance, 0)
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newCustomer: Customer = {
      id: `cust-${Date.now()}`,
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      totalSpent: 0,
      balance: 0,
      createdAt: new Date().toISOString()
    };
    upsertCustomer(newCustomer);
    setIsAdding(false);
    setFormData({ name: '', phone: '', email: '' });
  };

  const handlePayment = (id: string, amount: number) => {
    if (!amount || amount <= 0) return;
    addCustomerPayment(id, amount);
  };

  return (
    <div className="space-y-10 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/50">
        <div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter leading-none mb-2">Customer Ledger</h1>
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest opacity-70">Udhaar & Loyalty Management</p>
        </div>
      </div>

      {/* High-Density Customer Analytics Grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* TOTAL NETWORK */}
        <div className="glass-card flex flex-col items-center justify-center aspect-square p-4 rounded-3xl group transition-all duration-500">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <p className="text-[8px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-80 text-center leading-tight">Total<br/>Network</p>
          <p className="text-2xl font-black mt-1 text-foreground tracking-tighter italic">{stats.total}</p>
          <p className="text-[8px] text-primary/60 mt-1 font-black uppercase">Verified</p>
        </div>

        {/* ACTIVE UDHAAR */}
        <div className="glass-card border-red-500/10 flex flex-col items-center justify-center aspect-square p-4 rounded-3xl group transition-all duration-500">
          <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center mb-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
          </div>
          <p className="text-[8px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-80 text-center leading-tight">Active<br/>Udhaar</p>
          <p className="text-2xl font-black mt-1 text-red-500 tracking-tighter italic">{stats.activeCredits}</p>
          <p className="text-[8px] text-muted-foreground/60 mt-1 font-bold uppercase">Customers</p>
        </div>

        {/* TOTAL CREDIT OUT */}
        <div className="glass-card border-primary/20 bg-primary/5 flex flex-col items-center justify-center aspect-square p-4 rounded-3xl group transition-all duration-500">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
            <IndianRupee className="h-5 w-5 text-primary" />
          </div>
          <p className="text-[8px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-80 text-center leading-tight">Total<br/>Credit Out</p>
          <p className="text-xl font-black mt-1 text-primary tracking-tighter italic whitespace-nowrap">{formatCurrency(stats.totalCreditAmount)}</p>
          <div className="flex items-center gap-1 mt-1">
             <TrendingUp className="h-2.5 w-2.5 text-primary" />
             <p className="text-[8px] text-primary font-black uppercase tracking-widest">Growth</p>
          </div>
        </div>
      </div>

      {/* Main List Section */}
      <div className="glass-card rounded-3xl flex flex-col min-h-[500px] overflow-hidden">
        <div className="p-6 border-b border-border/50 flex flex-col gap-4">
          <button 
            onClick={() => setIsAdding(true)}
            className="w-full premium-gradient text-white px-6 py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 transition-all uppercase tracking-widest whitespace-nowrap"
          >
            <UserPlus className="h-4 w-4" /> Add Customer
          </button>

          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder="Search by name or phone number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-accent/50 border border-border rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
            />
          </div>
        </div>

        <div className="flex-1 overflow-x-auto scrollbar-none">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-accent/30">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Customer Detail</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Credit Balance</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Total Revenue</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map(customer => {
                const hasCredit = customer.balance > 0;
                return (
                  <tr key={customer.id} className="group hover:bg-primary/5 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl premium-gradient flex items-center justify-center text-white font-black text-sm shadow-md">
                          {customer.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-sm tracking-tight">{customer.name}</p>
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-semibold mt-0.5 uppercase tracking-tighter">
                            <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {customer.phone}</span>
                            {customer.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {customer.email}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className={cn(
                        "inline-flex items-center px-4 py-1.5 rounded-full font-black text-xs transition-all",
                        hasCredit ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-green-500/10 text-green-500 border border-green-500/20"
                      )}>
                        {hasCredit ? formatCurrency(customer.balance) : <><CheckCircle2 className="h-3 w-3 mr-1.5" /> PAID</>}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right font-black tabular-nums text-sm">
                      {formatCurrency(customer.totalSpent)}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-end gap-2">
                        {hasCredit && (
                          <button 
                            onClick={() => {
                              setPaymentCustomerId(customer.id);
                              setPaymentAmount('');
                            }}
                            className="bg-primary/10 text-primary hover:bg-primary hover:text-white px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all border border-primary/20"
                          >
                            Pay Off
                          </button>
                        )}
                        <button 
                          onClick={() => setHistoryCustomer(customer)}
                          className="p-2 hover:bg-primary/10 hover:text-primary rounded-xl transition-all"
                          title="View History"
                        >
                          <History className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => setDeleteConfirmId(customer.id)}
                          className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-xl transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-20 text-muted-foreground italic">
              No customers found in the system.
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsAdding(false)} />
          <div className="relative z-10 w-full max-w-md glass-card rounded-3xl p-8 border-primary/20">
            <h2 className="text-2xl font-black mb-6 tracking-tight">Onboard Customer</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Full Name</label>
                <input 
                  autoFocus
                  required
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full bg-accent border border-border rounded-2xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Mobile Number</label>
                <input 
                  required
                  type="text" 
                  value={formData.phone}
                  maxLength={10}
                  onChange={(e) => setFormData({ ...formData, phone: sanitizePhone(e.target.value) })}
                  placeholder="e.g. 9876543210"
                  className={`w-full bg-accent border rounded-2xl py-3 px-4 text-sm focus:ring-2 outline-none font-bold transition-all ${
                    formData.phone && !isValidIndianPhone(formData.phone) ? "border-red-500/50 ring-red-500/20 text-red-500" : "border-border focus:ring-primary/20"
                  }`}
                />
                {formData.phone && !isValidIndianPhone(formData.phone) && (
                  <p className="text-[9px] text-red-500 font-bold flex items-center gap-1 mt-1 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle className="h-3 w-3" /> Enter valid 10-digit Indian number
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Email ID (Optional)</label>
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. john@example.com"
                  className="w-full bg-accent border border-border rounded-2xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none font-bold"
                />
              </div>
              <div className="pt-4 grid grid-cols-2 gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsAdding(false)}
                  className="py-3 px-4 rounded-2xl font-bold text-sm border border-border hover:bg-accent transition-all uppercase tracking-widest text-muted-foreground"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={!formData.name || formData.phone.length !== 10 || !isValidIndianPhone(formData.phone)}
                  className={`py-3 px-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
                    formData.name && formData.phone.length === 10 && isValidIndianPhone(formData.phone)
                      ? 'premium-gradient text-white shadow-lg hover:-translate-y-0.5' 
                      : 'bg-accent text-muted-foreground cursor-not-allowed'
                  }`}
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Slide-over/Modal */}
      {historyCustomer && (
        <div className="fixed inset-0 z-[150] flex items-center justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setHistoryCustomer(null)} />
          <div className="relative z-10 w-full max-w-lg h-full glass-card border-l border-border shadow-2xl animate-in p-8 flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black">Transaction History</h2>
                <p className="text-sm font-bold text-primary uppercase tracking-widest">{historyCustomer.name}</p>
              </div>
              <button onClick={() => setHistoryCustomer(null)} className="p-2 hover:bg-accent rounded-xl transition-all">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {getCustomerHistory(historyCustomer.id).length === 0 ? (
                <div className="text-center py-20 opacity-30">
                  <Clock className="h-12 w-12 mx-auto mb-3" />
                  <p className="text-sm font-bold uppercase tracking-widest">No history found</p>
                </div>
              ) : (
                getCustomerHistory(historyCustomer.id).map(sale => (
                  <div key={sale.id} className="p-4 bg-accent/30 rounded-2xl border border-border/50 group hover:border-primary/30 transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-xs font-black uppercase tracking-tighter opacity-60">INV-{sale.id.toUpperCase()}</p>
                        <p className="text-xs font-bold">{new Date(sale.createdAt).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${sale.paymentMode === 'CREDIT' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                        {sale.paymentMode}
                      </span>
                    </div>
                    <div className="space-y-1 my-3">
                      {sale.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-[11px] font-medium">
                          <span className="opacity-70">{item.name} × {item.quantity}</span>
                          <span>{formatCurrency(item.price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-border/30">
                      <span className="text-xs font-black uppercase tracking-widest opacity-50">Total Paid</span>
                      <span className="text-sm font-black text-primary">{formatCurrency(sale.total)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirmId && (
        <ConfirmDialog
          open={!!deleteConfirmId}
          title="Delete Customer Account"
          description="Are you sure you want to remove this customer? This will NOT delete their past sales, but they will no longer be linked to an account."
          onConfirm={async () => {
            await deleteCustomer(deleteConfirmId);
            setDeleteConfirmId(null);
          }}
          onClose={() => setDeleteConfirmId(null)}
          variant="danger"
        />
      )}

      {/* Payment Dialog */}
      {paymentCustomerId && (
        <ConfirmDialog
          open={!!paymentCustomerId}
          title="Receive Payment"
          description={`Enter the amount paid by the customer to reduce their Udhaar balance.`}
          inputValue={paymentAmount}
          onInputChange={setPaymentAmount}
          confirmText="Record Payment"
          icon={<IndianRupee className="h-8 w-8 text-primary" />}
          onConfirm={() => {
            if (paymentAmount) {
              handlePayment(paymentCustomerId, parseFloat(paymentAmount));
              setPaymentCustomerId(null);
              setPaymentAmount('');
            }
          }}
          onClose={() => {
            setPaymentCustomerId(null);
            setPaymentAmount('');
          }}
          variant="primary"
        />
      )}
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
