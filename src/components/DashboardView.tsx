/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store.ts';
import { ShoppingBag, TrendingUp, AlertTriangle, FileText, ArrowRight, RefreshCw, BarChart3 } from 'lucide-react';

interface Stats {
  todaySales: number;
  todayTransactionsCount: number;
  todayRevenue: number;
  lowStockCount: number;
  lowStockAlerts: { productId: string; name: string; sku: string; stock: number; threshold: number }[];
  topSelling: { quantity: number; amount: number; name: string }[];
  recentOrders: any[];
}

export default function DashboardView({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { token, selectedBranchId } = useAppStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const branchParam = selectedBranchId === 'ALL' ? 'ALL' : selectedBranchId;
      const res = await fetch(`/api/dashboard/stats?branchId=${branchParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load dashboard statistics.');
      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchStats();
    }
  }, [token, selectedBranchId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="text-slate-500 font-mono text-sm">Aggregating real-time retail statistics...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center max-w-lg mx-auto my-12">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-red-900 font-sans">Dashboard Sync Failed</h3>
        <p className="text-sm text-red-600 mt-2 font-sans">{error || 'Could not reconcile database indices.'}</p>
        <button onClick={fetchStats} className="mt-4 px-4 py-2 bg-red-600 text-white text-xs font-mono rounded-lg hover:bg-red-700 transition">
          Retry Aggregation
        </button>
      </div>
    );
  }

  // Calculate gross margins
  const marginPercentage = stats.todaySales > 0 ? (stats.todayRevenue / stats.todaySales) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Upper Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-sans font-semibold tracking-tight text-slate-900">Retail Command Hub</h2>
          <p className="text-slate-500 text-xs font-mono">Real-time status metrics and terminal logs</p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-md text-xs font-bold shadow-xs transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Synchronize Store
        </button>
      </div>

      {/* Grid Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className="bg-white border border-slate-200 rounded-md p-5 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Gross Sales Today</p>
            <h3 className="text-2xl font-bold text-slate-900">£{stats.todaySales.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</h3>
            <p className="text-xs text-emerald-600 font-bold mt-2 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Today's total gross sales
            </p>
          </div>
          <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-md">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        {/* Profit margins */}
        <div className="bg-white border border-slate-200 rounded-md p-5 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Gross Margins</p>
            <h3 className="text-2xl font-bold text-slate-900">£{stats.todayRevenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</h3>
            <p className="text-xs text-indigo-600 font-bold mt-2">
              Margin efficiency: {marginPercentage.toFixed(1)}%
            </p>
          </div>
          <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-md">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Transactions volume */}
        <div className="bg-white border border-slate-200 rounded-md p-5 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Transactions</p>
            <h3 className="text-2xl font-bold text-slate-900">{stats.todayTransactionsCount}</h3>
            <p className="text-xs text-slate-500 font-medium mt-2">
              AVG basket size: £{stats.todayTransactionsCount > 0 ? (stats.todaySales / stats.todayTransactionsCount).toFixed(2) : '0.00'}
            </p>
          </div>
          <div className="bg-amber-50 text-amber-600 p-2.5 rounded-md">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        {/* Low stocks warnings */}
        <div className={`bg-white border border-slate-200 rounded-md p-5 shadow-sm flex items-start justify-between ${stats.lowStockCount > 0 ? 'ring-2 ring-red-50 border-red-200' : ''}`}>
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Inventory Alerts</p>
            <h3 className={`text-2xl font-bold ${stats.lowStockCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>{stats.lowStockCount} Items</h3>
            <p className={`text-xs font-bold mt-2 ${stats.lowStockCount > 0 ? 'text-red-500' : 'text-slate-500'}`}>
              Urgent restocking required
            </p>
          </div>
          <div className={`p-2.5 rounded-md ${stats.lowStockCount > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>
      {/* Main split sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Low stock warnings list & Top Sellers Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Top Selling Chart Panel */}
          <div className="bg-white border border-slate-200 rounded-md p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-sans font-semibold text-slate-900">Top 5 Selling Products (Quantity)</h3>
            </div>
            
            {stats.topSelling.length === 0 ? (
              <div className="h-48 border border-dashed border-slate-150 rounded-md flex items-center justify-center text-slate-400 font-mono text-xs">
                No checkout items processed yet today.
              </div>
            ) : (
              <div className="space-y-4 py-2">
                {stats.topSelling.map((p, idx) => {
                  const maxQty = Math.max(...stats.topSelling.map(it => it.quantity)) || 1;
                  const percent = (p.quantity / maxQty) * 100;
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-sans">
                        <span className="font-medium text-slate-700 truncate max-w-xs">{p.name}</span>
                        <span className="font-mono text-slate-500">{p.quantity} sold (£{p.amount.toFixed(2)})</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          style={{ width: `${percent}%` }}
                          className="bg-indigo-500 h-full transition-all duration-500"
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Orders Tracker */}
          <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-sm font-sans font-semibold text-slate-900">Recent Transactions Feed</h3>
              <button 
                onClick={() => onNavigate('Orders')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-850 flex items-center gap-1 transition cursor-pointer"
              >
                All Orders <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="overflow-x-auto">
              {stats.recentOrders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-mono text-xs">
                  Zero recent transactions recorded.
                </div>
              ) : (
                <table className="w-full text-left text-xs text-slate-600">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold tracking-wider border-b border-slate-100">
                      <th className="px-5 py-3">Order Ref</th>
                      <th className="px-5 py-3">Cashier</th>
                      <th className="px-5 py-3">Customer</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.recentOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{ord.orderNumber}</td>
                        <td className="px-5 py-3.5 font-medium text-slate-700 truncate max-w-[120px]">{ord.cashierName}</td>
                        <td className="px-5 py-3.5 font-medium text-slate-700 truncate max-w-[140px]">{ord.customerName}</td>
                        <td className="px-5 py-3.5 font-bold text-slate-900">£{ord.totalAmount.toFixed(2)}</td>
                        <td className="px-5 py-3.5 text-slate-400 font-mono">{new Date(ord.createdAt).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Low stock warnings sidebars */}
        <div className="bg-white border border-slate-200 rounded-md p-5 shadow-sm h-fit space-y-4">
          <div>
            <h3 className="text-sm font-sans font-semibold text-slate-900">Threshold Stock Alarms</h3>
            <p className="text-[11px] text-slate-400 font-mono">Below low-stock limits markers</p>
          </div>

          {stats.lowStockAlerts.length === 0 ? (
            <div className="border border-dashed border-emerald-100 bg-emerald-50/20 text-emerald-800 text-xs font-mono p-4 rounded-md text-center">
              ✓ All inventory lines within safe thresholds!
            </div>
          ) : (
            <div className="space-y-3.5">
              {stats.lowStockAlerts.map((alt) => (
                <div key={alt.productId} className="flex items-center gap-3 p-2 bg-red-50/60 border border-red-100 rounded-md">
                  <div className="w-8 h-8 rounded bg-white flex items-center justify-center font-bold text-red-600 text-xs shadow-sm select-none">
                    {alt.stock}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{alt.name}</p>
                    <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider">{alt.sku} • Limit {alt.threshold}</p>
                  </div>
                </div>
              ))}
              <button 
                onClick={() => onNavigate('Inventory')}
                className="w-full text-center py-2 border border-slate-100 hover:border-slate-250 hover:bg-slate-50/50 rounded-md text-slate-600 font-bold text-xs transition block mt-2 cursor-pointer"
              >
                Go to Inventory Logs
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
