"use client";

import React, { useState } from "react";
import {
  TrendingUp,
  BarChart3,
  Download,
  Calendar,
  DollarSign,
  PieChart,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from "lucide-react";
import { formatCurrency, formatPercentage } from "@/lib/utils";

export function ReportsAnalytics() {
  const [dateRange, setDateRange] = useState("this_month");
  const [activeReportTab, setActiveReportTab] = useState<"pnl" | "gst" | "inventory" | "products">("pnl");

  // Sample aggregated business metrics
  const financialData = {
    grossRevenue: 486500.0,
    cogs: 342000.0,
    grossProfit: 144500.0,
    grossMargin: 29.7,
    operatingExpenses: 41570.0,
    netProfit: 102930.0,
    netMargin: 21.15,
  };

  const gstData = [
    { slab: "0% (Exempt)", taxable: 45000.0, cgst: 0, sgst: 0, totalTax: 0 },
    { slab: "5% (Essential)", taxable: 180000.0, cgst: 4500, sgst: 4500, totalTax: 9000 },
    { slab: "12% (Standard 1)", taxable: 95000.0, cgst: 5700, sgst: 5700, totalTax: 11400 },
    { slab: "18% (Standard 2)", taxable: 140000.0, cgst: 12600, sgst: 12600, totalTax: 25200 },
    { slab: "28% (Luxury)", taxable: 26500.0, cgst: 3710, sgst: 3710, totalTax: 7420 },
  ];

  const topProducts = [
    { name: "Fortune Premium Sunflower Oil 1L", qty: 240, revenue: 39600, margin: 21.2 },
    { name: "Aashirvaad Superior MP Atta 5kg", qty: 180, revenue: 46800, margin: 15.3 },
    { name: "Amul Butter Pasteurised 500g", qty: 140, revenue: 38500, margin: 10.9 },
    { name: "Cadbury Dairy Milk Silk 150g", qty: 110, revenue: 19250, margin: 20.0 },
    { name: "Dettol Antiseptic Liquid 500ml", qty: 95, revenue: 20425, margin: 13.9 },
  ];

  const handleExportGst = () => {
    const headers = "Tax Slab,Taxable Value,CGST,SGST,Total GST Tax\n";
    const rows = gstData
      .map((g) => `"${g.slab}",${g.taxable},${g.cgst},${g.sgst},${g.totalTax}`)
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `gstr1_summary_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary tracking-tight">
            Financial Analytics & Tax Reports
          </h2>
          <p className="text-xs text-[var(--text-tertiary)]">
            Profit & Loss statements, GSTR-1 summaries, and sales performance intelligence
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 bg-[var(--surface)] border border-[var(--border-soft)] text-xs text-text-primary rounded-xl outline-none"
          >
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month (August 2026)</option>
            <option value="last_month">Last Month</option>
            <option value="ytd">Year to Date (FY 2026-27)</option>
          </select>

          <button
            onClick={handleExportGst}
            className="flex items-center gap-1.5 px-3 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-text-primary text-xs font-semibold rounded-xl shadow-md shadow-blue-500/20"
          >
            <Download className="w-4 h-4" />
            <span>Export GSTR-1 CSV</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border-soft)]">
        <button
          onClick={() => setActiveReportTab("pnl")}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
            activeReportTab === "pnl"
              ? "border-[var(--primary)] text-white"
              : "border-transparent text-[var(--text-tertiary)] hover:text-white"
          }`}
        >
          Profit & Loss Statement
        </button>
        <button
          onClick={() => setActiveReportTab("gst")}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
            activeReportTab === "gst"
              ? "border-[var(--primary)] text-white"
              : "border-transparent text-[var(--text-tertiary)] hover:text-white"
          }`}
        >
          GSTR-1 Tax Breakup
        </button>
        <button
          onClick={() => setActiveReportTab("products")}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
            activeReportTab === "products"
              ? "border-[var(--primary)] text-white"
              : "border-transparent text-[var(--text-tertiary)] hover:text-white"
          }`}
        >
          Top Selling Products
        </button>
      </div>

      {activeReportTab === "pnl" && (
        /* P&L View */
        <div className="space-y-6">
          {/* Executive Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl">
              <div className="text-xs text-[var(--text-tertiary)]">Gross Revenue</div>
              <div className="text-2xl font-black text-text-primary font-mono mt-1">
                {formatCurrency(financialData.grossRevenue)}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-emerald-400 mt-1 font-semibold">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+14.8% vs last month</span>
              </div>
            </div>

            <div className="p-4 bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl">
              <div className="text-xs text-[var(--text-tertiary)]">Gross Margin Profit</div>
              <div className="text-2xl font-black text-blue-400 font-mono mt-1">
                {formatCurrency(financialData.grossProfit)}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-1">
                {formatPercentage(financialData.grossMargin)} gross margin rate
              </div>
            </div>

            <div className="p-4 bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl">
              <div className="text-xs text-[var(--text-tertiary)]">Net Operating Profit</div>
              <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
                {formatCurrency(financialData.netProfit)}
              </div>
              <div className="text-[11px] text-emerald-400 font-semibold mt-1">
                {formatPercentage(financialData.netMargin)} net bottom-line
              </div>
            </div>
          </div>

          {/* Structured P&L Table */}
          <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-xl p-6">
            <h3 className="text-sm font-bold text-text-primary mb-4 pb-2 border-b border-[var(--border-soft)]">
              Income Statement Breakdown (P&L)
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 font-bold text-text-primary">
                <span>Gross Sales Revenue (A)</span>
                <span className="font-mono text-sm">{formatCurrency(financialData.grossRevenue)}</span>
              </div>
              <div className="flex justify-between py-1.5 text-red-400 pl-4 border-t border-[var(--border-soft)]">
                <span>- Cost of Goods Sold (COGS)</span>
                <span className="font-mono">-{formatCurrency(financialData.cogs)}</span>
              </div>
              <div className="flex justify-between py-2 font-bold text-blue-400 pl-2 bg-bg-soft rounded-lg">
                <span>Gross Profit (A - COGS)</span>
                <span className="font-mono">{formatCurrency(financialData.grossProfit)}</span>
              </div>

              <div className="flex justify-between py-1.5 text-red-400 pl-4 border-t border-[var(--border-soft)]">
                <span>- Operating Expenses (Rent, Utilities, Staff, Overheads)</span>
                <span className="font-mono">-{formatCurrency(financialData.operatingExpenses)}</span>
              </div>

              <div className="flex justify-between py-3 font-black text-base text-emerald-400 pl-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mt-4">
                <span>NET STORE PROFIT</span>
                <span className="font-mono">{formatCurrency(financialData.netProfit)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeReportTab === "gst" && (
        /* GSTR-1 View */
        <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-[var(--border-soft)] bg-[var(--bg-soft)] flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-white">GSTR-1 Outward Supplies Summary</h3>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                Taxable turnover and CGST/SGST/IGST liability categorized by tax rate
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--bg-soft)] border-b border-[var(--border-soft)] text-[var(--text-tertiary)] font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">GST Slab</th>
                  <th className="py-3 px-4 text-right">Taxable Turnover</th>
                  <th className="py-3 px-4 text-right">CGST</th>
                  <th className="py-3 px-4 text-right">SGST</th>
                  <th className="py-3 px-4 text-right">Total Tax Liability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {gstData.map((g) => (
                  <tr key={g.slab} className="hover:bg-bg-base">
                    <td className="py-3 px-4 font-semibold text-text-primary">{g.slab}</td>
                    <td className="py-3 px-4 text-right font-mono text-white">
                      {formatCurrency(g.taxable)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[var(--text-secondary)]">
                      {formatCurrency(g.cgst)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[var(--text-secondary)]">
                      {formatCurrency(g.sgst)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-blue-400">
                      {formatCurrency(g.totalTax)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-bg-soft font-bold text-text-primary border-t border-[var(--border-soft)]">
                  <td className="py-3 px-4">TOTALS</td>
                  <td className="py-3 px-4 text-right font-mono">
                    {formatCurrency(gstData.reduce((s, g) => s + g.taxable, 0))}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {formatCurrency(gstData.reduce((s, g) => s + g.cgst, 0))}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {formatCurrency(gstData.reduce((s, g) => s + g.sgst, 0))}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-blue-400">
                    {formatCurrency(gstData.reduce((s, g) => s + g.totalTax, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {activeReportTab === "products" && (
        /* Top Products View */
        <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--bg-soft)] border-b border-[var(--border-soft)] text-[var(--text-tertiary)] font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4 text-center">Units Sold</th>
                  <th className="py-3 px-4 text-right">Revenue Contributed</th>
                  <th className="py-3 px-4 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {topProducts.map((p, idx) => (
                  <tr key={p.name} className="hover:bg-bg-base">
                    <td className="py-3 px-4 font-semibold text-text-primary">
                      <span className="text-[var(--text-tertiary)] font-mono mr-2">#{idx + 1}</span>
                      {p.name}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-text-primary">
                      {p.qty}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      {formatCurrency(p.revenue)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-blue-300">
                      {formatPercentage(p.margin)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
