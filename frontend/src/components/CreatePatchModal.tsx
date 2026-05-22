import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import api from '../api/client';
import { createTask } from '../api/tasks';
import type { Module, TaskUser } from '../api/tasks';
import { useAuthStore } from '../store/authStore';

interface CreatePatchModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const normalizeUser = (user: any): TaskUser => ({
  ...user,
  id: user.id || user.userId,
});

const normalizeModule = (module: any): Module => ({
  id: module.id || module.moduleId,
  name: module.name || module.moduleName,
});

export function CreatePatchModal({ open, onClose, onCreated }: CreatePatchModalProps) {
  const currentUser = useAuthStore((state) => state.user);
  const isClient = currentUser?.role === 'CLIENT';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientRequestId, setClientRequestId] = useState('0');
  const [moduleId, setModuleId] = useState('');
  const [selectedManagerIds, setSelectedManagerIds] = useState<string[]>([]);
  const [selectedDeveloperIds, setSelectedDeveloperIds] = useState<string[]>([]);
  const [selectedVerifierIds, setSelectedVerifierIds] = useState<string[]>([]);
  const [dateGiven, setDateGiven] = useState(new Date().toISOString().split('T')[0]);
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [plannedEndDate, setPlannedEndDate] = useState('');
 
  const [modules, setModules] = useState<Module[]>([]);
  const [users, setUsers] = useState<TaskUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
 
  useEffect(() => {
    if (!open) return;
 
    setLoading(true);
    Promise.all([api.get('/modules'), api.get('/users?includeModules=true')])
      .then(([modulesRes, usersRes]) => {
        setModules((modulesRes.data || []).map(normalizeModule));
        setUsers((usersRes.data || []).map(normalizeUser));
      })
      .catch((err) => {
        console.error(err);
        setError('Unable to load module or user options.');
      })
      .finally(() => setLoading(false));
  }, [open]);
 

  const managerUsers = users.filter((user) => user.role === 'MANAGER' || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN');
  const developerUsers = users.filter((user) => user.role === 'DEVELOPER');
  const verifierUsers = users.filter((user) => user.role === 'VERIFIER');
  const clientUsers = users.filter((user) => user.role === 'CLIENT');
 
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
 
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required.');
      return;
    }
 
    if (!moduleId) {
      setError('Module is required.');
      return;
    }
 
    if (selectedManagerIds.length === 0) {
      setError('Please assign at least one Manager for this patch request.');
      return;
    }
 
    if (!dateGiven) {
      setError('Date Given is required.');
      return;
    }
 
    setSaving(true);
    try {
      await createTask({
        title: title.trim(),
        description: description.trim(),
        moduleId,
        clientId: isClient ? currentUser?.id : (clientId || undefined),
        clientRequestId: isClient || clientId ? (parseInt(clientRequestId) || 0) : 0,
        managerIds: selectedManagerIds,
        developerIds: selectedDeveloperIds,
        verifierIds: selectedVerifierIds,
        dateGiven: dateGiven ? new Date(dateGiven).toISOString() : undefined,
        lifecycleStatus: 0,
        plannedStartDate: plannedStartDate || undefined,
        plannedEndDate: plannedEndDate || undefined,
      });

      setTitle('');
      setDescription('');
      setClientId('');
      setClientRequestId('0');
      setModuleId('');
      setSelectedManagerIds([]);
      setSelectedDeveloperIds([]);
      setSelectedVerifierIds([]);
      setDateGiven(new Date().toISOString().split('T')[0]);
      setPlannedStartDate('');
      setPlannedEndDate('');
      onCreated?.();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.error || 'Failed to create patch.');
    } finally {
      setSaving(false);
    }
  };

  const renderUserSelector = (
    label: string,
    allUsersOfRole: TaskUser[],
    selectedIds: string[],
    setSelectedIds: (ids: string[]) => void
  ) => {
    const handleToggle = (id: string) => {
      if (selectedIds.includes(id)) {
        setSelectedIds(selectedIds.filter((x) => x !== id));
      } else {
        setSelectedIds([...selectedIds, id]);
      }
    };

    return (
      <div className="space-y-2">
        <span className="block text-sm text-gray-400 font-medium">{label}</span>
        <div className="max-h-36 overflow-y-auto rounded-2xl border border-gray-750 bg-gray-900 p-2.5 space-y-1.5 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
          {allUsersOfRole.length === 0 && (
            <div className="text-xs text-gray-500 p-1">No users found.</div>
          )}
          {allUsersOfRole.map((user) => (
            <label
              key={user.id || user.userId}
              className="flex items-center gap-2.5 text-sm text-white cursor-pointer hover:bg-gray-800/40 px-2 py-1 rounded-xl transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(user.id || user.userId || '')}
                onChange={() => handleToggle(user.id || user.userId || '')}
                className="rounded border-gray-700 bg-gray-850 text-primary-500 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
              />
              <span className="truncate">{user.name || user.username}</span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-3xl border border-gray-700 bg-gray-950/95 p-6 shadow-2xl text-white">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-primary-400/80">Create Patch</div>
            <h2 className="mt-2 text-2xl font-semibold">New patch request</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-3 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {error && <div className="rounded-2xl border border-danger-500/30 bg-danger-500/10 px-4 py-3 text-sm text-danger-200">{error}</div>}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-gray-400">
              Patch Name
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-primary-500"
                placeholder="Enter patch title"
                required
              />
            </label>

            <label className="space-y-2 text-sm text-gray-400">
              Module
              <select
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                required
                className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-primary-500"
              >
                <option value="">Select module</option>
                {modules.map((mod) => (
                  <option key={mod.id} value={mod.id}>{mod.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {!isClient ? (
              <label className="space-y-2 text-sm text-gray-400">
                Client Assignment (Optional)
                <select
                  value={clientId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setClientId(val);
                    if (!val) {
                      setClientRequestId('0');
                    }
                  }}
                  className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-primary-500"
                >
                  <option value="">No Client (Internal Request)</option>
                  {clientUsers.map((user) => (
                    <option key={user.id || user.userId} value={user.id || user.userId}>
                      {user.name || user.username || 'Unnamed'}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="space-y-2 text-sm text-gray-400">
                <span>Requesting Client</span>
                <div className="w-full rounded-2xl border border-gray-800 bg-gray-900/50 px-4 py-3 text-gray-300">
                  {currentUser?.name || currentUser?.username}
                </div>
              </div>
            )}

            <label className="space-y-2 text-sm text-gray-400">
              Client Request ID / Reference No
              <input
                type="number"
                value={clientRequestId}
                onChange={(e) => setClientRequestId(e.target.value)}
                disabled={!isClient && !clientId}
                className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-primary-500 disabled:opacity-55 disabled:cursor-not-allowed"
                placeholder="0 for internal requests"
                required
              />
            </label>
          </div>

          <div className="border-t border-gray-850 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-400 mb-3">Resource Assignments</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {renderUserSelector('Managers *', managerUsers, selectedManagerIds, setSelectedManagerIds)}
              {renderUserSelector('Developers', developerUsers, selectedDeveloperIds, setSelectedDeveloperIds)}
              {renderUserSelector('Verifiers', verifierUsers, selectedVerifierIds, setSelectedVerifierIds)}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-2 text-sm text-gray-400">
              Date Given
              <input
                type="date"
                value={dateGiven}
                onChange={(e) => setDateGiven(e.target.value)}
                required
                className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-primary-500"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-400">
              Planned start date
              <input
                type="date"
                value={plannedStartDate}
                onChange={(e) => setPlannedStartDate(e.target.value)}
                className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-primary-500"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-400">
              Planned end date
              <input
                type="date"
                value={plannedEndDate}
                onChange={(e) => setPlannedEndDate(e.target.value)}
                className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-primary-500"
              />
            </label>
          </div>

          <label className="space-y-2 text-sm text-gray-400">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[120px] w-full rounded-3xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-primary-500"
              placeholder="Describe the patch requirements and scope..."
              required
            />
          </label>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end mt-4">
            <button type="button" onClick={onClose} className="rounded-2xl border border-gray-700 px-5 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || loading} className="inline-flex items-center justify-center rounded-2xl bg-primary-500 px-5 py-3 text-sm font-semibold text-white hover:bg-primary-400 transition-colors disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? 'Creating...' : 'Create Patch Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
