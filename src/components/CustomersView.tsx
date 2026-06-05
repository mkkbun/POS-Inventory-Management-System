/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store.ts';
import { Customer } from '../types.ts';
import { Plus, Trash2, Edit3, UserPlus, Gift, Phone } from 'lucide-react';

export default function CustomersView() {
  const { token } = useAppStore();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/customers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setCustomers(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadCustomers();
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;

    const payload = { name, email, phone, address };
    const method = editingId ? 'PUT' : 'POST';
    const endpoint = editingId ? `/api/customers/${editingId}` : '/api/customers';

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
        resetForm();
        loadCustomers();
      }
    } catch (e) {
      alert('Error updating customer records.');
    }
  };

  const handleEditInit = (cust: Customer) => {
    setEditingId(cust.id);
    setName(cust.name);
    setEmail(cust.email);
    setPhone(cust.phone);
    setAddress(cust.address || '');
    setModalOpen(true);
  };

  const handleDelete = async (id: string, custName: string) => {
    if (!confirm(`Remove customer card for "${custName}"? This dissolves their loyalty points balance.`)) return;
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) loadCustomers();
    } catch (e) {
      alert('Delete failed.');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setEmail('');
    setPhone('');
    setAddress('');
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
          <h2 className="text-xl font-sans font-semibold text-slate-900 tracking-tight">Enterprise Loyalty & CRM</h2>
          <p className="text-slate-500 text-xs font-mono">Create customer cards, audit purchase balances, and manage loyalty tiers</p>
        </div>
        <button
          onClick={() => { resetForm(); setModalOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-650 hover:bg-indigo-750 text-white rounded-lg text-xs font-mono font-bold transition cursor-pointer"
        >
          <UserPlus className="w-4 h-4" /> Register Customer
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers.map(c => (
          <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs hover:shadow-2xs transition flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-start gap-1">
                <div>
                  <h4 className="text-sm font-sans font-bold text-slate-900 leading-tight">{c.name}</h4>
                  <span className="text-[10px] text-slate-400 font-mono italic">Account Card: {c.id}</span>
                </div>

                {/* Loyalty Tier tag */}
                <div className="bg-amber-50 text-amber-850 p-1 px-2 border border-amber-200 rounded-lg flex items-center gap-1 text-[10px] font-mono leading-none font-bold">
                  <Gift className="w-3 h-3 text-amber-500" />
                  {c.loyaltyPointsBalance} pts
                </div>
              </div>

              <div className="space-y-1 font-mono text-[10px] text-slate-500 leading-tight">
                <p>📞 Phone: {c.phone}</p>
                <p>📩 Email: {c.email || 'None registered'}</p>
                {c.address && <p>🏠 Address: {c.address}</p>}
              </div>
            </div>

            <div className="border-t border-slate-100/60 pt-3 flex justify-end gap-3 text-xs">
              <button onClick={() => handleEditInit(c)} className="text-indigo-600 hover:underline cursor-pointer">Edit Profile</button>
              <button onClick={() => handleDelete(c.id, c.name)} className="text-rose-600 hover:underline cursor-pointer">Delete Card</button>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-slate-200 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-sans font-extrabold text-slate-900 uppercase">
              {editingId ? 'Modify Customer Metadata' : 'Register Customer Profile'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs font-sans">
              <div>
                <label className="text-slate-500 block mb-1">Full Client Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. William Vance"
                  className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-hidden"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-500 block mb-1">Mobile Contact No *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+44 7700 ..."
                    className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">E-mail Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="will@example.com"
                    className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-hidden"
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-500 block mb-1">Resident Address Details</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street and postcode info..."
                  className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="py-1.5 px-3 border border-slate-200 rounded-lg font-mono">Cancel</button>
                <button type="submit" className="py-1.5 px-4 bg-indigo-600 text-white rounded-lg font-bold font-mono">Authorize</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
