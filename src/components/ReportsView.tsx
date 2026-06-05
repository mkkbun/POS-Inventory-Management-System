/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store.ts';
import { RefreshCw, Clipboard, Brain, AlertTriangle, TrendingUp, Sparkles } from 'lucide-react';

interface ReportStats {
  grossSales: number;
  cogs: number;
  grossProfit: number;
  netProfit: number;
  transactionsCount: number;
  inventoryValuationCost: number;
  revenueValuationRetail: number;
  dailyVolumeChart: { date: string; amount: number }[];
}

export default function ReportsView() {
  const { token, selectedBranchId } = useAppStore();
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Gemini AI Insights States
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reports/analytics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const generateAIOperationalBriefing = async () => {
    setLoadingAi(true);
    setAiInsights(null);
    try {
      const res = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const d = await res.json();
        setAiInsights(d.insights);
      } else {
        setAiInsights('### Service Disrupted\n\n*   Unable to coordinate secure link with the external analytics network. Please check your credentials config.');
      }
    } catch (e) {
      setAiInsights('### Offline Event\n\n*   Connection dropped. Unable to synthesize AI recommendations at this moment.');
    } finally {
      setLoadingAi(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchReports();
    }
  }, [token, selectedBranchId]);

  if (loading || !stats) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Margin ratios
  const profitMarginPercent = stats.grossSales > 0 ? (stats.grossProfit / stats.grossSales) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-sans font-semibold text-slate-900 tracking-tight">Financial & Retail Intelligence</h2>
          <p className="text-slate-505 text-xs font-mono">Profit and loss summaries, stock valuations, and machine-synthesized briefings</p>
        </div>
        <button
          onClick={fetchReports}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-205 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-mono transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Re-audit Ledgers
        </button>
      </div>

      {/* Financial ledger indices cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border p-5 rounded-xl shadow-3xs">
          <span className="text-slate-400 font-mono text-[10px] uppercase font-bold tracking-wider">Gross Sales Capital</span>
          <div className="text-xl font-sans font-extrabold text-slate-900 font-mono mt-1">£{stats.grossSales.toFixed(2)}</div>
          <span className="text-[9px] text-slate-405 block mt-2 font-mono">From {stats.transactionsCount} finalized sales</span>
        </div>

        <div className="bg-white border p-5 rounded-xl shadow-3xs">
          <span className="text-slate-400 font-mono text-[10px] uppercase font-bold tracking-wider">Cost of Goods Sold (COGS)</span>
          <div className="text-xl font-sans font-extrabold text-slate-900 font-mono mt-1">£{stats.cogs.toFixed(2)}</div>
          <span className="text-[9px] text-rose-600 block mt-2 font-mono">Total product wholesale cost</span>
        </div>

        <div className="bg-white border p-5 rounded-xl shadow-3xs">
          <span className="text-slate-400 font-mono text-[10px] uppercase font-bold tracking-wider">Gross P&L Profits</span>
          <div className="text-xl font-sans font-extrabold text-emerald-700 font-mono mt-1">£{stats.grossProfit.toFixed(2)}</div>
          <span className="text-[9px] text-indigo-600 block mt-2 font-mono">Overall profit margin: {profitMarginPercent.toFixed(1)}%</span>
        </div>

        <div className="bg-white border p-5 rounded-xl shadow-3xs">
          <span className="text-slate-400 font-mono text-[10px] uppercase font-bold tracking-wider">Corporate Net Estimate</span>
          <div className="text-xl font-sans font-extrabold text-indigo-700 font-mono mt-1">£{stats.netProfit.toFixed(2)}</div>
          <span className="text-[9px] text-slate-405 block mt-2 font-mono">Factoring general business overheads</span>
        </div>
      </div>

      {/* Valuation and SVG Sales trend graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sales charts via Inline SVG */}
        <div className="lg:col-span-2 bg-white border border-slate-200 p-5 rounded-xl shadow-2xs space-y-4">
          <h3 className="text-sm font-sans font-bold text-slate-900">Historical Retail Performance Volume</h3>
          
          {stats.dailyVolumeChart.length === 0 ? (
            <div className="h-48 border border-dashed rounded-xl flex items-center justify-center text-slate-400 font-mono text-xs">
              Waiting for order trends datasets to build...
            </div>
          ) : (
            <div className="pt-2">
              {/* Simple elegant CSS bar representation chart */}
              <div className="flex gap-4 items-end h-40 border-b border-slate-200 pb-2">
                {stats.dailyVolumeChart.map((d, index) => {
                  const maxAmount = Math.max(...stats.dailyVolumeChart.map(it => it.amount)) || 1;
                  const ratioHeight = (d.amount / maxAmount) * 100;
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group cursor-pointer">
                      <div className="text-[9px] font-mono font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity leading-none">
                        £{d.amount.toFixed(0)}
                      </div>
                      <div
                        style={{ height: `${Math.max(4, ratioHeight)}%` }}
                        className="w-full bg-indigo-550 group-hover:bg-indigo-700 rounded-t-sm transition-all duration-300 pointer-events-none"
                      ></div>
                      <span className="text-[9px] font-mono text-slate-400 mt-2 truncate max-w-[45px]">
                        {d.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Inventory Holdings valuations totals */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-2xs space-y-4 h-fit">
          <div>
            <h3 className="text-sm font-sans font-bold text-slate-900 leading-tight">Asset Stock valuation</h3>
            <p className="text-[11px] text-slate-400 font-mono">Capital tied inside physical inventories</p>
          </div>

          <div className="space-y-3 font-sans text-xs pt-1">
            <div className="flex justify-between border-b pb-2">
              <span className="text-slate-500">Total Asset Cost base:</span>
              <span className="font-mono font-bold text-slate-900">£{stats.inventoryValuationCost.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-slate-550">Potential Retail Yield:</span>
              <span className="font-mono font-extrabold text-emerald-700">£{stats.revenueValuationRetail.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-[11px] font-mono text-slate-400 pt-1">
              <span>Unrealized margins profit:</span>
              <span className="font-bold text-indigo-600">£{(stats.revenueValuationRetail - stats.inventoryValuationCost).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* GEMINI OPERATIONAL BRIEFINGS PROMPTER CONTAINER */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-indigo-900/40 space-y-4 relative overflow-hidden">
        
        {/* Visual elements */}
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-505/30 animate-pulse">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-sans font-bold tracking-tight text-white flex items-center gap-1.5">
                AI Operations Copilot
              </h3>
              <p className="text-[11px] text-indigo-200 font-mono">Synthesize strategic retail recommendations powered by Gemini</p>
            </div>
          </div>

          <button
            onClick={generateAIOperationalBriefing}
            disabled={loadingAi}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-500 rounded-xl px-4 py-2 text-xs font-mono font-bold font-medium hover:scale-102 transition duration-200 disabled:opacity-50 cursor-pointer shadow-lg"
          >
            <Brain className="w-4 h-4" />
            {loadingAi ? 'Modeling metrics...' : 'Squeeze Strategic Brief'}
          </button>
        </div>

        {/* Insights display container */}
        {aiInsights && (
          <div className="bg-slate-950/70 border border-indigo-950/80 p-5 rounded-xl text-xs leading-relaxed space-y-3 font-sans text-slate-100 animate-in fade-in duration-300">
            {/* Render with simple elegant styling */}
            <div className="markdown-body text-slate-200 space-y-2">
              {aiInsights.split('\n').map((line, idx) => {
                if (line.startsWith('###')) {
                  return <h4 key={idx} className="text-xs font-sans font-bold text-white pt-2 uppercase tracking-wide border-b border-indigo-900/30 pb-1">{line.replace('###', '').trim()}</h4>;
                } else if (line.startsWith('*') || line.startsWith('-')) {
                  return (
                    <div key={idx} className="flex gap-2 items-start pl-1 text-slate-300">
                      <span className="text-indigo-400 font-bold">•</span>
                      <span>{line.substring(2)}</span>
                    </div>
                  );
                }
                return <p key={idx} className="text-[11px]">{line}</p>;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
