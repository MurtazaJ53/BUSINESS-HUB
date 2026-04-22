import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, BarChart3, Target, Calendar, ShoppingCart, Wallet, CheckCircle2 } from 'lucide-react';
import { useSqlQuery } from '@/db/hooks';
import { useBusinessStore } from '@/lib/useBusinessStore';
import { usePermission } from '@/hooks/usePermission';
import { formatCurrency, cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Area, ComposedChart
} from 'recharts';
import { getDeadStock } from '@/lib/analyticsUtils';
import { calculateForecast } from '@/lib/forecast';
import type { Sale, InventoryItem, InventoryPrivate, CustomerPayment, Expense, SaleItem } from '@/lib/types';

export default function Analytics() {
  const { customerPayments, expenses: storeExpenses, role } = useBusinessStore();
  const canViewCost = usePermission('inventory', 'view_cost');
  const canViewProfit = usePermission('sales', 'view_profit');
  const sales = useSqlQuery<Sale>('SELECT * FROM sales WHERE tombstone = 0 ORDER BY createdAt DESC', [], ['sales']);
  const inventory = useSqlQuery<InventoryItem>('SELECT * FROM inventory WHERE tombstone = 0 ORDER BY name ASC', [], ['inventory']);
  const inventoryPrivate = useSqlQuery<any>('SELECT * FROM inventory_private WHERE tombstone = 0', [], ['inventory_private']);
  const [period, setPeriod] = useState<'week' | 'month' | 'custom'>('week');
  
  const todayStr = new Date().toISOString().split('T')[0];
  const lastWeekStr = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  
  const [startDate, setStartDate] = useState(lastWeekStr);
  const [endDate, setEndDate] = useState(todayStr);

  const getFilteredData = (data: any[]) => {
    if (period === 'week') {
      const cut = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      return data.filter((s: any) => s.date >= cut);
    }
    if (period === 'month') {
      const cut = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      return data.filter((s: any) => s.date >= cut);
    }
    return data.filter((s: any) => s.date >= startDate && s.date <= endDate);
  };

  const filteredSalesData = getFilteredData(sales).filter(s => !s.id.startsWith('PAY-'));
  const filteredPayments = getFilteredData(customerPayments);

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
    const daySales = filteredSalesData.filter((s: Sale) => s.date === date);
    const dayRevenue = daySales.reduce((sum: number, s: Sale) => sum + s.total, 0);
    const dayCost = canViewCost ? daySales.reduce((sum: number, s: Sale) => {
      return sum + s.items.reduce((itemSum: number, item: SaleItem) => {
        const privateData = inventoryPrivate.find((p: InventoryPrivate) => p.id === item.itemId);
        const costPrice = privateData?.costPrice || 0;
        return itemSum + costPrice * item.quantity;
      }, 0);
    }, 0) : 0;

    return {
      day: new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
        weekday: period === 'week' ? 'short' : undefined,
        day: 'numeric',
        month: period === 'month' || period === 'custom' ? 'short' : undefined,
      }),
      sales: dayRevenue,
      profit: canViewProfit ? dayRevenue - dayCost : 0,
      orders: daySales.length,
    };
  });

  // ── Forecast Calculation ────────────────────────────────────────────────
  const forecastData = useMemo(() => {
    const historyDays = 30;
    const historyDates = Array.from({ length: historyDays }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (historyDays - i));
      return d.toISOString().split('T')[0];
    });

    const historicalSeries = historyDates.map(date => {
      return sales
        .filter((s: Sale) => s.date === date)
        .reduce((sum, s) => sum + s.total, 0);
    });

    if (historicalSeries.filter(v => v > 0).length < 7) return [];

    try {
      const forecast = calculateForecast(historicalSeries, 7);
      return forecast.next7.map((val, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i + 1);
        return {
          day: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
          forecast: val,
          low: forecast.confidenceBand.low[i],
          high: forecast.confidenceBand.high[i],
          isForecast: true
        };
      });
    } catch (e) {
      return [];
    }
  }, [sales]);

  const combinedChartData = [...chartData, ...forecastData];

  // ── KPI Stats ─────────────────────────────────────────────────────────────
  const totalRevenue = sales.reduce((sum: number, s: Sale) => sum + s.total, 0);
  const totalCost = canViewCost ? sales.reduce((sum: number, s: Sale) => {
    return sum + s.items.reduce((itemSum: number, item: SaleItem) => {
      const privateData = inventoryPrivate.find((p: InventoryPrivate) => p.id === item.itemId);
      const costPrice = privateData?.costPrice || 0;
      return itemSum + costPrice * item.quantity;
    }, 0);
  }, 0) : 0;
  const totalExpenses = storeExpenses.reduce((sum: number, e: Expense) => sum + e.amount, 0);
  
  const grossProfit = canViewProfit ? totalRevenue - totalCost : 0;
  const netProfit = canViewProfit ? grossProfit - totalExpenses : 0;
  const profitMargin = totalRevenue > 0 && canViewProfit ? (grossProfit / totalRevenue) * 100 : 0;

  const totalOrders = sales.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Previous period comparison
  const days = period === 'week' ? 7 : (period === 'month' ? 30 : currentRange.length || 7);
  const now = new Date();
  const midPoint = new Date();
  midPoint.setDate(now.getDate() - days);
  const halfPoint = new Date();
  halfPoint.setDate(now.getDate() - days * 2);

  const currentPeriodSales = sales.filter((s: Sale) => new Date(s.date) >= midPoint);
  const prevPeriodSales = sales.filter((s: Sale) => {
    const d = new Date(s.date);
    return d >= halfPoint && d < midPoint;
  });

  const currentRev = (() => {
    const salesAmount = filteredSalesData.reduce((sum: number, s: Sale) => sum + s.total, 0);
    const paymentsAmount = filteredPayments.reduce((sum: number, p: CustomerPayment) => sum + p.amount, 0);
    return salesAmount + paymentsAmount;
  })();
  const prevRev = prevPeriodSales.reduce((sum: number, s: Sale) => sum + s.total, 0);
  const revChange = prevRev > 0 ? ((currentRev - prevRev) / prevRev) * 100 : null;

  // ── Top Products & Dead Stock ─────────────────────────────────────────────────────────
  const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
  for (const sale of filteredSalesData) {
    for (const item of sale.items) {
      if (item.itemId === 'payment-received') continue;
      if (!productSales[item.name]) {
        productSales[item.name] = { name: item.name, qty: 0, revenue: 0 };
      }
      productSales[item.name].qty += item.quantity;
      productSales[item.name].revenue += item.price * item.quantity;
    }
  }
  
  const allProducts = Object.values(productSales);
  inventory.forEach((invItem: InventoryItem) => {
    if (!productSales[invItem.name]) {
      allProducts.push({ name: invItem.name, qty: 0, revenue: 0 });
    }
  });

  const topProducts = [...allProducts]
    .sort((a, b) => b.revenue - a.revenue)
    .filter(p => p.qty > 0)
    .slice(0, 5);
    
  const lowestProducts = [...allProducts]
    .sort((a, b) => a.qty - b.qty || a.revenue - b.revenue)
    .slice(0, 5);
    
  const maxRevenue = Math.max(...topProducts.map((p) => p.revenue), 1);

  const payModes: Record<string, number> = {};
  
  payModes['REPAYMENT'] = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

  for (const sale of filteredSalesData) {
    if (sale.payments && sale.payments.length > 0) {
      for (const p of sale.payments) {
        payModes[p.mode] = (payModes[p.mode] || 0) + p.amount;
      }
    } else {
      payModes[sale.paymentMode] = (payModes[sale.paymentMode] || 0) + sale.total;
    }
  }
  const payModeSorted = Object.entries(payModes).filter(entry => entry[1] > 0).sort((a, b) => b[1] - a[1]);

  const bestDay = chartData.reduce((best, d) => (d.sales > best.sales ? d : best), chartData[0] ?? { day: '—', sales: 0 });

  const deadStockItems = getDeadStock(inventory, sales);

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
            sub: canViewProfit ? `${profitMargin.toFixed(1)}% Margin` : undefined
          },
          ...(canViewProfit ? [
            { 
              label: 'Gross Profit', 
              value: formatCurrency(grossProfit), 
              change: null, 
              icon: Target,
              className: "border-green-500/10 text-green-500" 
            },
            { 
              label: 'Net Profit (Take Home)', 
              value: formatCurrency(netProfit), 
              change: null, 
              icon: Wallet,
              className: netProfit < 0 ? "border-red-500/10 text-red-500" : "border-primary/10 text-primary"
            },
          ] : []),
          { label: 'Avg Order Value', value: formatCurrency(avgOrderValue), change: null, icon: Target },
        ].map((stat, idx) => (
          <div key={idx} className={cn("glass-card p-5 rounded-2xl border", stat.className)}>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <stat.icon className="h-4 w-4" />
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
            {stat.sub && <p className="text-[10px] font-black uppercase tracking-widest text-primary mt-1">{stat.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Sales Bar Chart */}
        <div className="lg:col-span-3 glass-card rounded-3xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-base flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {period === 'week' ? 'Daily Sales Performance' : 'Growth Trend'}
            </h3>
            {forecastData.length > 0 && (
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-purple-500/10 text-purple-500 rounded-lg animate-pulse border border-purple-500/20">
                Predictive AI Enabled
              </span>
            )}
          </div>
          {totalRevenue === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground opacity-30">
              <BarChart3 className="h-12 w-12 mb-3" />
              <p className="text-sm font-bold">No sales yet</p>
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={combinedChartData}>
                  <defs>
                    <linearGradient id="anaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(199,89%,48%)" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(199,89%,48%)" stopOpacity={0.5} />
                    </linearGradient>
                    <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a855f7" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#a855f7" stopOpacity={0.05} />
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
                    formatter={(v: any, name: any) => [formatCurrency(Number(v)), name]}
                    cursor={{ fill: 'rgba(14,165,233,0.06)' }}
                  />
                  <Bar dataKey="sales" name="Actual Sales" fill="url(#anaGrad)" radius={[5, 5, 0, 0]} barSize={period === 'week' ? 40 : 15} />
                  <Area dataKey="forecast" name="Forecast" fill="url(#forecastGrad)" stroke="#a855f7" strokeWidth={2} strokeDasharray="5 5" />
                  <Area dataKey="high" name="Confidence Range" fill="#a855f7" fillOpacity={0.1} stroke="none" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Performance Extremes */}
        <div className="lg:col-span-2 glass-card rounded-3xl p-6 flex flex-col gap-8">
          <div>
            <h3 className="font-bold text-base mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Highest Sellers ({period})
            </h3>
            {topProducts.length === 0 ? (
              <div className="h-20 flex items-center justify-center text-muted-foreground opacity-30 text-sm font-bold">
                No sales in this period
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
                        className="h-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)] rounded-full transition-all duration-700"
                        style={{ width: `${(product.revenue / maxRevenue) * 100}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">{product.qty} units sold</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="pt-8 border-t border-border/50">
            <h3 className="font-bold text-base mb-4 flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              Lowest Sellers / Deadweight
            </h3>
            {lowestProducts.length === 0 ? (
              <div className="h-20 flex items-center justify-center text-muted-foreground opacity-30 text-sm font-bold">
                No inventory data
              </div>
            ) : (
              <div className="space-y-4">
                {lowestProducts.map((product, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between opacity-80">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-black text-red-500/50 w-4 shrink-0">#{idx + 1}</span>
                        <span className="text-sm font-semibold truncate">{product.name}</span>
                      </div>
                      <span className="text-[10px] font-black text-red-500 shrink-0 ml-2 px-2 py-0.5 bg-red-500/10 rounded-md">
                        {product.qty === 0 ? 'ZERO SALES' : `${product.qty} SOLD`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
                    formatter={(v: any) => [Number(v), 'Orders']}
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

      {/* DEAD STOCK LIQUIDATOR */}
      <div className="glass-card rounded-3xl p-8 border-amber-500/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-amber-500" />
              Dead Stock Liquidator
            </h3>
            <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Zero sales in the last 30 days — recover your capital now.</p>
          </div>
          {deadStockItems.length > 0 && canViewCost && (
            <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-xl">
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">
                Stuck Capital: {formatCurrency(deadStockItems.reduce((s: number, i: InventoryItem) => {
                  const p = inventoryPrivate.find((pi: any) => pi.id === i.id);
                  return s + (p?.costPrice || 0) * (i.stock || 0);
                }, 0))}
              </p>
            </div>
          )}
        </div>

        {deadStockItems.length === 0 ? (
          <div className="text-center py-10 opacity-30">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500" />
            <p className="text-sm font-bold uppercase tracking-widest">No dead stock detected. Great inventory rotation!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {deadStockItems.slice(0, 6).map((item: InventoryItem) => {
              const privateData = canViewCost ? inventoryPrivate.find((pi: any) => pi.id === item.id) : null;
              const clearancePrice = (privateData?.costPrice || 0) * 1.15; // 15% margin for clearance
              return (
                <div key={item.id} className="p-4 rounded-2xl bg-accent/20 border border-border/50 hover:border-amber-500/30 transition-all group">
                  <div className="flex justify-between items-start mb-3">
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate uppercase tracking-tight">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">{item.category} · {item.size || 'N/A'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-amber-600">{item.stock} units</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mt-4 pt-4 border-t border-border/10">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-60">
                      <span>Cur. Price</span>
                      <span>{formatCurrency(item.price)}</span>
                    </div>
                    {canViewCost && (
                      <div className="flex justify-between items-center p-2 bg-amber-500/10 rounded-xl border border-amber-500/10">
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black text-amber-600 uppercase">Clearance Target</span>
                          <span className="text-xs font-black text-amber-600">{formatCurrency(clearancePrice)}</span>
                        </div>
                        <span className="text-[10px] font-black px-2 py-1 bg-amber-600 text-white rounded-lg animate-pulse">
                          -{(100 - (clearancePrice/item.price)*100).toFixed(0)}% OFF
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
