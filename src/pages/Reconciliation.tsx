import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  Wallet, 
  History, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck,
  Save,
  Clock
} from 'lucide-react';
import { useSqlQuery } from '@/db/hooks';
import { useBusinessStore } from '@/lib/useBusinessStore';
import { useAuthStore } from '@/lib/useAuthStore';
import { formatCurrency, cn } from '@/lib/utils';
import { logAuditEntry } from '@/lib/audit';
import Input from '@/components/Input';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function Reconciliation() {
  const { shopId, role } = useBusinessStore();
  const { user } = useAuthStore();
  const today = new Date().toISOString().split('T')[0];

  // Fetch today's cash payments using a JOIN
  // sale_payments table stores the individual modes/amounts
  const cashSales = useSqlQuery<{ amount: number }>(
    `SELECT sp.amount 
     FROM sale_payments sp
     JOIN sales s ON s.id = sp.sale_id
     WHERE sp.mode = 'CASH' AND date(s.date) = ? AND s.tombstone = 0`,
    [today],
    ['sales', 'sale_payments']
  );

  const expectedCash = useMemo(() => 
    cashSales.reduce((sum, s) => sum + (s.amount || 0), 0),
  [cashSales]);

  const [countedCash, setCountedCash] = useState('');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const variance = (parseFloat(countedCash) || 0) - expectedCash;
  const hasHighVariance = Math.abs(variance) > 100;

  const handleSubmit = async () => {
    if (!shopId || !user) return;
    setIsSaving(true);
    setSuccess(false);

    try {
      const data = {
        date: today,
        expected: expectedCash,
        counted: parseFloat(countedCash) || 0,
        variance,
        note,
        submittedBy: user.uid,
        submittedByEmail: user.email,
        timestamp: serverTimestamp()
      };

      await setDoc(doc(db, `shops/${shopId}/reconciliations`, today), data);

      if (hasHighVariance) {
        await logAuditEntry(
          shopId,
          user.uid,
          user.email || 'unknown',
          'RECONCILIATION_VARIANCE',
          `High cash variance of ${formatCurrency(variance)} detected on ${today}`,
          { expected: expectedCash, counted: parseFloat(countedCash), variance }
        );
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to save reconciliation');
    } finally {
      setIsSaving(false);
    }
  };

  if (role !== 'admin') {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <ShieldCheck className="h-20 w-20 text-muted-foreground/20 mb-6" />
        <h2 className="text-3xl font-black tracking-tight">Restricted Access</h2>
        <p className="text-muted-foreground mt-2 font-medium">Reconciliation is an admin-only administrative tool.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-10 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-none mb-3">Cash Drawer Reconciliation</h1>
        <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-90">Verify daily physical cash against system records</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left Column: Metrics */}
        <div className="space-y-6">
          <div className="glass-card p-8 rounded-[2rem] border-primary/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-[0.05] pointer-events-none group-hover:scale-110 transition-transform duration-500">
              <Calculator className="h-24 w-24" />
            </div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-3">System Expected (CASH)</p>
            <p className="text-5xl font-black text-primary tracking-tighter">{formatCurrency(expectedCash)}</p>
            <div className="mt-6 flex items-center gap-2 text-xs font-bold text-muted-foreground/60">
              <History className="h-3 w-3" />
              <span>Calculated from {cashSales.length} today's cash sales</span>
            </div>
          </div>

          <div className={cn(
            "glass-card p-8 rounded-[2rem] border-2 transition-all duration-500",
            variance === 0 ? "border-green-500/20" : hasHighVariance ? "border-red-500/30 bg-red-500/5" : "border-amber-500/20"
          )}>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-3">Accounting Variance</p>
            <div className="flex items-baseline gap-2">
              <p className={cn(
                "text-4xl font-black tracking-tighter",
                variance === 0 ? "text-green-500" : hasHighVariance ? "text-red-500" : "text-amber-500"
              )}>
                {variance > 0 ? '+' : ''}{formatCurrency(variance)}
              </p>
              {hasHighVariance && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 text-red-500 rounded-lg text-[9px] font-black uppercase animate-pulse">
                  <AlertTriangle className="h-3 w-3" />
                  Audit Required
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Entry Form */}
        <div className="glass-card p-8 rounded-[2rem] space-y-8 flex flex-col border-border/50">
          <div className="space-y-4">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Wallet className="h-3 w-3 text-primary" />
              Physical Cash Counted (₹)
            </label>
            <Input
              type="number"
              placeholder="0.00"
              value={countedCash}
              onChange={(e) => setCountedCash(e.target.value)}
              className="text-2xl h-16 font-black rounded-2xl bg-accent/30 border-none focus-visible:ring-2 focus-visible:ring-primary shadow-inner"
            />
          </div>

          <div className="space-y-4">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              Note / Explanation
            </label>
            <textarea
              placeholder="e.g. Petty cash withdrawal, or discrepancy notes..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full min-h-[120px] p-4 rounded-2xl bg-accent/30 border-none focus:ring-2 focus:ring-primary outline-none text-sm font-medium resize-none transition-all"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!countedCash || isSaving}
            className="mt-auto h-16 w-full bg-primary text-primary-foreground rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 disabled:grayscale disabled:opacity-50 transition-all group"
          >
            {isSaving ? (
              <Calculator className="h-6 w-6 animate-spin" />
            ) : success ? (
              <>
                <CheckCircle2 className="h-6 w-6" />
                Saved & Synced
              </>
            ) : (
              <>
                <Save className="h-6 w-6 group-hover:scale-110 transition-transform" />
                Submit EOD Report
              </>
            )}
          </button>
        </div>
      </div>

      {/* Safety Footer */}
      <div className="p-6 bg-accent/20 rounded-3xl border border-border flex flex-col md:flex-row gap-6 items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-xs font-black uppercase opacity-60">Session Window</p>
            <p className="font-bold text-sm">Today until midnight (Local Time)</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ShieldCheck className="h-5 w-5 text-green-500" />
          <p className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase leading-relaxed text-center md:text-left">
            Submitting this report locks today's cash records.<br />Any deviation &gt; ₹100 triggers a permanent <span className="text-primary">Audit Log</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
