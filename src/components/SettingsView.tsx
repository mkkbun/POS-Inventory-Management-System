/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store.ts';
import { Setting, User } from '../types.ts';
import { Settings, Shield, Key, Plus, FileText, CheckCircle } from 'lucide-react';

export default function SettingsView() {
  const { token } = useAppStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'users' | 'audits'>('profile');

  // Config loaders
  const [settings, setSettings] = useState<Setting | null>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // General Settings inputs
  const [bizName, setBizName] = useState('');
  const [bizAddress, setBizAddress] = useState('');
  const [bizPhone, setBizPhone] = useState('');
  const [bizCurrency, setBizCurrency] = useState('£');
  const [bizTax, setBizTax] = useState('20');
  const [bizFooter, setBizFooter] = useState('');

  // User Accounts maintenance inputs
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffRole, setStaffRole] = useState<'Admin' | 'Manager' | 'Cashier'>('Cashier');
  const [staffBranch, setStaffBranch] = useState('b1');

  const loadSettingsData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [resS, resU, resA, resB] = await Promise.all([
        fetch('/api/settings', { headers }),
        fetch('/api/settings/users', { headers }),
        fetch('/api/settings/audit-logs', { headers }),
        fetch('/api/settings/branches', { headers })
      ]);
      if (resS.ok) {
        const sData = await resS.json();
        setSettings(sData);
        setBizName(sData.businessName);
        setBizAddress(sData.businessAddress);
        setBizPhone(sData.businessPhone);
        setBizCurrency(sData.currency);
        setBizTax(sData.taxRatePercentage.toString());
        setBizFooter(sData.receiptFooterMessage);
      }
      if (resU.ok) setStaff(await resU.json());
      if (resA.ok) setAuditLogs(await resA.json());
      if (resB.ok) setBranches(await resB.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadSettingsData();
    }
  }, [token]);

  // Handle Settings Save
  const handleSettingsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          businessName: bizName,
          businessAddress: bizAddress,
          businessPhone: bizPhone,
          currency: bizCurrency,
          taxRatePercentage: parseFloat(bizTax),
          receiptFooterMessage: bizFooter
        })
      });

      if (res.ok) {
        alert('Universal settings profile updated successfully in datastore!');
        loadSettingsData();
      } else {
        alert('Server rejected structural adjustments.');
      }
    } catch (e) {
      alert('Transmission error.');
    }
  };

  // Staff registry account additions
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName || !staffEmail || !staffRole || !staffBranch) return;

    try {
      const res = await fetch('/api/settings/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: staffName,
          email: staffEmail,
          role: staffRole,
          branchId: staffBranch
        })
      });

      if (res.ok) {
        setStaffModalOpen(false);
        setStaffName('');
        setStaffEmail('');
        alert('Staff credential profile deployed! User can now sign in using default role key paths.');
        loadSettingsData();
      } else {
        const d = await res.json();
        alert(d.error || 'Duplicate or invalid fields.');
      }
    } catch (e) {
      alert('Disconnection.');
    }
  };

  // Toggle user state deactivations
  const handleToggleDeactivate = async (u: any) => {
    const isNowDeactivated = !u.isDeactivated;
    const confirmLabel = isNowDeactivated ? 'DEACTIVATE' : 'REACTIVATE';
    if (!confirm(`Do you want to ${confirmLabel} staff credentials for "${u.name}"?`)) return;

    try {
      const res = await fetch(`/api/settings/users/${u.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isDeactivated: isNowDeactivated })
      });
      if (res.ok) {
        loadSettingsData();
      }
    } catch (e) {
      alert('Disruption occurring.');
    }
  };

  if (loading || !settings) {
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
          <h2 className="text-xl font-sans font-semibold text-slate-900 tracking-tight font-sans">System Configurations</h2>
          <p className="text-slate-500 text-xs font-mono">Modulate operational values, register employee accounts, or audit system trails</p>
        </div>

        {/* Tab options */}
        <div className="flex border bg-white p-1 rounded-lg text-xs font-mono">
          <button
            onClick={() => setActiveTab('profile')}
            className={`p-1 py-1.5 px-3 rounded-md transition cursor-pointer ${activeTab === 'profile' ? 'bg-indigo-650 text-white font-bold' : 'text-slate-600'}`}
          >
            Company Configs
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`p-1 py-1.5 px-3 rounded-md transition cursor-pointer ${activeTab === 'users' ? 'bg-indigo-650 text-white font-bold' : 'text-slate-600'}`}
          >
            User Accounts
          </button>
          <button
            onClick={() => setActiveTab('audits')}
            className={`p-1 py-1.5 px-3 rounded-md transition cursor-pointer ${activeTab === 'audits' ? 'bg-indigo-650 text-white font-bold' : 'text-slate-600'}`}
          >
            Audit Trails Ledger
          </button>
        </div>
      </div>

      {activeTab === 'profile' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-2xl shadow-3xs">
          <form onSubmit={handleSettingsSave} className="space-y-4 text-xs font-sans">
            <div>
              <label className="text-slate-500 block mb-1">Registered Business Name *</label>
              <input
                type="text"
                required
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
                placeholder="Apex Commerce POS"
                className="w-full border border-slate-200 bg-slate-50 p-2 rounded-lg focus:outline-hidden font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-500 block mb-1">Operating currency symbol *</label>
                <input
                  type="text"
                  required
                  value={bizCurrency}
                  onChange={(e) => setBizCurrency(e.target.value)}
                  placeholder="£, $, €, etc."
                  className="w-full border border-slate-200 bg-slate-50 p-2 rounded-lg focus:outline-hidden font-mono text-center font-bold"
                />
              </div>
              <div>
                <label className="text-slate-500 block mb-1">Tax rate percentage (%) *</label>
                <input
                  type="number"
                  required
                  value={bizTax}
                  onChange={(e) => setBizTax(e.target.value)}
                  placeholder="20"
                  className="w-full border border-slate-200 bg-slate-50 p-2 rounded-lg focus:outline-hidden font-mono text-center font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Support Contact Number *</label>
                <input
                  type="text"
                  required
                  value={bizPhone}
                  onChange={(e) => setBizPhone(e.target.value)}
                  placeholder="+44 20 ..."
                  className="w-full border border-slate-202 bg-slate-50 p-2 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Company Headquarters Business Address *</label>
                <input
                  type="text"
                  required
                  value={bizAddress}
                  onChange={(e) => setBizAddress(e.target.value)}
                  placeholder="Full street address..."
                  className="w-full border border-slate-202 bg-slate-50 p-2 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-500 block mb-1">Thermal Receipt Footer Notes</label>
              <textarea
                value={bizFooter}
                onChange={(e) => setBizFooter(e.target.value)}
                placeholder="Receipt closure text greetings..."
                className="w-full border border-slate-200 bg-slate-50 p-2 rounded-lg h-24 resize-none leading-relaxed"
              />
            </div>

            <button
              type="submit"
              className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-750 text-white font-mono text-xs font-bold rounded-lg cursor-pointer transition"
            >
              Update Config Profile
            </button>
          </form>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setStaffModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-755 text-white rounded-lg text-xs font-mono font-bold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Employee Account
            </button>
          </div>

          <div className="bg-white border text-xs text-slate-700 shadow-3xs rounded-xl overflow-hiddenCombined">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/70 border-b uppercase font-mono tracking-wider text-slate-500">
                  <th className="px-5 py-3">Team Member Name</th>
                  <th className="px-5 py-3">Authenticating Email</th>
                  <th className="px-5 py-3">Access Level Level</th>
                  <th className="px-5 py-3">Assigned Terminal</th>
                  <th className="px-5 py-3 text-right">Status Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {staff.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/20">
                    <td className="px-5 py-4 font-bold text-slate-900">{u.name}</td>
                    <td className="px-5 py-4 font-mono text-slate-500">{u.email}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded-full font-bold font-mono text-[9px] ${u.role === 'Admin' ? 'bg-indigo-50 text-indigo-850' : u.role === 'Manager' ? 'bg-amber-50 text-amber-850' : 'bg-slate-100 text-slate-650'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500 leading-tight">{u.branchName}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleToggleDeactivate(u)}
                        className={`text-[10px] font-mono font-bold py-1 px-2.5 border rounded-lg cursor-pointer transition ${u.isDeactivated ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-850 border-rose-220/80'}`}
                      >
                        {u.isDeactivated ? 'Activate Credentials' : 'Deactivate employee'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'audits' && (
        <div className="bg-white border border-slate-200 shadow-3xs rounded-xl overflow-hidden select-none">
          <div className="overflow-x-auto max-h-[480px] scrollbar-thin">
            <table className="w-full text-left text-xs text-slate-650">
              <thead>
                <tr className="bg-slate-50/70 text-slate-500 border-b uppercase font-mono tracking-wider sticky top-0 bg-white z-10 shadow-xs">
                  <th className="px-5 py-3">Action timestamp</th>
                  <th className="px-5 py-3">Origin Auditor</th>
                  <th className="px-5 py-3">Operation classification</th>
                  <th className="px-5 py-3">Audit logs values / details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans text-xs">
                {auditLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50/20">
                    <td className="px-5 py-3 font-mono text-slate-400 whitespace-nowrap">{new Date(log.createdAt).toLocaleString('en-GB')}</td>
                    <td className="px-5 py-3 font-semibold text-slate-800 whitespace-nowrap">{log.userName}</td>
                    <td className="px-5 py-3 uppercase tracking-wide font-mono text-[10px] font-bold text-indigo-650 whitespace-nowrap">{log.action}</td>
                    <td className="px-5 py-3 text-slate-550 leading-relaxed text-[11px]">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STAFF CREATE ACCOUNT MODAL */}
      {staffModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-slate-202 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-sans font-extrabold text-slate-900 uppercase">Deploy employee Credentials</h3>

            <form onSubmit={handleAddStaff} className="space-y-3.5 text-xs font-sans">
              <div>
                <label className="text-slate-500 block mb-1">Full Employee Name *</label>
                <input
                  type="text"
                  required
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  placeholder="Sarah Jenkins"
                  className="w-full border border-slate-200 bg-slate-50 p-2 rounded-lg focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-slate-500 block mb-1">Access / Credentials Email *</label>
                <input
                  type="email"
                  required
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  placeholder="name@pos.com"
                  className="w-full border border-slate-200 bg-slate-50 p-2 rounded-lg focus:outline-hidden font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-slate-500 block mb-1">System Privileges *</label>
                  <select
                    value={staffRole}
                    onChange={(e: any) => setStaffRole(e.target.value)}
                    className="w-full border select-none text-slate-700 bg-slate-50 p-2 rounded-lg"
                  >
                    <option value="Cashier">Cashier</option>
                    <option value="Manager">Manager</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-500 block mb-1">Gateway terminal *</label>
                  <select
                    value={staffBranch}
                    onChange={(e: any) => setStaffBranch(e.target.value)}
                    className="w-full border select-none text-slate-700 bg-slate-50 p-2 rounded-lg"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-2.5 bg-amber-50 text-amber-850 border border-amber-200 rounded-lg text-[10px] font-mono leading-relaxed">
                <span className="font-bold uppercase block mb-0.5">Note on defaults password setup:</span>
                New staff accounts initialize with default passcode loops matching role designations (e.g. <code>admin123</code>, <code>manager123</code>, <code>cashier123</code>).
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setStaffModalOpen(false)} className="py-2 px-3 hover:bg-slate-50 border rounded-lg font-mono">Cancel</button>
                <button type="submit" className="py-2 px-4 bg-indigo-600 text-white rounded-lg font-bold font-mono">Deploy</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
