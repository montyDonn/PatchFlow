import { useEffect, useState, useCallback } from 'react';
import {
  Users, Layers, Plus, Pencil, Trash2, Save, X,
  RefreshCcw, KeyRound, UserCheck, UserX, ChevronDown,
  CheckCircle, AlertCircle, Shield, ClipboardList,
  Phone, ThumbsUp, ThumbsDown, Clock, Ban
} from 'lucide-react';
import {
  getUsers, createUser, updateUser, deleteUser,
  reactivateUser, resetPassword, updateUserModules,
} from '../api/users';
import type { User } from '../api/users';
import { getModules, createModule, updateModule, deleteModule } from '../api/modules';
import type { Module } from '../api/modules';
import {
  getAccountRequests, approveAccountRequest, rejectAccountRequest,
} from '../api/accountRequests';
import type { AccountRequest } from '../api/accountRequests';
import { useAuthStore } from '../store/authStore';

// ─── Types ─────────────────────────────────────────────────────────────────

type Tab = 'users' | 'modules' | 'requests';

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

// ─── Toast System ───────────────────────────────────────────────────────────

let toastId = 0;

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((type: 'success' | 'error', message: string) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  return { toasts, push };
}

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-medium backdrop-blur-sm border transition-all
            ${t.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/90 border-red-500/40 text-red-200'
            }`}
        >
          {t.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Role badge ──────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  ADMIN:       'bg-blue-500/20 text-blue-300 border-blue-500/30',
  MANAGER:     'bg-amber-500/20 text-amber-300 border-amber-500/30',
  DEVELOPER:   'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  VERIFIER:    'bg-pink-500/20 text-pink-300 border-pink-500/30',
  CLIENT:      'bg-green-500/20 text-green-300 border-green-500/30',
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${ROLE_COLORS[role] || 'bg-gray-700/50 text-gray-300 border-gray-600'}`}>
      {role.replace('_', ' ')}
    </span>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-50 w-full max-w-lg rounded-3xl border border-gray-700 bg-gray-950 shadow-2xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Input / Select helpers ──────────────────────────────────────────────────

const inputCls = 'w-full rounded-xl border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white outline-none focus:border-primary-500 transition';
const labelCls = 'block text-xs text-gray-400 mb-1';

// ─── Create User Modal ───────────────────────────────────────────────────────

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'DEVELOPER', designation: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.password || !form.name) { setError('Username, password, and name are required.'); return; }
    setSaving(true);
    try {
      await createUser({ ...form, designation: form.designation || undefined });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create user.');
    } finally { setSaving(false); }
  };

  return (
    <Modal title="Create New User" onClose={onClose}>
      <form onSubmit={handle} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Full Name *</label>
            <input className={inputCls} placeholder="Jane Doe" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Username *</label>
            <input className={inputCls} placeholder="jane.doe" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Password *</label>
            <input className={inputCls} type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Role</label>
            <select className={inputCls} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'DEVELOPER', 'VERIFIER', 'CLIENT'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Designation (optional)</label>
            <input className={inputCls} placeholder="e.g. Senior Developer" value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} />
          </div>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-700 text-sm text-gray-400 hover:bg-gray-800 transition">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-primary-500 text-sm font-semibold text-white hover:bg-primary-400 transition disabled:opacity-60">
            {saving ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit User Modal ─────────────────────────────────────────────────────────

function EditUserModal({ user, modules, onClose, onSaved }: {
  user: User; modules: Module[]; onClose: () => void; onSaved: () => void;
}) {
  const currentUser = useAuthStore(state => state.user);
  const [tab, setTab] = useState<'details' | 'modules'>('details');
  const [form, setForm] = useState({ name: user.name, username: user.username, role: user.role, designation: user.designation || '' });
  const [selectedModules, setSelectedModules] = useState<string[]>(user.modules?.map(m => m.id) || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tempPwd, setTempPwd] = useState('');

  const saveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await updateUser(user.userId, {
        name: form.name !== user.name ? form.name : undefined,
        username: form.username !== user.username ? form.username : undefined,
        role: form.role !== user.role ? form.role : undefined,
        designation: form.designation !== (user.designation || '') ? (form.designation || undefined) : undefined,
      });
      onSaved();
      onClose();
    } catch (err: any) { setError(err?.response?.data?.error || 'Failed to save.'); }
    finally { setSaving(false); }
  };

  const saveModules = async () => {
    if (selectedModules.length > 5) { setError('Max 5 modules per user.'); return; }
    setSaving(true); setError('');
    try {
      await updateUserModules(user.userId, selectedModules);
      onSaved();
      onClose();
    } catch (err: any) { setError(err?.response?.data?.error || 'Failed to save modules.'); }
    finally { setSaving(false); }
  };

  const handleResetPwd = async () => {
    setSaving(true); setError('');
    try {
      const res = await resetPassword(user.userId);
      setTempPwd(res.tempPassword);
    } catch (err: any) { setError(err?.response?.data?.error || 'Failed to reset password.'); }
    finally { setSaving(false); }
  };

  const toggleModule = (id: string) => {
    setSelectedModules(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <Modal title={`Edit — ${user.name}`} onClose={onClose}>
      <div className="flex gap-2 mb-5 border-b border-gray-800 pb-3">
        {(['details', 'modules'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${tab === t ? 'bg-primary-500/20 text-primary-400' : 'text-gray-500 hover:text-gray-300'}`}
          >{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {tab === 'details' && (
        <form onSubmit={saveDetails} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Full Name</label>
              <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Username</label>
              <input className={inputCls} value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Role</label>
              <select className={inputCls} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                disabled={user.userId === currentUser?.id}>
                {['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'DEVELOPER', 'VERIFIER', 'CLIENT'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Designation</label>
              <input className={inputCls} placeholder="e.g. Senior Developer" value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} />
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          {tempPwd && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
              Temporary password: <span className="font-mono font-bold">{tempPwd}</span> — share this with the user.
            </div>
          )}
          <div className="flex justify-between items-center pt-1">
            <button type="button" onClick={handleResetPwd} disabled={saving}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-700 text-xs text-gray-400 hover:border-amber-500/40 hover:text-amber-300 transition">
              <KeyRound size={13} /> Reset Password
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-700 text-sm text-gray-400 hover:bg-gray-800 transition">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-primary-500 text-sm font-semibold text-white hover:bg-primary-400 transition disabled:opacity-60">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      )}

      {tab === 'modules' && (
        <div className="space-y-4">
          <p className="text-xs text-gray-400">Select up to 5 modules for this user.</p>
          <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
            {modules.filter(m => m.isActive).map(m => (
              <label key={m.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition text-sm
                  ${selectedModules.includes(m.id)
                    ? 'border-primary-500/50 bg-primary-500/10 text-white'
                    : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600'
                  }`}>
                <input type="checkbox" className="hidden" checked={selectedModules.includes(m.id)} onChange={() => toggleModule(m.id)} />
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${selectedModules.includes(m.id) ? 'bg-primary-500 border-primary-500' : 'border-gray-600'}`}>
                  {selectedModules.includes(m.id) && <div className="w-2 h-2 rounded-sm bg-white" />}
                </div>
                {m.name}
              </label>
            ))}
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-700 text-sm text-gray-400 hover:bg-gray-800 transition">Cancel</button>
            <button onClick={saveModules} disabled={saving} className="px-4 py-2 rounded-xl bg-primary-500 text-sm font-semibold text-white hover:bg-primary-400 transition disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Modules'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Create Module Modal ─────────────────────────────────────────────────────

function CreateModuleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Module name is required.'); return; }
    setSaving(true);
    try {
      await createModule({ name: name.trim(), description: description.trim() });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create module.');
    } finally { setSaving(false); }
  };

  return (
    <Modal title="Create New Module" onClose={onClose}>
      <form onSubmit={handle} className="space-y-4">
        <div>
          <label className={labelCls}>Module Name *</label>
          <input className={inputCls} placeholder="e.g. BILLING" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <textarea className={`${inputCls} min-h-[90px] resize-none`} placeholder="Optional description" value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-700 text-sm text-gray-400 hover:bg-gray-800 transition">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-primary-500 text-sm font-semibold text-white hover:bg-primary-400 transition disabled:opacity-60">
            {saving ? 'Creating…' : 'Create Module'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Users Tab ───────────────────────────────────────────────────────────────

function UsersTab({ push }: { push: (type: 'success' | 'error', message: string) => void }) {
  const currentUser = useAuthStore(state => state.user);
  const [users, setUsers] = useState<User[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, modulesRes] = await Promise.all([
        getUsers(undefined, true),
        getModules(false),
      ]);
      // Also fetch inactive users by making a second request with includeInactive=true
      const inactiveRes = await import('../api/users').then(m => m.getAllUsers());
      // Merge: deduplicate by userId
      const allMap = new Map<string, User>();
      usersRes.forEach(u => allMap.set(u.userId, u));
      inactiveRes.forEach(u => allMap.set(u.userId, u));
      setUsers(Array.from(allMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
      setModules(modulesRes);
    } catch {
      push('error', 'Failed to load users.');
    } finally { setLoading(false); }
  }, [push]);

  useEffect(() => { load(); }, [load]);

  const handleDeactivate = async (u: User) => {
    if (!confirm(`Deactivate ${u.name}? They will lose access immediately.`)) return;
    try {
      await deleteUser(u.userId);
      push('success', `${u.name} has been deactivated.`);
      load();
    } catch (err: any) { push('error', err?.response?.data?.error || 'Failed to deactivate user.'); }
  };

  const handleReactivate = async (u: User) => {
    try {
      await reactivateUser(u.userId);
      push('success', `${u.name} has been reactivated.`);
      load();
    } catch (err: any) { push('error', err?.response?.data?.error || 'Failed to reactivate user.'); }
  };

  const filtered = users
    .filter(u => showInactive ? true : u.isActive !== false)
    .filter(u => !roleFilter || u.role === roleFilter)
    .filter(u => {
      if (!searchFilter) return true;
      const q = searchFilter.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
    });

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <input
            placeholder="Search name or username…"
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            className="rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-primary-500 w-52"
          />
          <div className="relative">
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="appearance-none rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 pr-8 text-sm text-white outline-none focus:border-primary-500"
            >
              <option value="">All Roles</option>
              {['SUPER_ADMIN','ADMIN','MANAGER','DEVELOPER','VERIFIER','CLIENT'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-2.5 text-gray-500 pointer-events-none" size={14} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
            <div onClick={() => setShowInactive(v => !v)}
              className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${showInactive ? 'bg-primary-500' : 'bg-gray-700'}`}>
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${showInactive ? 'translate-x-4' : ''}`} />
            </div>
            Show inactive
          </label>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 transition">
            <RefreshCcw size={14} /> Refresh
          </button>
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-400 transition">
            <Plus size={14} /> New User
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-700 bg-gray-950/80">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-gray-900/70 text-gray-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-5 py-3">User</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Designation</th>
              <th className="px-5 py-3">Modules</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">Loading users…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">No users found.</td></tr>
            ) : filtered.map(u => (
              <tr key={u.userId} className={`hover:bg-white/[0.03] transition ${!u.isActive ? 'opacity-50' : ''}`}>
                <td className="px-5 py-4">
                  <div className="font-medium text-white">{u.name}</div>
                  <div className="text-xs text-gray-500">@{u.username}</div>
                </td>
                <td className="px-5 py-4"><RoleBadge role={u.role} /></td>
                <td className="px-5 py-4 text-gray-400">{u.designation || '—'}</td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-1">
                    {(u.modules || []).length === 0
                      ? <span className="text-gray-600 text-xs">None</span>
                      : u.modules!.map(m => (
                        <span key={m.id} className="rounded-full bg-gray-800 border border-gray-700 px-2 py-0.5 text-xs text-gray-300">{m.name}</span>
                      ))
                    }
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.isActive !== false ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
                    {u.isActive !== false ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditUser(u)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-300 hover:border-primary-500/50 hover:text-white transition"
                    >
                      <Pencil size={12} /> Edit
                    </button>
                    {u.userId !== currentUser?.id && (
                      u.isActive !== false ? (
                        <button onClick={() => handleDeactivate(u)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-red-400 hover:border-red-500/40 hover:bg-red-500/10 transition">
                          <UserX size={12} /> Deactivate
                        </button>
                      ) : (
                        <button onClick={() => handleReactivate(u)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-emerald-400 hover:border-emerald-500/40 hover:bg-emerald-500/10 transition">
                          <UserCheck size={12} /> Reactivate
                        </button>
                      )
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs text-gray-500">
        <span>{users.filter(u => u.isActive !== false).length} active</span>
        <span>·</span>
        <span>{users.filter(u => u.isActive === false).length} inactive</span>
        <span>·</span>
        <span>{users.length} total</span>
      </div>

      {/* Modals */}
      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={() => { load(); push('success', 'User created successfully.'); }} />}
      {editUser && <EditUserModal user={editUser} modules={modules} onClose={() => setEditUser(null)} onSaved={() => { load(); push('success', 'User updated successfully.'); }} />}
    </div>
  );
}

// ─── Modules Tab ─────────────────────────────────────────────────────────────

function ModulesTab({ push }: { push: (type: 'success' | 'error', message: string) => void }) {
  const currentUser = useAuthStore(state => state.user);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getModules(true);
      setModules(data);
    } catch { push('error', 'Failed to load modules.'); }
    finally { setLoading(false); }
  }, [push]);

  useEffect(() => { load(); }, [load]);

  const beginEdit = (m: Module) => { setEditingId(m.id); setEditName(m.name); setEditDescription(m.description || ''); };
  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (moduleId: string) => {
    if (!editName.trim()) { push('error', 'Module name is required.'); return; }
    setSaving(true);
    try {
      await updateModule(moduleId, { name: editName.trim(), description: editDescription.trim() });
      setEditingId(null);
      load();
      push('success', 'Module updated.');
    } catch (err: any) { push('error', err?.response?.data?.error || 'Failed to update module.'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (m: Module) => {
    setSaving(true);
    try {
      await updateModule(m.id, { isActive: !m.isActive });
      load();
      push('success', m.isActive ? 'Module deactivated.' : 'Module activated.');
    } catch (err: any) { push('error', err?.response?.data?.error || 'Failed to update module.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (m: Module) => {
    if (!confirm(`Permanently delete "${m.name}"? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await deleteModule(m.id);
      load();
      push('success', `Module "${m.name}" deleted.`);
    } catch (err: any) { push('error', err?.response?.data?.error || 'Failed to delete module.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">{modules.length} modules total · {modules.filter(m => m.isActive).length} active</div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 transition">
            <RefreshCcw size={14} /> Refresh
          </button>
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-400 transition">
            <Plus size={14} /> New Module
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-700 bg-gray-950/80">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-gray-900/70 text-gray-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-5 py-3">Module</th>
              <th className="px-5 py-3">Description</th>
              <th className="px-5 py-3">Users</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500">Loading modules…</td></tr>
            ) : modules.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500">No modules yet.</td></tr>
            ) : modules.map(m => (
              <tr key={m.id} className="hover:bg-white/[0.03] transition">
                <td className="px-5 py-4 min-w-[160px]">
                  {editingId === m.id
                    ? <input className={inputCls} value={editName} onChange={e => setEditName(e.target.value)} />
                    : <span className="font-semibold text-white">{m.name}</span>}
                </td>
                <td className="px-5 py-4 max-w-xs">
                  {editingId === m.id
                    ? <textarea className={`${inputCls} min-h-[52px] resize-none`} value={editDescription} onChange={e => setEditDescription(e.target.value)} />
                    : <span className="text-gray-400">{m.description || '—'}</span>}
                </td>
                <td className="px-5 py-4 text-gray-400">{m.users?.length ?? 0}</td>
                <td className="px-5 py-4">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${m.isActive ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
                    {m.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    {editingId === m.id ? (
                      <>
                        <button onClick={() => saveEdit(m.id)} disabled={saving}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-400 transition disabled:opacity-60">
                          <Save size={12} /> Save
                        </button>
                        <button onClick={cancelEdit} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-800 transition">
                          <X size={12} /> Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => beginEdit(m)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-300 hover:border-primary-500/50 hover:text-white transition">
                          <Pencil size={12} /> Edit
                        </button>
                        <button onClick={() => toggleActive(m)} disabled={saving}
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition disabled:opacity-60
                            ${m.isActive
                              ? 'border-gray-700 bg-gray-900 text-gray-400 hover:border-amber-500/40 hover:text-amber-300'
                              : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-emerald-500/40 hover:text-emerald-300'
                            }`}>
                          {m.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        {isSuperAdmin && (
                          <button onClick={() => handleDelete(m)} disabled={saving}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-red-400 hover:border-red-500/40 hover:bg-red-500/10 transition disabled:opacity-60">
                            <Trash2 size={12} /> Delete
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateModuleModal onClose={() => setShowCreate(false)} onCreated={() => { load(); push('success', 'Module created.'); }} />}
    </div>
  );
}

// ─── Requests Tab ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  PENDING:  { label: 'Pending',  icon: <Clock size={12} />,   cls: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  APPROVED: { label: 'Approved', icon: <ThumbsUp size={12} />, cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
  REJECTED: { label: 'Rejected', icon: <Ban size={12} />,      cls: 'bg-red-500/10 text-red-300 border-red-500/30' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['PENDING'];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function RejectModal({ onConfirm, onClose }: { onConfirm: (note: string) => void; onClose: () => void }) {
  const [note, setNote] = useState('');
  return (
    <Modal title="Reject Request" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-400">Optionally provide a reason for rejection. This will be recorded.</p>
        <div>
          <label className={labelCls}>Rejection Note (optional)</label>
          <textarea
            className={`${inputCls} min-h-[90px] resize-none`}
            placeholder="e.g. Username policy violation, duplicate request…"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-700 text-sm text-gray-400 hover:bg-gray-800 transition">Cancel</button>
          <button
            onClick={() => onConfirm(note)}
            className="px-4 py-2 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-500 transition"
          >
            Reject Request
          </button>
        </div>
      </div>
    </Modal>
  );
}

function RequestsTab({ push, onPendingCount }: {
  push: (type: 'success' | 'error', message: string) => void;
  onPendingCount: (n: number) => void;
}) {
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'' | 'PENDING' | 'APPROVED' | 'REJECTED'>('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AccountRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAccountRequests(statusFilter || undefined);
      setRequests(data);
      const pending = data.filter(r => r.status === 'PENDING').length;
      onPendingCount(pending);
    } catch {
      push('error', 'Failed to load account requests.');
    } finally { setLoading(false); }
  }, [statusFilter, push, onPendingCount]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (req: AccountRequest) => {
    if (!confirm(`Approve account request for "${req.name}" (@${req.username})?\n\nThis will create an active ${req.role} account immediately.`)) return;
    setActionId(req.id);
    try {
      await approveAccountRequest(req.id);
      push('success', `Account for @${req.username} approved and created.`);
      load();
    } catch (err: any) {
      push('error', err?.response?.data?.error || 'Failed to approve request.');
    } finally { setActionId(null); }
  };

  const handleReject = async (req: AccountRequest, note: string) => {
    setRejectTarget(null);
    setActionId(req.id);
    try {
      await rejectAccountRequest(req.id, note || undefined);
      push('success', `Request from @${req.username} rejected.`);
      load();
    } catch (err: any) {
      push('error', err?.response?.data?.error || 'Failed to reject request.');
    } finally { setActionId(null); }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Status filter pills */}
          <div className="flex gap-1.5">
            {(['', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition
                  ${statusFilter === s
                    ? 'bg-primary-500/20 border-primary-500/50 text-primary-300'
                    : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                  }`}
              >
                {s === '' ? 'All' : STATUS_CONFIG[s].label}
                {s === 'PENDING' && pendingCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-[10px] font-bold text-white">{pendingCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 transition">
          <RefreshCcw size={14} /> Refresh
        </button>
      </div>

      {/* Summary strip */}
      {!statusFilter && (
        <div className="flex gap-6 px-4 py-3 rounded-xl border border-gray-800 bg-gray-900/50 text-xs">
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-amber-400" />
            <span className="text-gray-400">Pending:</span>
            <span className="font-bold text-amber-300">{requests.filter(r => r.status === 'PENDING').length}</span>
          </div>
          <div className="flex items-center gap-2">
            <ThumbsUp size={13} className="text-emerald-400" />
            <span className="text-gray-400">Approved:</span>
            <span className="font-bold text-emerald-300">{requests.filter(r => r.status === 'APPROVED').length}</span>
          </div>
          <div className="flex items-center gap-2">
            <Ban size={13} className="text-red-400" />
            <span className="text-gray-400">Rejected:</span>
            <span className="font-bold text-red-300">{requests.filter(r => r.status === 'REJECTED').length}</span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-700 bg-gray-950/80">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-gray-900/70 text-gray-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-5 py-3">Applicant</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Phone</th>
              <th className="px-5 py-3">Requested On</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Review Note</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-500">Loading requests…</td></tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-600">
                    <ClipboardList size={28} />
                    <span>No account requests found.</span>
                  </div>
                </td>
              </tr>
            ) : requests.map(req => (
              <tr
                key={req.id}
                className={`hover:bg-white/[0.02] transition ${
                  req.status !== 'PENDING' ? 'opacity-60' : ''
                }`}
              >
                <td className="px-5 py-4">
                  <div className="font-medium text-white">{req.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">@{req.username}</div>
                </td>
                <td className="px-5 py-4">
                  <RoleBadge role={req.role} />
                </td>
                <td className="px-5 py-4">
                  {req.phone ? (
                    <span className="inline-flex items-center gap-1.5 text-gray-300 text-xs">
                      <Phone size={11} className="text-gray-500" />{req.phone}
                    </span>
                  ) : <span className="text-gray-600 text-xs">—</span>}
                </td>
                <td className="px-5 py-4 text-gray-400 text-xs whitespace-nowrap">
                  {formatDate(req.createdAt)}
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={req.status} />
                  {req.status !== 'PENDING' && req.reviewedAt && (
                    <div className="text-[10px] text-gray-600 mt-1">{formatDate(req.reviewedAt)}</div>
                  )}
                </td>
                <td className="px-5 py-4 max-w-[180px]">
                  {req.reviewNote
                    ? <span className="text-xs text-gray-400 italic line-clamp-2">{req.reviewNote}</span>
                    : <span className="text-gray-700 text-xs">—</span>
                  }
                </td>
                <td className="px-5 py-4 text-right">
                  {req.status === 'PENDING' ? (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleApprove(req)}
                        disabled={actionId === req.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition disabled:opacity-50"
                      >
                        <ThumbsUp size={12} /> Approve
                      </button>
                      <button
                        onClick={() => setRejectTarget(req)}
                        disabled={actionId === req.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 transition disabled:opacity-50"
                      >
                        <ThumbsDown size={12} /> Reject
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-600">Reviewed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reject modal */}
      {rejectTarget && (
        <RejectModal
          onClose={() => setRejectTarget(null)}
          onConfirm={(note) => handleReject(rejectTarget, note)}
        />
      )}
    </div>
  );
}

// ─── Admin Page ───────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('users');
  const [pendingCount, setPendingCount] = useState(0);
  const { toasts, push } = useToasts();

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start gap-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary-500/10 border border-primary-500/20">
          <Shield className="text-primary-400" size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Admin Panel</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage users, roles, modules, and access requests.</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-2xl border border-gray-700 bg-gray-900/50 w-fit">
        <button
          onClick={() => setTab('users')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition
            ${tab === 'users' ? 'bg-primary-500 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
        >
          <Users size={15} /> Users
        </button>
        <button
          onClick={() => setTab('modules')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition
            ${tab === 'modules' ? 'bg-primary-500 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
        >
          <Layers size={15} /> Modules
        </button>
        <button
          onClick={() => setTab('requests')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition relative
            ${tab === 'requests' ? 'bg-primary-500 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
        >
          <ClipboardList size={15} /> Requests
          {pendingCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-[10px] font-bold text-white -mt-0.5">
              {pendingCount > 99 ? '99+' : pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      <div>
        {tab === 'users' && <UsersTab push={push} />}
        {tab === 'modules' && <ModulesTab push={push} />}
        {tab === 'requests' && (
          <RequestsTab push={push} onPendingCount={setPendingCount} />
        )}
      </div>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
