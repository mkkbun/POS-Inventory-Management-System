/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store.ts';
import { Category } from '../types.ts';
import { Plus, Trash2, Edit3, FolderGit } from 'lucide-react';

export default function CategoriesView() {
  const { token } = useAppStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const loadCategories = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/categories', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setCategories(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadCategories();
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const payload = { name, description };
    const method = editingId ? 'PUT' : 'POST';
    const endpoint = editingId ? `/api/categories/${editingId}` : '/api/categories';

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
        setModalOpen(false);
        setName('');
        setDescription('');
        setEditingId(null);
        loadCategories();
      }
    } catch (e) {
      alert('Error updating categories.');
    }
  };

  const handleEditInit = (cat: Category) => {
    setEditingId(cat.id);
    setName(cat.name);
    setDescription(cat.description);
    setModalOpen(true);
  };

  const handleDelete = async (id: string, catName: string) => {
    if (!confirm(`Are you sure you want to delete category "${catName}"? Products in this group will become uncategorized.`)) return;
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        loadCategories();
      }
    } catch (e) {
      alert('Network error.');
    }
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-sans font-semibold text-slate-900 tracking-tight">Product Categories Catalog</h2>
          <p className="text-slate-500 text-xs font-mono">Form categories partitions to filter POS registries seamlessly</p>
        </div>
        <button
          onClick={() => { setEditingId(null); setName(''); setDescription(''); setModalOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded-lg text-xs font-mono font-bold transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Create Category
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <table className="w-full text-left text-xs text-slate-750">
          <thead>
            <tr className="bg-slate-50/70 border-b border-slate-200 uppercase font-mono tracking-wider text-slate-500">
              <th className="px-5 py-3">Category Classification</th>
              <th className="px-5 py-3">Summary Description / Purpose</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {categories.map(c => (
              <tr key={c.id} className="hover:bg-slate-50/30">
                <td className="px-5 py-4 font-semibold text-slate-900 flex items-center gap-2">
                  <FolderGit className="w-4 h-4 text-indigo-550" />
                  {c.name}
                </td>
                <td className="px-5 py-4 text-slate-500">{c.description || 'No notes defined.'}</td>
                <td className="px-5 py-4 text-right space-x-2">
                  <button onClick={() => handleEditInit(c)} className="text-indigo-600 hover:underline cursor-pointer">Edit</button>
                  <button onClick={() => handleDelete(c.id, c.name)} className="text-rose-600 hover:underline cursor-pointer">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-slate-200 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-sans font-extrabold text-slate-900 uppercase tracking-wide">
              {editingId ? 'Modify Category' : 'Create Category Category'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs font-sans">
              <div>
                <label className="text-slate-500 block mb-1">Category Label *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Fresh Gourmet Deli"
                  className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Details Summary</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Keep category briefs simple..."
                  className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-hidden h-20 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="py-2 px-3 hover:bg-slate-50 border border-slate-200 rounded-lg font-mono">Cancel</button>
                <button type="submit" className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold font-mono">Authorize</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
