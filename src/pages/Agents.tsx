import {
  AlertTriangle,
  Bot,
  Clock3,
  MessageSquare,
  Package,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

interface AgentPreviewCardProps {
  name: string;
  description: string;
  icon: React.ElementType;
}

function AgentPreviewCard({ name, description, icon: Icon }: AgentPreviewCardProps) {
  return (
    <div className="glass-card relative overflow-hidden rounded-[2rem] border border-border/60 p-6">
      <div className="absolute right-4 top-4 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1">
        <span className="text-[9px] font-black uppercase tracking-[0.28em] text-amber-400">
          Coming Soon
        </span>
      </div>

      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
        <Icon className="h-6 w-6 text-primary" />
      </div>

      <h3 className="mb-2 pr-24 text-xl font-black tracking-tight">{name}</h3>
      <p className="min-h-20 text-sm font-medium leading-relaxed text-muted-foreground">
        {description}
      </p>

      <div className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground/70">
        <Clock3 className="h-3.5 w-3.5" />
        Launch Window Pending
      </div>

      <button
        disabled
        className="mt-5 flex h-12 w-full cursor-not-allowed items-center justify-center rounded-xl border border-border bg-accent/40 text-xs font-black uppercase tracking-[0.24em] text-muted-foreground/60 opacity-80"
      >
        Blocked For Now
      </button>
    </div>
  );
}

export default function Agents() {
  const agentList = [
    {
      name: 'Inventory Restocker',
      description: 'Will analyze velocity and lead times to prepare supplier-ready restock suggestions.',
      icon: Package,
    },
    {
      name: 'Anomaly Guardian',
      description: 'Will watch sales patterns for fraud, excess discounts, and unusual margin drops.',
      icon: AlertTriangle,
    },
    {
      name: 'Credit Collector',
      description: 'Will prepare polite follow-ups for customers with overdue balance reminders.',
      icon: MessageSquare,
    },
    {
      name: 'Executive Briefing',
      description: 'Will generate a concise daily summary for the owner with next actions highlighted.',
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col gap-6 border-b border-border/50 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-2">
            <Clock3 className="h-4 w-4 text-amber-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-400">
              Coming Soon
            </span>
          </div>
          <h1 className="text-3xl font-black leading-none tracking-tighter md:text-5xl">
            AI Agents Coming Soon
          </h1>
          <p className="mt-4 max-w-2xl text-sm font-medium leading-relaxed text-muted-foreground md:text-base">
            This area is intentionally blocked for now. The automation layer is not ready for live use, so every
            agent action has been disabled until the workflows are stable.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/10 px-6 py-4">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-primary">Module Paused</p>
            <p className="text-[11px] font-bold text-muted-foreground">Visible for preview only</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {agentList.map((agent) => (
          <AgentPreviewCard key={agent.name} {...agent} />
        ))}
      </div>

      <div className="glass-card rounded-[2rem] border border-dashed border-border/70 p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-2xl font-black tracking-tight">AI command is parked for now</h2>
            <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground">
              Once the backend flows are reliable, this page can be reopened with real approvals, execution history,
              and live run status. Until then, nothing here can be started by mistake.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-accent/30 px-5 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground">
              Status
            </p>
            <p className="mt-2 text-lg font-black tracking-tight text-foreground">Blocked</p>
          </div>
        </div>
      </div>
    </div>
  );
}
