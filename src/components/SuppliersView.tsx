/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store.ts';
import { Supplier, Product } from '../types.ts';
import { Plus, Trash2, Edit3, ClipboardList, CheckSquare, RefreshCw, Box } from 'lucide-react';

export default function SuppliersView() {
  const { token, selectedBranchId } = useAppStore();
  const [activeTab, setActiveTab] = useState<'suppliers' | 'pos'>('suppliers');
  
  // Data lists
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Supplier Form state
  const [supModalOpen, setSupModalOpen] = useState(false);
  const [editingSupId, setEditingSupId] = useState<string | null>(null);
  const [supName, setSupName] = useState('');
  const [contactName, setContactName] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supAddress, setSupAddress] = useState('');

  // PO Form state
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poBranchId, setPoBranchId] = useState('');
  const [poProductIds, setPoProductIds] = useState<string[]>(['']);
  const [poQuantities, setPoQuantities] = useState<string[]>(['10']);
  const [poCosts, setPoCosts] = useState<string[]>(['5.00']);
  const [poNotes, setPoNotes] = useState('');

  const loadAll = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [resS, resPO, resP] = await Promise.all([
        fetch('/api/suppliers', { headers }),
        fetch('/api/purchase-orders', { headers }),
        fetch('/api/products', { headers })
      ]);
      if (resS.ok) setSuppliers(await resS.json());
      if (resPO.ok) setPurchaseOrders(await resPO.json());
      if (resP.ok) setProducts(await resP.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadAll();
    }
  }, [token, selectedBranchId]);

  // Supplier CRUD submissions
  const handleSupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName || !supEmail) return;

    const payload = { name: supName, contactName, email: supEmail, phone: supPhone, address: supAddress };
    const method = editingSupId ? 'PUT' : 'POST';
    const endpoint = editingSupId ? `/api/suppliers/${editingSupId}` : '/api/suppliers';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setSupModalOpen(false);
        resetSupForm();
        loadAll();
      }
    } catch (e) {
      alert('Error saving supplier metadata.');
    }
  };

  const handleEditSupInit = (sup: Supplier) => {
    setEditingSupId(sup.id);
    setSupName(sup.name);
    setContactName(sup.contactName);
    setSupEmail(sup.email);
    setSupPhone(sup.phone);
    setSupAddress(sup.address);
    setSupModalOpen(true);
  };

  const handleDeleteSup = async (id: string, name: string) => {
    if (!confirm(`Delete supplier profile for "${name}"? This removes historical ledger associations.`)) return;
    try {
      const res = await fetch(`/api/suppliers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) loadAll();
    } catch (e) {
      alert('Delete failed.');
    }
  };

  const resetSupForm = () => {
    setEditingSupId(null);
    setSupName('');
    setContactName('');
    setSupEmail('');
    setSupPhone('');
    setSupAddress('');
  };

  // PO Creation submissions
  const handlePoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poSupplierId || !poBranchId) return;

    const itemsMapped = poProductIds.map((pId, idx) => ({
      productId: pId,
      quantity: parseInt(poQuantities[idx] || '10'),
      unitCost: parseFloat(poCosts[idx] || '5.00')
    })).filter(it => it.productId);

    if (itemsMapped.length === 0) {
      alert('Provide at least one active product item.');
      return;
    }

    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          supplierId: poSupplierId,
          branchId: poBranchId,
          items: itemsMapped,
          notes: poNotes
        })
      });

      if (res.ok) {
        setPoModalOpen(false);
        resetPoForm();
        loadAll();
        alert('Historical PO created successfully! Verify or Receive stocks anytime.');
      } else {
        const d = await res.json();
        alert(d.error || 'Server rejected PO formatting.');
      }
    } catch (err) {
      alert('POs creation failure.');
    }
  };

  const handleAddPoItem = () => {
    setPoProductIds([...poProductIds, '']);
    setPoQuantities([...poQuantities, '10']);
    setPoCosts([...poCosts, '5.00']);
  };

  const handleRemovePoItem = (idx: number) => {
    setPoProductIds(poProductIds.filter((_, i) => i !== idx));
    setPoQuantities(poQuantities.filter((_, i) => i !== idx));
    setPoCosts(poCosts.filter((_, i) => i !== idx));
  };

  const handleReceiveStock = async (poId: string) => {
    if (!confirm('This action absorbes PO catalog counts into active branch stocks and updates logs. Ready?')) return;
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/receive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await res.json();
      if (res.ok) {
        loadAll();
        alert('Stock received and active inventories updated dynamically!');
      } else {
        alert(d.error || 'Unable to receive inventory cargo.');
      }
    } catch (e) {
      alert('Network transaction issues.');
    }
  };

  const resetPoForm = () => {
    setPoSupplierId('');
    setPoBranchId('');
    setPoProductIds(['']);
    setPoQuantities(['10']);
    setPoCosts(['5.00']);
    setPoNotes('');
  };

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
          <h2 className="text-xl font-sans font-semibold text-slate-900 tracking-tight">Suppliers & Replenishments</h2>
          <p className="text-slate-500 text-xs font-mono">Negotiate suppliers cargo records, file PO contracts and receive stock cargos</p>
        </div>

        <div className="flex border border-slate-205 bg-white p-1 rounded-lg text-xs font-mono">
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`p-1 py-1.5 px-3 rounded-md cursor-pointer transition ${activeTab === 'suppliers' ? 'bg-indigo-650 text-white font-bold' : 'text-slate-600'}`}
          >
            Distributors
          </button>
          <button
            onClick={() => setActiveTab('pos')}
            className={`p-1 py-1.5 px-3 rounded-md cursor-pointer transition ${activeTab === 'pos' ? 'bg-indigo-650 text-white font-bold' : 'text-slate-600'}`}
          >
            Purchase Orders
          </button>
        </div>
      </div>

      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => { resetSupForm(); setSupModalOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded-lg text-xs font-mono transition font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Register Distributor
            </button>
          </div>

          <div className="bg-white border border-slate-200 shadow-2xs rounded-xl overflow-hiddenCombined">
            <table className="w-full text-left text-xs text-slate-700">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 uppercase font-mono tracking-wider text-slate-500">
                  <th className="px-5 py-3">Business Enterprise</th>
                  <th className="px-5 py-3">Operations Representative</th>
                  <th className="px-5 py-3">Email Contact</th>
                  <th className="px-5 py-3">Phone Terminal</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {suppliers.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/20">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-900">{s.name}</div>
                      <span className="text-[10px] text-slate-400 font-mono italic">{s.address}</span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 font-medium">{s.contactName}</td>
                    <td className="px-5 py-3.5 font-mono text-slate-500">{s.email}</td>
                    <td className="px-5 py-3.5 font-mono text-slate-500">{s.phone}</td>
                    <td className="px-5 py-3.5 text-right space-x-2.5">
                      <button onClick={() => handleEditSupInit(s)} className="text-indigo-600 hover:underline font-medium cursor-pointer">Edit</button>
                      <button onClick={() => handleDeleteSup(s.id, s.name)} className="text-rose-600 hover:underline font-medium cursor-pointer">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'pos' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => { resetPoForm(); setPoModalOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded-lg text-xs font-mono transition font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> File New Purchase Order (PO)
            </button>
          </div>

          <div className="bg-white border border-slate-200 shadow-2xs rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs text-slate-700">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 uppercase font-mono tracking-wider text-slate-500 animate-pulse duration-1000">
                  <th className="px-5 py-3">PO Reference Number</th>
                  <th className="px-5 py-3">Supplier Enterprise</th>
                  <th className="px-5 py-3">Target Outlet</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Invoice Sum</th>
                  <th className="px-5 py-3 text-right">Operational Ingestion Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans text-slate-700">
                {purchaseOrders.map((po: any) => (
                  <tr key={po.id} className="hover:bg-slate-50/20">
                    <td className="px-5 py-4 font-mono font-bold text-slate-900">{po.poNumber}</td>
                    <td className="px-5 py-4 font-medium text-slate-700">{po.supplierName}</td>
                    <td className="px-5 py-4 text-slate-500">{po.branchName}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-[9px] ${po.status === 'Received' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-slate-950">£{po.totalCost.toFixed(2)}</td>
                    <td className="px-5 py-4 text-right">
                      {po.status === 'Pending' ? (
                        <button
                          onClick={() => handleReceiveStock(po.id)}
                          className="py-1 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-mono text-[9px] uppercase font-bold rounded-lg border border-indigo-250 transition cursor-pointer"
                        >
                          Receive Stock Units
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono italic">✓ Ingested {new Date(po.receivedAt || '').toLocaleDateString('en-GB')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUPPLIER MODAL */}
      {supModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-slate-200 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-sans font-extrabold text-slate-900 uppercase">
              {editingSupId ? 'Modify Supplier records' : 'Register Supplier Enterprise'}
            </h3>

            <form onSubmit={handleSupSubmit} className="space-y-3 text-xs font-sans">
              <div>
                <label className="text-slate-500 block mb-1">Company Registered Name *</label>
                <input
                  type="text"
                  required
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  placeholder="e.g. Sustain & Nourish Farms Ltd"
                  className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-550 block mb-1">Rep Name</label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Angela Miller"
                    className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block mb-1">Phone *</label>
                  <input
                    type="text"
                    required
                    value={supPhone}
                    onChange={(e) => setSupPhone(e.target.value)}
                    placeholder="+44 141 ..."
                    className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-450 block mb-1">E-mail *</label>
                <input
                  type="email"
                  required
                  value={supEmail}
                  onChange={(e) => setSupEmail(e.target.value)}
                  placeholder="supply@sustain.co.uk"
                  className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50"
                />
              </div>

              <div>
                <label className="text-slate-450 block mb-1">Registered HQ Address</label>
                <input
                  type="text"
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  placeholder="Full distribution hub coordinates..."
                  className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setSupModalOpen(false)} className="py-1.5 px-3 border border-slate-200 rounded-lg font-mono">Cancel</button>
                <button type="submit" className="py-1.5 px-4 bg-indigo-600 text-white rounded-lg font-bold font-mono">Authorize</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PURCHASE ORDER (PO) FORM CREATION MODAL */}
      {poModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl my-auto relative animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-sans font-extrabold text-slate-900 uppercase mb-4">Draft Replenishment Purchase Order (PO)</h3>

            <form onSubmit={handlePoSubmit} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-slate-500 block mb-1">Select Supplier *</label>
                  <select
                    required
                    value={poSupplierId}
                    onChange={(e) => setPoSupplierId(e.target.value)}
                    className="w-full border select-none text-slate-750 bg-slate-50 rounded-lg p-2"
                  >
                    <option value="">Choose Supplier</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-500 block mb-1">Deliver to Branch *</label>
                  <select
                    required
                    value={poBranchId}
                    onChange={(e) => setPoBranchId(e.target.value)}
                    className="w-full border select-none text-slate-750 bg-slate-50 rounded-lg p-2"
                  >
                    <option value="">Choose Branch</option>
                    <option value="b1">London Flagship HQ</option>
                    <option value="b2">Manchester Northern</option>
                    <option value="b3">Edinburgh Royal Mile</option>
                  </select>
                </div>
              </div>

              {/* Dynamic products allocations rows */}
              <div className="space-y-2 border-t pt-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-mono font-bold text-slate-405 uppercase tracking-wide">Allocated Cargo Items:</span>
                  <button
                    type="button"
                    onClick={handleAddPoItem}
                    className="text-indigo-600 text-xs font-mono font-semibold hover:underline cursor-pointer"
                  >
                    + Add Item Row
                  </button>
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
                  {poProductIds.map((pId, idx) => (
                    <div key={idx} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <select
                          required
                          value={pId}
                          onChange={(e) => {
                            const newIds = [...poProductIds];
                            newIds[idx] = e.target.value;
                            setPoProductIds(newIds);
                          }}
                          className="w-full border select-none text-slate-700 bg-slate-50 p-1.5 rounded-lg text-xs"
                        >
                          <option value="">Select SKU Product</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name} (£{p.costPrice.toFixed(2)} cost)</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-20">
                        <input
                          type="number"
                          required
                          value={poQuantities[idx]}
                          onChange={(e) => {
                            const newQ = [...poQuantities];
                            newQ[idx] = e.target.value;
                            setPoQuantities(newQ);
                          }}
                          placeholder="Qty"
                          className="w-full border bg-slate-50 p-1.5 rounded-lg font-mono text-center"
                        />
                      </div>
                      <div className="w-24">
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={poCosts[idx]}
                          onChange={(e) => {
                            const newC = [...poCosts];
                            newC[idx] = e.target.value;
                            setPoCosts(newC);
                          }}
                          placeholder="Unit Cost"
                          className="w-full border bg-slate-50 p-1.5 rounded-lg font-mono text-center"
                        />
                      </div>
                      {poProductIds.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePoItem(idx)}
                          className="p-1 px-2 border text-rose-500 rounded-lg hover:bg-slate-50 text-xs cursor-pointer select-none font-bold"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-405 block mb-1">Filing Notes / Special Instructions</label>
                <input
                  type="text"
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  placeholder="Identify urgent restock labels..."
                  className="w-full border border-slate-205 rounded-lg bg-slate-50 p-2"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button type="button" onClick={() => setPoModalOpen(false)} className="py-2 px-3 border border-slate-200 rounded-lg font-mono">Cancel</button>
                <button type="submit" className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold font-mono">Deploy PO File</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
