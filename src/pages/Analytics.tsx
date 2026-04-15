import React, { useState } from 'react';
import { TrendingUp, TrendingDown, BarChart3, Target, Calendar, ShoppingCart } from 'lucide-react';
import { useBusinessStore } from '@/lib/useBusinessStore';
import { formatCurrency } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line
} from 'recharts';

export default function Analytics() {
  const { sales } = useBusinessStore();
  const [period, setPeriod] = useState<'week' | 'month' | 'custom'>('week');
  
  const todayStr = new Date().toISOString().split('T')[0];
  const lastWeekStr = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  
  const [startDate, setStartDate] = useState(lastWeekStr);
  const [endDate, setEndDate] = useState(todayStr);

  const getFilteredSales = () => {
    if (period === 'week') {
      const cut = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      return sales.filter(s => s.date >= cut);
    }
    if (period === 'month') {
      const cut = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      return sales.filter(s => s.date >= cut);
    }
    return sales.filter(s => s.date >= startDate && s.date <= endDate);
  };

  const filteredSalesData = getFilteredSales();

  const getDateRange = () => {
    const rangeSize = period === 'week' ? 7 : (period === 'month' ? 30 : 0);
    if (rangeSize > 0) {
      return Array.from({ length: rangeSize }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (rangeSize - 1 - i));
        return d.toISOString().split('T')[0];
      });
    }
    const dates = [];
    let curr = new Date(startDate);
    const end = new Date(endDate);
    while (curr <= end) {
      dates.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
      if (dates.length > 90) break;
    }
    return dates;
  };

  const currentRange = getDateRange();
  const chartData = currentRange.map((date) => {
    const daySales = filteredSalesData.filter((s) => s.date === date);
    return {
      day: new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
        weekday: period === 'week' ? 'short' : undefined,
        day: 'numeric',
        month: period === 'month' || period === 'custom' ? 'short' : undefined,
      }),
      sales: daySales.reduce((sum, s) => sum + s.total, 0),
      orders: daySales.length,
    };
  });

  // ── KPI Stats ─────────────────────────────────────────────────────────────
  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const totalOrders = sales.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Previous period comparison
  const days = period === 'week' ? 7 : (period === 'month' ? 30 : currentRange.length || 7);
  const now = new Date();
  const midPoint = new Date();
  midPoint.setDate(now.getDate() - days);
  const halfPoint = new Date();
  halfPoint.setDate(now.getDate() - days * 2);

  const currentPeriodSales = sales.filter((s) => new Date(s.date) >= midPoint);
  const prevPeriodSales = sales.filter((s) => {
    const d = new Date(s.date);
    return d >= halfPoint && d < midPoint;
  });

  const currentRev = currentPeriodSales.reduce((sum, s) => sum + s.total, 0);
  const prevRev = prevPeriodSales.reduce((sum, s) => sum + s.total, 0);
  const revChange = prevRev > 0 ? ((currentRev - prevRev) / prevRev) * 100 : null;

  // ── Top Products ─────────────────────────────────────────────────────────
  const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
  for (const sale of sales) {
    for (const item of sale.items) {
      if (!productSales[item.name]) {
        productSales[item.name] = { name: item.name, qty: 0, revenue: 0 };
      }
      productSales[item.name].qty += item.quantity;
      productSales[item.name].revenue += item.price * item.quantity;
    }
  }
  const topProducts = Object.values(productSales)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
  const maxRevenue = Math.max(...topProducts.map((p) => p.revenue), 1);

  // ── Payment mode breakdown ────────────────────────────────────────────────
  const payModes: Record<string, number> = {};
  for (const sale of sales) {
    payModes[sale.paymentMode] = (payModes[sale.paymentMode] || 0) + sale.total;
  }
  const payModeSorted = Object.entries(payModes).sort((a, b) => b[1] - a[1]);

  const bestDay = chartData.reduce((best, d) => (d.sales > best.sales ? d : best), chartData[0] ?? { day: '—', sales: 0 });

  return (
    <div className="space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/50">
        <div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter leading-none mb-2">Analytics</h1>
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest opacity-70">Business Performance Insights</p>
        </div>
        <div className="flex flex-col md:items-end gap-3">
          <div className="flex gap-2 bg-accent/50 rounded-2xl p-1.5 border border-border">
            {(['week', 'month', 'custom'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  period === p 
                  ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                  : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          
          {period === 'custom' && (
            <div className="flex items-center gap-2 animate-in">
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-accent/50 border border-border rounded-xl px-3 py-1.5 text-[10px] font-black uppercase focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <span className="text-muted-foreground font-black text-[10px]">to</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-accent/50 border border-border rounded-xl px-3 py-1.5 text-[10px] font-black uppercase focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Revenue',
            value: formatCurrency(totalRevenue),
            change: revChange,
            icon: TrendingUp,
          },
          { label: 'Total Orders', value: String(totalOrders), change: null, icon: ShoppingCart },
          { label: 'Avg Order Value', value: formatCurrency(avgOrderValue), change: null, icon: Target },
          { label: 'Best Day', value: bestDay.day ?? '—', sub: formatCurrency(bestDay.sales), icon: Calendar },
        ].map((stat, idx) => (
          <div key={idx} className="glass-card p-5 rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
              {stat.change !== null && stat.change !== undefined && (
                <span className={`text-xs font-bold flex items-center gap-0.5 ${stat.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {stat.change >= 0
                    ? <TrendingUp className="h-3 w-3" />
                    : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(stat.change).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{stat.label}</p>
            <p className="text-xl font-black mt-0.5">{stat.value}</p>
            {stat.sub && <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Sales Bar Chart */}
        <div className="lg:col-span-3 glass-card rounded-3xl p-6">
          <h3 className="font-bold text-base mb-6 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            {period === 'week' ? 'Daily Sales (Last 7 Days)' : 'Daily Sales (Last 30 Days)'}
          </h3>
          {totalRevenue === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-muted-foreground opacity-30">
              <BarChart3 className="h-12 w-12 mb-3" />
              <p className="text-sm font-bold">No sales data yet</p>
              <p className="text-xs mt-1">Use POS to record your first sale</p>
            </div>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <defs>
                    <linearGradient id="anaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(199,89%,48%)" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(199,89%,48%)" stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fontWeight: 700 }}
                    tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', border: 'none', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', color: '#fff' }}
                    formatter={(v: number) => [formatCurrency(v), 'Revenue']}
                    cursor={{ fill: 'rgba(14,165,233,0.06)' }}
                  />
                  <Bar dataKey="sales" fill="url(#anaGrad)" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Top Products */}
        <div className="lg:col-span-2 glass-card rounded-3xl p-6">
          <h3 className="font-bold text-base mb-6">Top Products</h3>
          {topProducts.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground opacity-30 text-sm font-bold">
              No sales recorded yet
            </div>
          ) : (
            <div className="space-y-4">
              {topProducts.map((product, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-black text-muted-foreground w-4 shrink-0">#{idx + 1}</span>
                      <span className="text-sm font-semibold truncate">{product.name}</span>
                    </div>
                    <span className="text-xs font-bold text-primary shrink-0 ml-2">{formatCurrency(product.revenue)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                    <div
                      className="h-full premium-gradient rounded-full transition-all duration-700"
                      style={{ width: `${(product.revenue / maxRevenue) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{product.qty} units sold</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Payment Mode & Orders Line Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders trend */}
        <div className="glass-card rounded-3xl p-6">
          <h3 className="font-bold text-base mb-6">Order Volume Trend</h3>
          {totalOrders === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground opacity-30 text-sm font-bold">No data</div>
          ) : (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', border: 'none', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', color: '#fff' }}
                    formatter={(v: number) => [v, 'Orders']}
                    cursor={{ stroke: 'rgba(14,165,233,0.2)' }}
                  />
                  <Line type="monotone" dataKey="orders" stroke="hsl(199,89%,48%)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Payment mode breakdown */}
        <div className="glass-card rounded-3xl p-6">
          <h3 className="font-bold text-base mb-6">Revenue by Payment Mode</h3>
          {payModeSorted.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground opacity-30 text-sm font-bold">No data</div>
          ) : (
            <div className="space-y-3">
              {payModeSorted.map(([mode, rev]) => (
                <div key={mode} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold">{mode}</span>
                    <span className="font-black text-primary">{formatCurrency(rev)}</span>
                  </div>
                  <div className="h-2 w-full bg-accent rounded-full overflow-hidden">
                    <div
                      className="h-full premium-gradient rounded-full"
                      style={{ width: `${(rev / totalRevenue) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{((rev / totalRevenue) * 100).toFixed(1)}% of revenue</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
