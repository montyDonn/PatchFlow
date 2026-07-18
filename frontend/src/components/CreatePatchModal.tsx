import { useEffect, useState, type FormEvent } from 'react';
import { X, Hash, Paperclip } from 'lucide-react';
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

/** Generate a Change ID in yyyymmddXXXX format.
 *  XXXX is a 4-digit counter that auto-increments per day and resets at midnight.
 *  State persisted in localStorage under key "cm_id_counter". */
function generateChangeId(): string {
  const now  = new Date();
  const yyyy = String(now.getFullYear());
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const dd   = String(now.getDate()).padStart(2, '0');
  const today = `${yyyy}${mm}${dd}`;

  const LS_KEY = 'cm_id_counter';
  let counter = 0;
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) {
      const { date, count } = JSON.parse(stored);
      // Reset counter if it's a new day
      counter = date === today ? (count + 1) : 0;
    }
    localStorage.setItem(LS_KEY, JSON.stringify({ date: today, count: counter }));
  } catch {
    // localStorage unavailable — just use 0
  }

  const seq = String(counter).padStart(4, '0');
  return `${today}${seq}`;
}

const CHANGE_TYPES = [
  { value: 'MODIFY', label: 'Modify' },
  { value: 'NEW_DEVELOPMENT', label: 'New Development' },
  { value: 'BUG_FIX', label: 'Bug Fix' },
];

export function CreatePatchModal({ open, onClose, onCreated }: CreatePatchModalProps) {
  const currentUser = useAuthStore((state) => state.user);
  const isClient = currentUser?.role === 'CLIENT';

  // Change ID (auto-generated on open)
  const [changeId, setChangeId] = useState('');

  // Core fields
  const [title, setTitle] = useState('');

  // 3-part description
  const [descTitle, setDescTitle]     = useState('');
  const [descType, setDescType]       = useState('MODIFY');
  const [descComments, setDescComments] = useState('');

  // Client phone
  const [clientPhone, setClientPhone] = useState('');
  
  // Requested Deadline (for Client)
  const [requestedDeadline, setRequestedDeadline] = useState('');

  const [clientId, setClientId]           = useState('');
  const [isInternal, setIsInternal]       = useState(false);
  const [moduleId, setModuleId]           = useState('');
  const [selectedManagerIds, setSelectedManagerIds] = useState<string[]>([]);
  const [selectedDeveloperIds, setSelectedDeveloperIds] = useState<string[]>([]);
  const [selectedTesterIds, setSelectedTesterIds] = useState<string[]>([]);
  const [selectedVerifierIds, setSelectedVerifierIds] = useState<string[]>([]);
  const [selectedDeployerIds, setSelectedDeployerIds] = useState<string[]>([]);
  const [dateGiven, setDateGiven]         = useState(new Date().toISOString().split('T')[0]);
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [plannedEndDate, setPlannedEndDate]     = useState('');
  const [selectedFile, setSelectedFile]         = useState<File | null>(null);

  const [modules, setModules] = useState<Module[]>([]);
  const [users, setUsers]     = useState<TaskUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setChangeId(generateChangeId());
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

  const managerUsers   = users.filter((u) => u.role === 'MANAGER' || u.role === 'SUPER_ADMIN');
  const developerUsers = users.filter((u) => u.role === 'DEVELOPER');
  const testerUsers    = users.filter((u) => u.role === 'TESTER');
  const verifierUsers  = users.filter((u) => u.role === 'VERIFIER');
  const deployerUsers  = users.filter((u) => u.role === 'DEPLOYER');
  const clientUsers    = users.filter((u) => u.role === 'CLIENT');

  /** Serialize 3-part description into a single string */
  const buildDescription = () => {
    const typeLabel = CHANGE_TYPES.find(t => t.value === descType)?.label || descType;
    const phonePart = clientPhone.trim() ? `\n[CLIENT_PHONE: ${clientPhone.trim()}]` : '';
    const deadlinePart = requestedDeadline.trim() ? `\n[CLIENT_DEADLINE: ${requestedDeadline.trim()}]` : '';
    return `[CHANGE_ID: ${changeId}] [TYPE: ${typeLabel}]\n[DESC: ${descTitle.trim()}]\n${descComments.trim()}${phonePart}${deadlinePart}`;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Change name is required.');
      return;
    }
    if (!descTitle.trim()) {
      setError('Description title is required.');
      return;
    }
    if (!descComments.trim()) {
      setError('Comments / details are required.');
      return;
    }
    if (!moduleId) {
      setError('Module is required.');
      return;
    }
    if (selectedManagerIds.length === 0) {
      setError('Please assign at least one Manager for this change request.');
      return;
    }
    if (isClient && !requestedDeadline) {
      setError('Requested Deadline is required.');
      return;
    }
    if (!dateGiven) {
      setError('Date Given is required.');
      return;
    }

    // Validate clientPhone if provided: must be exactly 10 digits
    if (!isInternal && (isClient || clientId) && clientPhone.trim()) {
      if (!/^\d{10}$/.test(clientPhone.trim())) {
        setError('Client Phone Number must be exactly 10 digits.');
        return;
      }
    }

    setSaving(true);
    try {
      const taskRes = await createTask({
        title: title.trim(),
        description: buildDescription(),
        moduleId,
        clientId: isInternal ? undefined : (isClient ? currentUser?.id : (clientId || undefined)),
        clientRequestId: 0,
        managerIds: selectedManagerIds,
        developerIds: selectedDeveloperIds,
        testerIds: selectedTesterIds,
        verifierIds: selectedVerifierIds,
        deployerIds: selectedDeployerIds,
        dateGiven: dateGiven ? new Date(dateGiven).toISOString() : undefined,
        lifecycleStatus: 0,
        plannedStartDate: plannedStartDate || undefined,
        plannedEndDate: plannedEndDate || undefined,
        isInternal,
      });

      // Upload file if selected
      if (selectedFile && taskRes?.id) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        await api.post(`/tasks/${taskRes.id}/attachments`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      }

      // Reset form
      setTitle('');
      setDescTitle('');
      setDescType('MODIFY');
      setDescComments('');
      setClientPhone('');
      setClientId('');
      setIsInternal(false);
      setModuleId('');
      setSelectedManagerIds([]);
      setSelectedDeveloperIds([]);
      setSelectedTesterIds([]);
      setSelectedVerifierIds([]);
      setSelectedDeployerIds([]);
      setDateGiven(new Date().toISOString().split('T')[0]);
      setPlannedStartDate('');
      setPlannedEndDate('');
      setRequestedDeadline('');
      setSelectedFile(null);
      onCreated?.();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.error || 'Failed to create change request.');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[95vw] md:max-w-2xl lg:max-w-4xl rounded-3xl border border-gray-700 bg-gray-950/95 p-4 sm:p-6 shadow-2xl text-white max-h-[95vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-primary-400/80">Change Management</div>
            <h2 className="mt-2 text-2xl font-semibold">New change request</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-3 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Change ID Badge */}
        <div className="flex items-center gap-2 mb-5 bg-primary-500/10 border border-primary-500/20 rounded-xl px-4 py-2.5">
          <Hash size={14} className="text-primary-400" />
          <span className="text-xs text-gray-400 font-medium">Change ID:</span>
          <span className="text-sm font-bold text-primary-300 font-mono tracking-widest">{changeId}</span>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {error && <div className="rounded-2xl border border-danger-500/30 bg-danger-500/10 px-4 py-3 text-sm text-danger-200">{error}</div>}

          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <label className="space-y-2 text-sm text-gray-400">
              Change Name *
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-primary-500"
                placeholder="Enter change title"
                required
              />
            </label>

            <label className="space-y-2 text-sm text-gray-400">
              Module *
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

          {/* Internal Change Flag */}
          {!isClient && (
            <div className="flex items-center gap-3 bg-gray-950/40 p-4 rounded-xl border border-gray-800">
              <input
                type="checkbox"
                id="isInternal"
                checked={isInternal}
                onChange={(e) => {
                  const val = e.target.checked;
                  setIsInternal(val);
                  if (val) {
                    setClientId('');
                    setClientPhone('');
                  }
                }}
                className="w-4 h-4 rounded border-gray-700 text-primary-600 bg-gray-900 focus:ring-primary-500"
              />
              <label htmlFor="isInternal" className="text-sm font-medium text-gray-300 cursor-pointer selection:bg-transparent select-none">
                Internal Change Request (Restricts access to assigned resources only)
              </label>
            </div>
          )}
 
          {/* Client Assignment & Phone */}
          {!isInternal && (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {!isClient ? (
                <label className="space-y-2 text-sm text-gray-400">
                  Client Assignment (Optional)
                  <select
                    value={clientId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setClientId(val);
                      if (!val) {
                        setClientPhone('');
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
                Client Phone Number
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, ''); // only allow digits
                    if (val.length <= 10) setClientPhone(val);
                  }}
                  disabled={!isClient && !clientId}
                  className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-primary-500 disabled:opacity-55 disabled:cursor-not-allowed"
                  placeholder={isClient || clientId ? "+91 XXXXX XXXXX" : "Select a client first"}
                />
              </label>
            </div>
          )}

          {/* Resource Assignments */}
          <div className="border-t border-gray-850 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-400 mb-3">Resource Assignments</h3>
            <div className={`grid gap-4 ${isClient ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5'}`}>
              {renderUserSelector('Managers *', managerUsers, selectedManagerIds, setSelectedManagerIds)}
              {!isClient && renderUserSelector('Developers', developerUsers, selectedDeveloperIds, setSelectedDeveloperIds)}
              {!isClient && renderUserSelector('Testers', testerUsers, selectedTesterIds, setSelectedTesterIds)}
              {!isClient && renderUserSelector('Verifiers', verifierUsers, selectedVerifierIds, setSelectedVerifierIds)}
              {!isClient && renderUserSelector('Deployers', deployerUsers, selectedDeployerIds, setSelectedDeployerIds)}
            </div>
          </div>

          {/* Dates */}
          <div className={`grid gap-4 grid-cols-1 ${isClient ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
            <label className="space-y-2 text-sm text-gray-400">
              Date Given *
              <input
                type="date"
                value={dateGiven}
                onChange={(e) => setDateGiven(e.target.value)}
                required
                className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-primary-500"
              />
            </label>
            {isClient ? (
              <label className="space-y-2 text-sm text-gray-400">
                Requested Deadline *
                <input
                  type="date"
                  value={requestedDeadline}
                  onChange={(e) => setRequestedDeadline(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-primary-500"
                />
              </label>
            ) : (
              <>
                <label className="space-y-2 text-sm text-gray-400">
                  Planned Start Date
                  <input
                    type="date"
                    value={plannedStartDate}
                    onChange={(e) => setPlannedStartDate(e.target.value)}
                    className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-primary-500"
                  />
                </label>
                <label className="space-y-2 text-sm text-gray-400">
                  Planned End Date
                  <input
                    type="date"
                    value={plannedEndDate}
                    onChange={(e) => setPlannedEndDate(e.target.value)}
                    className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-primary-500"
                  />
                </label>
              </>
            )}
          </div>

          {/* 3-Part Description */}
          <div className="border-t border-gray-850 pt-4 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-400">Change Description</h3>

            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              <label className="space-y-2 text-sm text-gray-400">
                Description Title *
                <input
                  value={descTitle}
                  onChange={(e) => setDescTitle(e.target.value)}
                  className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-primary-500"
                  placeholder="Short heading for this change..."
                  required
                />
              </label>

              <label className="space-y-2 text-sm text-gray-400">
                Change Type *
                <select
                  value={descType}
                  onChange={(e) => setDescType(e.target.value)}
                  className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-primary-500"
                >
                  {CHANGE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="space-y-2 text-sm text-gray-400">
              Comments / Details *
              <textarea
                value={descComments}
                onChange={(e) => setDescComments(e.target.value)}
                className="min-h-[120px] w-full rounded-3xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-primary-500"
                placeholder="Describe the change requirements, scope, and any additional context..."
                required
              />
            </label>

            <div className="space-y-2">
              <span className="block text-sm text-gray-400 font-medium">Attach Document / File (Optional)</span>
              <div className="flex items-center justify-between gap-3 bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-primary-400 hover:text-primary-300 transition-colors">
                  <Paperclip size={16} />
                  <span>Choose file...</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setSelectedFile(e.target.files[0]);
                      }
                    }}
                  />
                </label>
                {selectedFile ? (
                  <div className="flex items-center gap-2 text-xs bg-gray-800/80 px-2.5 py-1 rounded-full border border-gray-700 max-w-[240px]">
                    <span className="truncate text-gray-300 font-mono" title={selectedFile.name}>{selectedFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="text-gray-500 hover:text-red-400 transition-colors p-0.5 rounded-full hover:bg-gray-700/50"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-gray-500">No file selected</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end mt-4">
            <button type="button" onClick={onClose} className="rounded-2xl border border-gray-700 px-5 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || loading} className="inline-flex items-center justify-center rounded-2xl bg-primary-500 px-5 py-3 text-sm font-semibold text-white hover:bg-primary-400 transition-colors disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? 'Submitting...' : 'Submit Change Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
