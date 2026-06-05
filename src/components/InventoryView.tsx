/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store.ts';
import { AlertTriangle, ArrowRightLeft, History, Edit, Inbox, Info } from 'lucide-react';

export default function InventoryView() {
  const { token, selectedBranchId } = useAppStore();
  
  // Tab states
  const [activeTab, setActiveTab ] = useState<'list' | 'transfer' | 'movements'>('list');

  // Metadata loaders
  const [branches, setBranches] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [movementsList, setMovementsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Stock adjustments trigger states
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [adjustBranchId, setAdjustBranchId] = useState('');
  const [qtyChange, setQtyChange] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  // Stock Transfer states
  const [transferProdId, setTransferProdId] = useState('');
  const [transferFromBranch, setTransferFromBranch] = useState('');
  const [transferToBranch, setTransferToBranch] = useState('');
  const [transferQty, setTransferQty] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  // Load baseline inventory details
  const loadInventoryDataset = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [resB, resP, resI, resM] = await Promise.all([
        fetch('/api/settings/branches', { headers }),
        fetch('/api/products', { headers }),
        fetch('/api/inventory/status', { headers }),
        fetch('/api/inventory/movements', { headers })
      ]);
      if (resB.ok) setBranches(await resB.json());
      if (resP.ok) setProducts(await resP.json());
      if (resI.ok) setInventory(await resI.json());
      if (resM.ok) setMovementsList(await resM.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadInventoryDataset();
    }
  }, [token, selectedBranchId]);

  // Handle Adjustment Submit
  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !adjustBranchId || !qtyChange || !adjustReason) {
      alert('Provide all adjustment variables.');
      return;
    }

    try {
      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          productId: selectedProduct.id,
          branchId: adjustBranchId,
          quantityChange: parseInt(qtyChange),
          reason: adjustReason
        })
      });

      if (res.ok) {
        setAdjustOpen(false);
        setQtyChange('');
        setAdjustReason('');
        loadInventoryDataset();
      } else {
        const d = await res.json();
        alert(d.error || 'Adjustment failed.');
      }
    } catch (e) {
      alert('Adjustment network connection error.');
    }
  };

  // Handle Transfer Submit
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferProdId || !transferFromBranch || !transferToBranch || !transferQty) {
      alert('Provide all transfer metrics.');
      return;
    }
    if (transferFromBranch === transferToBranch) {
      alert('Source and target branches cannot be identical.');
      return;
    }

    setIsTransferring(true);
    try {
      const res = await fetch('/api/inventory/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          productId: transferProdId,
          fromBranchId: transferFromBranch,
          toBranchId: transferToBranch,
          quantity: parseInt(transferQty)
        })
      });

      const data = await res.json();
      if (res.ok) {
        setTransferQty('');
        setTransferProdId('');
        alert('Stock units transferred successfully across catalog registers!');
        loadInventoryDataset();
      } else {
        alert(data.error || 'Transfer failed.');
      }
    } catch (e) {
      alert('Disconnection event.');
    } finally {
      setIsTransferring(false);
    }
  };

  // Filter inventory
  const filteredInventory = inventory.filter(item => {
    const isAll = selectedBranchId === 'ALL';
    const matchBranch = isAll || item.branchId === selectedBranchId;
    const matchSearch = item.productName.toLowerCase().includes(searchQuery.toLowerCase()) || item.sku.toLowerCase().includes(searchQuery.toLowerCase()) || item.barcode.includes(searchQuery);
    return matchBranch && matchSearch;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-sans font-semibold text-slate-900 tracking-tight">Inventory Ledger</h2>
          <p className="text-slate-500 text-xs font-mono">Real-time counts, multi-branch balancing and historical cargo transfers</p>
        </div>
        
        {/* Tab Selection */}
        <div className="flex border border-slate-200 bg-white rounded-lg p-1 text-xs font-mono">
          <button
            onClick={() => setActiveTab('list')}
            className={`p-1.5 px-3 rounded-md transition cursor-pointer ${activeTab === 'list' ? 'bg-indigo-650 text-white font-bold' : 'text-slate-600 hover:text-indigo-600'}`}
          >
            Stock Counts
          </button>
          <button
            onClick={() => setActiveTab('transfer')}
            className={`p-1.5 px-3 rounded-md transition cursor-pointer ${activeTab === 'transfer' ? 'bg-indigo-650 text-white font-bold' : 'text-slate-600 hover:text-indigo-600'}`}
          >
            Branch Transfers
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`p-1.5 px-3 rounded-md transition cursor-pointer ${activeTab === 'movements' ? 'bg-indigo-650 text-white font-bold' : 'text-slate-600 hover:text-indigo-600'}`}
          >
            Movement auditing
          </button>
        </div>
      </div>

      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* Quick search */}
          <div className="bg-white p-4 border border-slate-200 rounded-xl">
            <input
              type="text"
              placeholder="Search product stocks list..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 pl-3 pr-4 py-2 rounded-lg text-xs font-sans"
            />
          </div>

          {/* Counts spreadsheet list */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs text-slate-700">
              <thead>
                <tr className="bg-slate-50/70 text-slate-500 uppercase font-mono border-b border-slate-200 tracking-wider">
                  <th className="px-5 py-3">Catalog Item</th>
                  <th className="px-5 py-3">SKU</th>
                  <th className="px-5 py-3">Wholesale Branch</th>
                  <th className="px-5 py-3 text-right">Remaining Stock</th>
                  <th className="px-5 py-3 text-right">Adjustment Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredInventory.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/20">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-800">{item.productName}</div>
                      <span className="text-[10px] text-slate-400 font-mono">{item.barcode}</span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-600 uppercase">{item.sku}</td>
                    <td className="px-5 py-3.5 text-slate-505 font-medium">{item.branchName}</td>
                    <td className="px-5 py-3.5 text-right font-mono font-extrabold">
                      <span className={`px-2 py-0.5 rounded-full ${item.isLowStock ? 'bg-rose-105 text-rose-800 animate-pulse font-bold' : 'text-slate-900'}`}>
                        {item.stockQuantity} units
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => { setSelectedProduct(item); setAdjustBranchId(item.branchId); setAdjustOpen(true); }}
                        className="py-1 px-2 border border-slate-200 hover:border-indigo-400 rounded-lg text-slate-600 font-mono text-[10px] uppercase font-bold transition cursor-pointer"
                      >
                        Adjust
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'transfer' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 h-fit space-y-4 shadow-2xs">
            <div>
              <h3 className="text-sm font-sans font-bold text-slate-900">Branch Cargo Dispatch</h3>
              <p className="text-[11px] text-slate-400 font-mono">Initiate multi-branch stock transfers</p>
            </div>

            <form onSubmit={handleTransfer} className="space-y-3.5 text-xs font-sans">
              <div>
                <label className="text-slate-500 block mb-1">Dispatching Product *</label>
                <select
                  required
                  value={transferProdId}
                  onChange={(e) => setTransferProdId(e.target.value)}
                  className="w-full border border-slate-200 p-2 select-none text-slate-700 bg-slate-50 rounded-lg"
                >
                  <option value="">Select Product</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-405 block mb-1">Source Branch *</label>
                  <select
                    required
                    value={transferFromBranch}
                    onChange={(e) => setTransferFromBranch(e.target.value)}
                    className="w-full border border-slate-200 select-none text-slate-700 bg-slate-50 p-2 rounded-lg"
                  >
                    <option value="">Select From</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-405 block mb-1">Destination *</label>
                  <select
                    required
                    value={transferToBranch}
                    onChange={(e) => setTransferToBranch(e.target.value)}
                    className="w-full border border-slate-200 select-none text-slate-700 bg-slate-50 p-2 rounded-lg"
                  >
                    <option value="">Select Target</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-500 block mb-1 font-mono">Units Transfer Quantity *</label>
                <input
                  type="number"
                  required
                  value={transferQty}
                  onChange={(e) => setTransferQty(e.target.value)}
                  placeholder="e.g. 15"
                  className="w-full border border-slate-200 p-2 rounded-lg bg-slate-50 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={isTransferring}
                className="w-full py-2 bg-indigo-650 hover:bg-indigo-750 font-mono text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                {isTransferring ? 'Deploying...' : 'Deploy Inventory Units'}
              </button>
            </form>
          </div>

          {/* Transfers Info panel */}
          <div className="lg:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-5 text-slate-600 text-xs leading-relaxed space-y-4 font-sans shadow-2xs">
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-indigo-600" />
              <h4 className="font-semibold text-slate-800">Operational Transfer Safeguards</h4>
            </div>
            <p>Every dispatch triggers dual entries in our <strong>Movement ledger</strong>. It checks real-time counts at origin before subtracting quantities, ensuring that branch balances never fall into negative indices.</p>
            <div className="border-t border-slate-200 pt-3">
              <span className="font-mono text-[10px] uppercase tracking-wider block font-bold text-slate-405 mb-1">Active Branches Codes:</span>
              <ul className="space-y-1 font-mono text-[10px]">
                {branches.map(b => (
                  <li key={b.id}>• {b.name} — <code className="bg-white p-0.5 border rounded px-1">{b.code}</code></li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'movements' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
          <table className="w-full text-left text-xs text-slate-600">
            <thead>
              <tr className="bg-slate-50/70 text-slate-500 uppercase font-mono tracking-wider border-b border-slate-200">
                <th className="px-5 py-3">Movement Date</th>
                <th className="px-5 py-3">Product Name</th>
                <th className="px-5 py-3">Action Type</th>
                <th className="px-5 py-3">Quantity</th>
                <th className="px-5 py-3">Location Branch</th>
                <th className="px-5 py-3">Reason / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans text-xs">
              {movementsList.map(m => {
                const isPositive = m.quantity >= 0;
                return (
                  <tr key={m.id} className="hover:bg-slate-50/20">
                    <td className="px-5 py-3 text-slate-400 font-mono">{new Date(m.createdAt).toLocaleString('en-GB')}</td>
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-800">{m.productName}</div>
                      <span className="text-[10px] text-slate-400 font-mono">{m.sku}</span>
                    </td>
                    <td className="px-5 py-3 font-mono">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${m.type === 'Sale' ? 'bg-blue-50 text-blue-805' : m.type.startsWith('Adjustment') ? 'bg-amber-100 text-amber-805' : 'bg-emerald-50 text-emerald-805'}`}>
                        {m.type}
                      </span>
                    </td>
                    <td className={`px-5 py-3 font-mono font-bold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isPositive ? `+${m.quantity}` : m.quantity} units
                    </td>
                    <td className="px-5 py-3 text-slate-500">{m.branchName}</td>
                    <td className="px-5 py-3 max-w-xs truncate text-[11px]" title={m.reason}>{m.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* QUICK ADJUSTMENTS POPUP DRAWERS */}
      {adjustOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-slate-200 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-sans font-extrabold text-slate-900 uppercase tracking-widest">Adjust Stock Levels</h3>
            <p className="text-[11px] text-slate-405 font-mono">{selectedProduct.productName} ({selectedProduct.sku})</p>

            <form onSubmit={handleAdjustment} className="space-y-3.2 text-xs font-sans">
              <div>
                <label className="text-slate-500 block mb-1">Adjustment Quantity Change *</label>
                <input
                  type="number"
                  required
                  value={qtyChange}
                  onChange={(e) => setQtyChange(e.target.value)}
                  placeholder="e.g. -5 to subtract, 10 to add"
                  className="w-full border border-slate-200 p-2 bg-slate-50 rounded-lg font-mono"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-slate-550 block mb-1">Auditing Reason *</label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Checked shelf count match, damaged write-off"
                  className="w-full border border-slate-200 p-2 bg-slate-50 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setAdjustOpen(false)} className="py-1.5 px-3 border border-slate-200 rounded-lg font-mono">Close</button>
                <button type="submit" className="py-1.5 px-4 bg-indigo-600 text-white rounded-lg font-semibold font-mono">Save Adjustment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
