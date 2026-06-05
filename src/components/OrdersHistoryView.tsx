/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store.ts';
import { Order } from '../types.ts';
import { Search, Eye, RefreshCcw, FileSpreadsheet, XCircle } from 'lucide-react';

export default function OrdersHistoryView() {
  const { token, selectedBranchId } = useAppStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Drill-down Detail Modal states
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setOrders(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadOrders();
    }
  }, [token, selectedBranchId]);

  const handleVoidOrder = async (orderId: string) => {
    if (!voidReason) {
      alert('Provide a standard audit reason before voiding.');
      return;
    }
    if (!confirm('This action reverses products stock counts and cancels loyalty point counts. Continue?')) return;

    setIsVoiding(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/void`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason: voidReason })
      });

      const d = await res.json();
      if (res.ok) {
        setSelectedOrder(null);
        setVoidReason('');
        loadOrders();
        alert('Transaction reversed and database instances synchronized!');
      } else {
        alert(d.error || 'Unable to void transaction.');
      }
    } catch (e) {
      alert('Connection error.');
    } finally {
      setIsVoiding(false);
    }
  };

  // Export orders list to standard spreadsheet format CSV
  const exportToCSV = () => {
    if (orders.length === 0) return;
    const csvRows = [
      ['Date/Time', 'Order Number', 'Branch', 'Cashier', 'Customer', 'Subtotal', 'VAT Tax', 'Discounts', 'Grand Total', 'Method', 'Status']
    ];

    orders.forEach(o => {
      csvRows.push([
        new Date(o.createdAt).toLocaleString('en-GB'),
        o.orderNumber,
        o.branchName,
        o.cashierName,
        o.customerName,
        o.totalBeforeTax.toString(),
        o.taxAmount.toString(),
        o.discountAmount.toString(),
        o.totalAmount.toString(),
        o.paymentMethod,
        o.status
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.map(cell => `"${cell}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `apex_orders_archive_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredOrders = orders.filter(o => {
    const isAll = selectedBranchId === 'ALL';
    const matchBranch = isAll || o.branchId === selectedBranchId;
    const matchSearch = o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) || o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || o.cashierName.toLowerCase().includes(searchQuery.toLowerCase());
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
          <h2 className="text-xl font-sans font-semibold text-slate-900 tracking-tight font-sans">Checkout Transactions Archive</h2>
          <p className="text-slate-505 text-xs font-mono">Filter transactions logs, analyze itemization specs, or issue refunds</p>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-205 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-mono transition cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-605" />
          Export to CSV
        </button>
      </div>

      {/* Query Search filters */}
      <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-2xs">
        <input
          type="text"
          placeholder="Search items by Order Reference, Customer, Staff id..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs font-sans"
        />
      </div>

      {/* Grid records */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <table className="w-full text-left text-xs text-slate-700">
          <thead>
            <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 uppercase font-mono tracking-wider">
              <th className="px-5 py-3">Order Code</th>
              <th className="px-5 py-3">Sales Terminal</th>
              <th className="px-5 py-3">Cashier</th>
              <th className="px-5 py-3">Connected customer</th>
              <th className="px-5 py-3">Method</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Grand Total</th>
              <th className="px-5 py-3 text-right">View</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans text-xs text-slate-700">
            {filteredOrders.map(o => (
              <tr key={o.id} className="hover:bg-slate-50/20">
                <td className="px-5 py-3.5 font-mono font-bold text-slate-900">{o.orderNumber}</td>
                <td className="px-5 py-3.5 text-slate-500">{o.branchName}</td>
                <td className="px-5 py-3.5 text-slate-500 truncate max-w-[120px]">{o.cashierName}</td>
                <td className="px-5 py-3.5 text-slate-500 truncate max-w-[120px]">{o.customerName}</td>
                <td className="px-5 py-3.5 font-mono text-slate-400 font-bold">{o.paymentMethod}</td>
                <td className="px-5 py-3.5">
                  <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-[9px] ${o.status === 'Completed' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                    {o.status}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right font-mono font-extrabold text-slate-950">£{o.totalAmount.toFixed(2)}</td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    onClick={() => setSelectedOrder(o)}
                    className="p-1 text-indigo-600 hover:bg-slate-50 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" /> Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* DRILL DOWN ITEM DETAIL WINDOW */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-201 shadow-2xl relative my-auto animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 border-b border-slate-150 pb-2.5">
              <h3 className="text-sm font-sans font-extrabold text-slate-900 uppercase">Itemized order details</h3>
              <button onClick={() => { setSelectedOrder(null); setVoidReason(''); }} className="text-slate-450 hover:text-slate-600 text-xl font-bold font-mono cursor-pointer">×</button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-650">
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono leading-tight bg-slate-50 p-3 rounded-lg border">
                <div>
                  <span className="text-slate-400 block pb-0.5">ORDER REFERENCE</span>
                  <span className="text-slate-900 font-bold">{selectedOrder.orderNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block pb-0.5">TERMINAL OUTLET</span>
                  <span className="text-slate-900">{selectedOrder.branchName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block pb-0.5">DATE SIGNED</span>
                  <span>{new Date(selectedOrder.createdAt).toLocaleString('en-GB')}</span>
                </div>
                <div>
                  <span className="text-slate-400 block pb-0.5">CASHIER</span>
                  <span className="truncate block max-w-[130px]">{selectedOrder.cashierName}</span>
                </div>
              </div>

              {/* Items checklist */}
              <div className="space-y-1.5 border-t border-slate-100 pt-3">
                <span className="text-[10px] font-mono font-bold text-slate-405 uppercase tracking-wide">Basket Inventory:</span>
                <div className="divide-y divide-slate-100 font-mono text-[11px] max-h-32 overflow-y-auto scrollbar-thin pr-1">
                  {selectedOrder.items.map((item: any) => (
                    <div key={item.id} className="py-2 flex justify-between">
                      <div className="max-w-[180px] truncate font-medium text-slate-800">Product Ref: {item.productId}</div>
                      <span className="text-slate-500">{item.quantity}x @ £{item.priceAtSale.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price calculations */}
              <div className="border-t border-slate-150/80 pt-3 space-y-1 text-slate-500 font-mono text-[10px]">
                <div className="flex justify-between">
                  <span>Subtotal sum basis:</span>
                  <span>£{(selectedOrder.totalBeforeTax).toFixed(2)}</span>
                </div>
                {selectedOrder.discountAmount > 0 && (
                  <div className="flex justify-between text-rose-500">
                    <span>Discount percentage ({selectedOrder.discountPercentage}%):</span>
                    <span>-£{selectedOrder.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>VAT Standard Rate:</span>
                  <span>£{selectedOrder.taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-extrabold text-sm text-slate-900 border-t border-dashed mt-1.5 pt-1.5">
                  <span>Grand Total amount:</span>
                  <span className="text-emerald-750 font-sans font-bold">£{selectedOrder.totalAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Order Voiding Panel - Admin / Manager restricted */}
              {selectedOrder.status !== 'Refunded' ? (
                <div className="border-t border-red-50 bg-red-50/40 p-3 rounded-lg mt-4 space-y-3.5 border">
                  <div className="flex items-center gap-1.5 text-xs text-red-800">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span className="font-semibold">Reversal / Void Gateway</span>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <input
                      type="text"
                      placeholder="Comment reasons for void order..."
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                      className="flex-1 border bg-white border-slate-200 p-1.5 rounded-lg text-xs"
                    />
                    <button
                      onClick={() => handleVoidOrder(selectedOrder.id)}
                      disabled={isVoiding}
                      className="px-3 bg-red-650 text-white rounded-lg text-[10px] font-mono hover:bg-red-800 transition uppercase cursor-pointer"
                    >
                      Void order
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-stone-55 rounded-lg border text-stone-605 text-center font-mono font-medium">
                  ✓ This transaction invoice was fully VOIDED & inventories restored.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
