import React, { useState } from 'react';
import { 
  Bot, 
  Play, 
  History, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Package, 
  MessageSquare, 
  TrendingUp,
  ShieldCheck,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { useBusinessStore } from '@/lib/useBusinessStore';
import { useAuthStore } from '@/lib/useAuthStore';
import { formatCurrency, cn } from '@/lib/utils';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { useEffect } from 'react';

interface AgentCardProps {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  lastRun?: string;
  status?: 'idle' | 'running' | 'failed';
  onRun: () => void;
}

function AgentCard({ name, description, icon: Icon, lastRun, status, onRun }: AgentCardProps) {
  return (
    <div className="glass-card p-6 rounded-[2rem] border-primary/10 flex flex-col group hover:shadow-2xl transition-all duration-500">
      <div className="flex items-start justify-between mb-4">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        {status === 'running' && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/20 rounded-full">
            <Loader2 className="h-3 w-3 text-primary animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Active</span>
          </div>
        )}
      </div>
      <h3 className="text-xl font-black tracking-tight mb-2">{name}</h3>
      <p className="text-sm text-muted-foreground font-medium mb-6 flex-grow">{description}</p>
      
      <div className="mt-auto space-y-4">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-60">
          <Clock className="h-3 w-3" />
          Last Run: {lastRun || 'Never'}
        </div>
        <button
          onClick={onRun}
          disabled={status === 'running'}
          className="w-full h-12 bg-accent hover:bg-primary hover:text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 group/btn"
        >
          {status === 'running' ? 'Processing...' : 'Run Agent Now'}
          <Play className="h-3 w-3 group-hover/btn:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}

export default function Agents() {
  const { shopId } = useBusinessStore();
  const { user } = useAuthStore();
  const [activeRuns, setActiveRuns] = useState<Record<string, any>>({});
  const [approvals, setApprovals] = useState<any[]>([]);

  // Real-time Approval Queue
  useEffect(() => {
    if (!shopId) return;
    const q = query(collection(db, `shops/${shopId}/purchase_orders`), orderBy('createdAt', 'desc'), limit(10));
    return onSnapshot(q, (snap) => {
      setApprovals(snap.docs.map(d => ({ id: d.id, type: 'PO', ...d.data() })));
    });
  }, [shopId]);

  const runAgent = async (agentName: string) => {
    if (!shopId) return;
    setActiveRuns(prev => ({ ...prev, [agentName]: 'running' }));
    
    try {
      const runner = httpsCallable(functions, 'runAgent');
      await runner({ shopId, agentName });
      // In a real app, we'd listen to the events collection for streaming updates
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    } finally {
      setActiveRuns(prev => ({ ...prev, [agentName]: 'idle' }));
    }
  };

  const agentList = [
    {
      id: 'restock',
      name: 'Inventory Restocker',
      description: 'Analyzes velocity and lead times to draft optimal purchase orders for local suppliers.',
      icon: Package
    },
    {
      id: 'anomaly',
      name: 'Anomaly Guardian',
      description: 'Scans sales for fraud, excessive discounts, and margin leakage in real-time.',
      icon: AlertTriangle
    },
    {
      id: 'dunning',
      name: 'Credit Collector',
      description: 'Drafts polite WhatsApp reminders for customers with long-standing credit balances.',
      icon: MessageSquare
    },
    {
      id: 'summary',
      name: 'Executive Briefing',
      description: 'Synthesizes yesterday’s performance into an actionable daily report for the owner.',
      icon: TrendingUp
    }
  ];

  return (
    <div className="space-y-12 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/50">
        <div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter leading-none mb-3">AI Agent Command</h1>
          <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-90">Autonomous Ops & Business Intelligence</p>
        </div>
        <div className="flex items-center gap-3 bg-primary/10 px-6 py-3 rounded-2xl border border-primary/20">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="text-xs font-black uppercase tracking-widest text-primary">Permission Aware Core</span>
        </div>
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {agentList.map(agent => (
          <AgentCard
            key={agent.id}
            {...agent}
            status={activeRuns[agent.id]}
            onRun={() => runAgent(agent.id)}
          />
        ))}
      </div>

      {/* Approval Queue */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-accent flex items-center justify-center">
              <History className="h-4 w-4 text-primary" />
            </div>
            Approval Queue
          </h2>
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 py-1 bg-accent rounded-full">
            {approvals.length} Pending Actions
          </span>
        </div>

        {approvals.length === 0 ? (
          <div className="glass-card py-20 rounded-[2rem] border-dashed flex flex-col items-center justify-center text-center opacity-40">
            <Bot className="h-12 w-12 mb-4" />
            <p className="font-bold text-sm italic">Queue is clear. Agents are monitoring the floor.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {approvals.map(item => (
              <div key={item.id} className="glass-card p-6 rounded-3xl border-primary/5 flex items-center justify-between group hover:border-primary/20 transition-all">
                <div className="flex items-center gap-6">
                  <div className="h-14 w-14 rounded-2xl bg-accent flex flex-col items-center justify-center">
                    <span className="text-[8px] font-black uppercase text-muted-foreground tracking-tighter">Draft</span>
                    <span className="text-xs font-black">{item.type}</span>
                  </div>
                  <div>
                    <h4 className="font-black text-lg tracking-tight">
                      {item.type === 'PO' ? `Restock: ${item.items?.length || 0} items` : 'Dunning Reminder'}
                    </h4>
                    <p className="text-xs text-muted-foreground font-medium">
                      Source: {item.createdBy} • {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button className="px-6 h-12 rounded-xl text-xs font-black uppercase tracking-widest text-muted-foreground hover:bg-accent transition-all">
                    Discard
                  </button>
                  <button className="px-8 h-12 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all flex items-center gap-2">
                    Review & Send
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
