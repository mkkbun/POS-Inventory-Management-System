/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import useAppStore from './store.ts';

// Import all tabs views
import DashboardView from './components/DashboardView.tsx';
import POSScreen from './components/POSScreen.tsx';
import ProductsView from './components/ProductsView.tsx';
import CategoriesView from './components/CategoriesView.tsx';
import InventoryView from './components/InventoryView.tsx';
import OrdersHistoryView from './components/OrdersHistoryView.tsx';
import CustomersView from './components/CustomersView.tsx';
import SuppliersView from './components/SuppliersView.tsx';
import ReportsView from './components/ReportsView.tsx';
import SettingsView from './components/SettingsView.tsx';

// Icons
import {
  LayoutDashboard, ShoppingCart, Package, FolderClosed, Archive,
  FileClock, Users, Truck, BarChart3, Settings, LogOut, Store,
  ShieldCheck, AlertTriangle, Key
} from 'lucide-react';

export default function App() {
  const {
    token,
    user,
    setAuth,
    logout,
    selectedBranchId,
    setSelectedBranchId
  } = useAppStore();

  const [activeTab, setActiveTab] = useState('Dashboard');
  const [branches, setBranches] = useState<any[]>([]);

  // Login Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // SSE Event Stream states
  const [sseMessage, setSseMessage] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      // Load active branches for upper dropdown selectors
      const fetchBranches = async () => {
        try {
          const res = await fetch('/api/settings/branches', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) setBranches(await res.json());
        } catch (e) {
          console.error(e);
        }
      };
      
      fetchBranches();

      // Establish Server-Sent Events real-time event subscription loop
      const sse = new EventSource('/api/events');
      
      sse.addEventListener('stock:updated', (e: any) => {
        const item = JSON.parse(e.data);
        console.log('Realtime SSE received: stock updated', item);
      });

      sse.addEventListener('order:created', (e: any) => {
        const data = JSON.parse(e.data);
        setSseMessage(`🔔 Order Processed: ${data.orderNumber} for £${data.totalAmount} by ${data.cashierName}!`);
        setTimeout(() => setSseMessage(null), 4500);
      });

      sse.addEventListener('alert:lowstock', (e: any) => {
        const item = JSON.parse(e.data);
        setSseMessage(`⚠️ Stock Alert: "${item.name}" fell below minimum alert. Remaining: ${item.stock}!`);
        setTimeout(() => setSseMessage(null), 5500);
      });

      return () => {
        sse.close();
      };
    }
  }, [token]);

  // Handle Sign In submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication rejected by security gate.');
      }

      setAuth(data.token, data.user);
    } catch (err: any) {
      setLoginError(err.message || 'Network lookup error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick prepopulate helper for easy demos
  const handlePrefillLogin = (demoRole: 'Admin' | 'Manager' | 'Cashier') => {
    const defaultEmail = demoRole === 'Admin' ? 'admin@pos.com' : demoRole === 'Manager' ? 'manager@pos.com' : 'cashier@pos.com';
    const defaultPass = demoRole === 'Admin' ? 'admin123' : demoRole === 'Manager' ? 'manager123' : 'cashier123';
    setEmail(defaultEmail);
    setPassword(defaultPass);
  };

  // Guard: If not signed in, show visual Login canvas
  if (!token || !user) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
        
        {/* Soft backdrop gradients */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-x-20 -translate-y-20 pointer-events-none"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl translate-x-12 translate-y-12 pointer-events-none"></div>

        <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-6 relative z-10 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-indigo-600/25 border border-indigo-500/40 text-indigo-400 rounded-xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/10">
              <Store className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-sans font-bold tracking-tight text-white uppercase">Apex POS & Inventory</h1>
            <p className="text-[11px] text-slate-500 font-mono">Secured Retail Operations Gateway</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-[10px] text-slate-400 font-mono block mb-1">E-mail address:</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@apexretail.com"
                className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-100 rounded-xl p-3 focus:outline-hidden focus:border-indigo-500 font-mono"
              />
            </div>
            
            <div>
              <label className="text-[10px] text-slate-400 font-mono block mb-1">Authorization passcode:</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-100 rounded-xl p-3 focus:outline-hidden focus:border-indigo-500 font-mono"
              />
            </div>

            {loginError && (
              <p className="text-[11px] text-rose-500 font-mono bg-rose-500/10 border border-rose-500/20 p-2 text-center rounded-lg">{loginError}</p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-mono font-bold rounded-xl disabled:opacity-50 transition cursor-pointer shadow-lg shadow-indigo-650/20"
            >
              {isSubmitting ? 'Authenticating...' : 'Sign In Terminal'}
            </button>
          </form>

          {/* Quick Demo Pre-fill tools */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="text-[9px] text-slate-500 font-mono uppercase tracking-widest block text-center">Fast Demo Prefills:</span>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => handlePrefillLogin('Admin')}
                className="py-1 px-2 border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-[10px] text-slate-300 font-mono rounded-lg transition text-center cursor-pointer"
              >
                Admin
              </button>
              <button
                onClick={() => handlePrefillLogin('Manager')}
                className="py-1 px-2 border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-[10px] text-slate-300 font-mono rounded-lg transition text-center cursor-pointer"
              >
                Manager
              </button>
              <button
                onClick={() => handlePrefillLogin('Cashier')}
                className="py-1 px-2 border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-[10px] text-slate-300 font-mono rounded-lg transition text-center cursor-pointer"
              >
                Cashier
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Define sidebar links based on authorization roles
  const allowedTabs: { name: string; icon: React.ReactNode }[] = [
    { name: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { name: 'Point of Sale', icon: <ShoppingCart className="w-4 h-4" /> },
    { name: 'Products', icon: <Package className="w-4 h-4" /> },
    { name: 'Categories', icon: <FolderClosed className="w-4 h-4" /> },
    { name: 'Inventory', icon: <Archive className="w-4 h-4" /> },
    { name: 'Orders Archiv', icon: <FileClock className="w-4 h-4" /> },
    { name: 'Customers CRM', icon: <Users className="w-4 h-4" /> },
    { name: 'Suppliers & PO', icon: <Truck className="w-4 h-4" /> },
    { name: 'Reports', icon: <BarChart3 className="w-4 h-4" /> },
    { name: 'Settings', icon: <Settings className="w-4 h-4" /> }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row select-none">
      
      {/* SIDEBAR NAVIGATION PANEL */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col justify-between border-r border-slate-800 h-auto md:h-screen md:sticky md:top-0">
        <div className="p-0 flex flex-col">
          {/* Brand/HQ Badge */}
          <div className="p-6 flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded flex items-center justify-center text-white">
              <Store className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight">ApexPOS Pro</h1>
          </div>

          <nav className="px-4 space-y-1">
            {allowedTabs.map(item => {
              const tabId = item.name === 'Orders Archiv' ? 'Orders' : item.name === 'Suppliers & PO' ? 'Suppliers' : item.name;
              const isActive = activeTab === tabId;
              return (
                <button
                  key={item.name}
                  onClick={() => setActiveTab(tabId)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all text-sm font-medium cursor-pointer select-none ${
                    isActive 
                      ? 'bg-slate-800 text-white font-bold' 
                      : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className={`${isActive ? 'text-white' : 'text-slate-500'}`}>{item.icon}</span>
                  {item.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User profile / System Status footer */}
        <div className="p-4 border-t border-slate-800 mt-auto">
          <div className="flex items-center gap-3 mb-4 select-none">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] uppercase tracking-widest text-slate-550 font-bold">System Status: Live</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs select-none shadow-sm">
                {user.name ? user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'OP'}
              </div>
              <div className="truncate max-w-[105px]">
                <p className="font-medium text-slate-200 leading-tight truncate">{user.name}</p>
                <p className="opacity-70 text-[10px] leading-tight mt-0.5 truncate">{user.role}</p>
              </div>
            </div>

            <button
              onClick={logout}
              title="Log out session"
              className="p-1.5 hover:bg-slate-805 text-slate-500 hover:text-rose-400 rounded-md transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* CORE WORKSPACE CONTENT PANEL */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* UPPER CONCISE MONITOR BAR */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-slate-800 tracking-tight">
              {activeTab === 'Orders' 
                ? 'Orders Archive' 
                : activeTab === 'Suppliers' 
                  ? 'Suppliers & PO' 
                  : activeTab === 'Customers' 
                    ? 'Customers CRM' 
                    : activeTab}
            </h2>
            <div className="h-6 w-[1px] bg-slate-200"></div>
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full select-none">
              <Store className="w-3.5 h-3.5 text-slate-500" />
              {user.role === 'Admin' || user.role === 'Manager' ? (
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="bg-transparent select-none text-slate-600 font-sans font-medium text-xs focus:outline-hidden border-0 p-0 pr-1 cursor-pointer"
                >
                  <option value="ALL">Consolidated Branch (All Warehouses)</option>
                  {branches.map(br => (
                    <option key={br.id} value={br.id}>{br.name}</option>
                  ))}
                </select>
              ) : (
                <span className="text-xs font-sans font-semibold text-slate-600">
                  {user.branchId === 'b1' ? 'London Flagship HQ' : 'Manchester Northern'}
                </span>
              )}
            </div>
          </div>

          {/* User status & Notifications */}
          <div className="flex items-center gap-6">
            <div className="relative cursor-pointer select-none">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white rounded-full text-[10px] text-white flex items-center justify-center font-bold">3</span>
            </div>
            
            <span className="hidden sm:flex items-center gap-1.5 font-mono text-[10px] uppercase font-bold text-slate-400 select-none">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              Operator Stream Live
            </span>
          </div>
        </header>

        {/* Global Real-Time SSE Alert popup toast */}
        {sseMessage && (
          <div className="fixed top-20 right-4 bg-slate-950/95 text-white p-3.5 rounded-xl border border-indigo-550/35 shadow-2xl z-50 animate-in slide-in-from-top-6 flex items-center gap-2 font-mono text-[11px] leading-snug">
            <span>{sseMessage}</span>
          </div>
        )}

        {/* Active view layout routing */}
        <main className="flex-1 p-8 overflow-y-auto">
          {activeTab === 'Dashboard' && <DashboardView onNavigate={(tab) => setActiveTab(tab)} />}
          {activeTab === 'Point of Sale' && <POSScreen />}
          {activeTab === 'Products' && <ProductsView />}
          {activeTab === 'Categories' && <CategoriesView />}
          {activeTab === 'Inventory' && <InventoryView />}
          {activeTab === 'Orders' && <OrdersHistoryView />}
          {activeTab === 'Customers' && <CustomersView />}
          {activeTab === 'Suppliers' && <SuppliersView />}
          {activeTab === 'Reports' && <ReportsView />}
          {activeTab === 'Settings' && <SettingsView />}
        </main>

        {/* Footer Info */}
        <footer className="h-10 bg-white border-t border-slate-200 px-8 flex items-center justify-between text-[10px] text-slate-400 font-medium select-none">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span>
              v2.4.1 Production Build
            </span>
            <span>Server Latency: 12ms</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="hidden md:inline">Syncing Data to Centralized Hub...</span>
            <span className="text-slate-500 font-bold uppercase tracking-widest">© 2026 ApexSystems Enterprise</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
