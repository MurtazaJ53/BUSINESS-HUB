import { BarChart3, TrendingUp } from 'lucide-react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';

export type RevenuePulsePoint = {
  day: string;
  sales?: number;
  forecast?: number;
  high?: number;
};

export default function RevenuePulseCard({
  totalSalesRevenue,
  data,
}: {
  totalSalesRevenue: number;
  data: RevenuePulsePoint[];
}) {
  return (
    <div className="lg:col-span-4 glass-card rounded-3xl p-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          7-Day Revenue Pulse
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">Actual</span>
          </div>
          <div className="flex items-center gap-1.5 border-l border-border pl-3">
            <div className="h-2 w-2 rounded-full bg-purple-500" />
            <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">AI Forecast</span>
          </div>
        </div>
      </div>
      {totalSalesRevenue === 0 ? (
        <div className="h-[260px] flex flex-col items-center justify-center text-center text-muted-foreground opacity-40">
          <BarChart3 className="h-12 w-12 mb-3" />
          <p className="text-sm font-bold">No sales recorded yet</p>
        </div>
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(199,89%,48%)" stopOpacity={1} />
                  <stop offset="100%" stopColor="hsl(199,89%,48%)" stopOpacity={0.5} />
                </linearGradient>
                <linearGradient id="forecastArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700 }} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fontWeight: 700 }}
                tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: 'hsl(var(--foreground))',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                }}
                formatter={(v: number | string, name: string) => [formatCurrency(Number(v)), name]}
                cursor={{ fill: 'rgba(14,165,233,0.08)' }}
              />
              <Bar dataKey="sales" name="Actual Sales" fill="url(#barGrad)" radius={[6, 6, 0, 0]} barSize={35} />
              <Area dataKey="forecast" name="AI Forecast" fill="url(#forecastArea)" stroke="#a855f7" strokeWidth={2} strokeDasharray="5 5" />
              <Area dataKey="high" name="Confidence Band" fill="#a855f7" stroke="none" fillOpacity={0.05} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
