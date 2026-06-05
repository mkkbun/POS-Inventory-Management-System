/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store.ts';
import { Product, Category } from '../types.ts';
import { Search, Plus, Trash2, Edit2, Upload, FileDown, CheckCircle, AlertTriangle } from 'lucide-react';

export default function ProductsView() {
  const { token, selectedBranchId } = useAppStore();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter conditions
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Form Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [threshold, setThreshold] = useState('5');
  const [description, setDescription] = useState('');

  // Bulk Load CSV states
  const [bulkOpen, setBulkOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  const fetchProductsAndCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer={token}` };
      const [resP, resC] = await Promise.all([
        fetch('/api/products', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/categories', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (!resP.ok || !resC.ok) throw new Error('Failed to retrieve item catalogs.');
      setProducts(await resP.json());
      setCategories(await resC.json());
    } catch (e: any) {
      setError(e.message || 'Error occurred while loading product fields.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchProductsAndCategories();
    }
  }, [token, selectedBranchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !sku || !barcode || !categoryId || !price) {
      alert('Missing mandatory details.');
      return;
    }

    const payload = {
      name, sku, barcode, categoryId,
      price: parseFloat(price),
      costPrice: parseFloat(costPrice || '0'),
      lowStockThreshold: parseInt(threshold || '5'),
      description
    };

    const method = editingId ? 'PUT' : 'POST';
    const endpoint = editingId ? `/api/products/${editingId}` : '/api/products';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Server rejected changes.');
        return;
      }

      setModalOpen(false);
      resetForm();
      fetchProductsAndCategories();
    } catch (err) {
      alert('Fail due to connection disruption.');
    }
  };

  const handleEditInit = (prod: any) => {
    setEditingId(prod.id);
    setName(prod.name);
    setSku(prod.sku);
    setBarcode(prod.barcode);
    setCategoryId(prod.categoryId);
    setPrice(prod.price.toString());
    setCostPrice(prod.costPrice.toString());
    setThreshold(prod.lowStockThreshold.toString());
    setDescription(prod.description || '');
    setModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}" from your system? This is irreversible.`)) return;

    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchProductsAndCategories();
      } else {
        const d = await res.json();
        alert(d.error || 'Unable to delete product.');
      }
    } catch (e) {
      alert('Connection error.');
    }
  };

  const handleBulkImport = async () => {
    if (!csvText) return;
    try {
      const res = await fetch('/api/products/bulk-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ csvText })
      });
      const data = await res.json();
      if (res.ok) {
        setBulkResult(`✓ Successfully uploaded ${data.count} new products into catalog inventories!`);
        setCsvText('');
        fetchProductsAndCategories();
        setTimeout(() => {
          setBulkResult(null);
          setBulkOpen(false);
        }, 2000);
      } else {
        alert(data.error || 'Bulk parsing error.');
      }
    } catch (e) {
      alert('Internal transmission failure.');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setSku('');
    setBarcode('');
    setCategoryId('');
    setPrice('');
    setCostPrice('');
    setThreshold('5');
    setDescription('');
  };

  const filteredList = products.filter(p => {
    const matchQuery = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode.includes(searchQuery);
    const matchCat = selectedCategory === 'ALL' || p.categoryId === selectedCategory;
    return matchQuery && matchCat;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-sans font-semibold text-slate-900 tracking-tight">Catalogs Management</h2>
          <p className="text-slate-500 text-xs font-mono">Create, audit and organize stock units catalog profiles</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setBulkOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-mono transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" /> CSV Import
          </button>
          <button
            onClick={() => { resetForm(); setModalOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded-lg text-xs font-mono transition cursor-pointer font-bold"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Search & Filter blocks */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 border border-slate-200 rounded-xl shadow-2xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search items by SKU, barcode, title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-sans focus:outline-hidden"
          />
        </div>
        <div className="min-w-[180px]">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full bg-slate-50 border border-slate-255 select-none text-slate-700 pl-3 pr-8 py-2 rounded-lg text-xs font-sans leading-tight focus:outline-hidden"
          >
            <option value="ALL">Show All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid listing */}
      <div className="bg-white border border-slate-200 shadow-2xs rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          {filteredList.length === 0 ? (
            <div className="p-12 text-center text-slate-405 font-mono text-xs">
              No matching products found. Adjust filters.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs text-slate-700">
              <thead>
                <tr className="bg-slate-50/80 uppercase font-mono tracking-wider border-b border-slate-200 text-slate-500">
                  <th className="px-5 py-3">Product Name / Barcode</th>
                  <th className="px-5 py-3">SKU Code</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Retail Price</th>
                  <th className="px-5 py-3">Cost Price</th>
                  <th className="px-5 py-3">Alert Limit</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredList.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/40">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900 leading-tight">{p.name}</div>
                      <span className="text-[10px] text-slate-400 font-mono tracking-wide">{p.barcode}</span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-600 uppercase">{p.sku}</td>
                    <td className="px-5 py-3.5 text-slate-500">{p.categoryName}</td>
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900">£{p.price.toFixed(2)}</td>
                    <td className="px-5 py-3.5 font-mono text-slate-500">£{p.costPrice.toFixed(2)}</td>
                    <td className="px-5 py-3.5 font-mono text-slate-400 font-bold">{p.lowStockThreshold} units</td>
                    <td className="px-5 py-3.5 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => handleEditInit(p)}
                        className="p-1 text-slate-400 hover:text-indigo-600 rounded-md transition hover:bg-slate-100 cursor-pointer"
                        title="Edit profile"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id, p.name)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition hover:bg-slate-100 cursor-pointer"
                        title="Delete product"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* CSV IMPORT MODAL */}
      {bulkOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-sans font-bold text-slate-900 uppercase tracking-wider">Bulk CSV upload console</h3>
              <button onClick={() => setBulkOpen(false)} className="text-slate-400 hover:text-slate-650 text-xl font-bold cursor-pointer">×</button>
            </div>
            
            <div className="p-3 bg-indigo-50/50 rounded-lg text-[10px] font-mono leading-relaxed text-indigo-900 border border-indigo-100">
              <span className="font-extrabold block mb-1">CSV Column Specification layout:</span>
              <code>name, sku, barcode, categoryId, price, costPrice, lowStockThreshold, description</code>
              <p className="mt-1 text-slate-450 text-[9px]">e.g. Aura Pro Earbuds, ELE-BUD, 506087114, cat1, 79.99, 32.00, 5, High fidelity audio</p>
            </div>

            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Paste comma-separated rows here..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 h-48 focus:outline-hidden text-xs font-mono"
            />

            {bulkResult && (
              <p className="text-emerald-700 text-xs font-mono text-center p-2 bg-emerald-50 rounded-lg border border-emerald-100">{bulkResult}</p>
            )}

            <div className="flex gap-2">
              <button onClick={() => setBulkOpen(false)} className="flex-1 py-2 text-xs font-mono border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">Close</button>
              <button onClick={handleBulkImport} className="flex-1 py-2 bg-indigo-650 text-white text-xs font-mono rounded-lg hover:bg-colors-750 transition cursor-pointer">Process Import</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD/EDIT FORM MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl relative my-auto animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-sans font-extrabold text-slate-900 uppercase tracking-widest">
                {editingId ? 'Edit Product Fields' : 'Add New Product Inventory'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-450 hover:text-slate-600 text-xl font-bold font-mono cursor-pointer">×</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs font-sans">
              <div>
                <label className="text-slate-500 block mb-1">Company Item Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Aura Earbuds Pro"
                  className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-500 block mb-1">SKU Unique Code *</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="e.g. ELE-BUD"
                    className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-hidden lowercase font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block mb-1">EAN/Barcode *</label>
                  <input
                    type="text"
                    required
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="506087114xxx"
                    className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Retail Price (£) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="29.99"
                    className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Cost Price (£) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    placeholder="12.00"
                    className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-550 block mb-1">Choose Category *</label>
                  <select
                    required
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full border border-slate-200 select-none text-slate-700 bg-slate-50 rounded-lg p-2 focus:outline-hidden"
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-500 block mb-1">Alert threshold *</label>
                  <input
                    type="number"
                    required
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    placeholder="5"
                    className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-500 block mb-1">Description Brief</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional details notes..."
                  className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-hidden h-16 resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="py-2 px-4 border border-slate-250 cursor-pointer text-xs font-mono rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 cursor-pointer bg-indigo-600 text-white hover:bg-indigo-750 font-bold font-mono rounded-lg transition"
                >
                  Confirm Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
