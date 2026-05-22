import React, { useState, useEffect } from 'react';
import { X, Clock, MessageSquare, CalendarDays, CheckCircle2, Trash2, RotateCcw, Users, Paperclip, Plus, FileText, File } from 'lucide-react';
import type { Task, TaskUser } from '../../api/tasks';
import { useAuthStore } from '../../store/authStore';
import api from '../../api/client';
import { updateTaskDetails } from '../../api/tasks';
import { updateUserModules } from '../../api/users';

function getUserDisplayName(user?: TaskUser | null): string {
  if (!user) return 'Unknown';
  if (user.firstName) {
    return user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName;
  }
  const u = user as any;
  return u.name || u.username || 'Unknown';
}

function getUserInitial(user?: TaskUser | null): string {
  if (!user) return '?';
  if (user.firstName && user.firstName.length > 0) return user.firstName[0].toUpperCase();
  const u = user as any;
  if (u.name && u.name.length > 0) return u.name[0].toUpperCase();
  if (u.username && u.username.length > 0) return u.username[0].toUpperCase();
  return '?';
}

interface PatchDetailsModalProps {
  task: Task;
  onClose: () => void;
  onStatusChange: (taskId: string, newStatus: string, reason?: string) => Promise<void>;
  onCommentAdded: (taskId: string, content: string, files?: string[]) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  onRestore: (taskId: string) => Promise<void>;
  onUpdated?: (updatedTask: Task) => void;
}

const STATUSES = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'IN_DEVELOPMENT', label: 'In Development' },
  { value: 'VERIFYING', label: 'Verifying' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'RETURNED_TO_DEVELOPER', label: 'Returned to Developer' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'DELAYED', label: 'Delayed' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'CANCELLED', label: 'Cancelled' }
];

const NEXT_STATUSES: Record<string, string[]> = {
  DRAFT: ['ASSIGNED'],
  ASSIGNED: ['PENDING_APPROVAL'],
  PENDING_APPROVAL: ['IN_DEVELOPMENT'],
  IN_DEVELOPMENT: ['VERIFYING'],
  VERIFYING: ['COMPLETED', 'RETURNED_TO_DEVELOPER', 'REJECTED', 'DELAYED', 'ON_HOLD', 'CANCELLED'],
  RETURNED_TO_DEVELOPER: ['IN_DEVELOPMENT'],
  DELAYED: ['IN_DEVELOPMENT'],
  ON_HOLD: ['IN_DEVELOPMENT'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
};

export function PatchDetailsModal({ task, onClose, onStatusChange, onCommentAdded, onDelete, onRestore, onUpdated }: PatchDetailsModalProps) {
  const [updating, setUpdating] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentFiles, setCommentFiles] = useState<string[]>([]);
  const [draftFile, setDraftFile] = useState('');
  const [error, setError] = useState('');
  const currentUser = useAuthStore((state) => state.user);

  // User assignments editing states (for Manager / Admin)
  const [usersList, setUsersList] = useState<TaskUser[]>([]);
  const [selectedManagerIds, setSelectedManagerIds] = useState<string[]>([]);
  const [selectedDevIds, setSelectedDevIds] = useState<string[]>([]);
  const [selectedVerIds, setSelectedVerIds] = useState<string[]>([]);
  const [isEditingAssignments, setIsEditingAssignments] = useState(false);
  const [editDateStarted, setEditDateStarted] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [activeTab, setActiveTab] = useState<'timeline' | 'audit'>('timeline');

  // Client & request ID states
  const [editClientId, setEditClientId] = useState('');
  const [editClientRequestId, setEditClientRequestId] = useState('0');

  // Client draft editing states
  const [isEditingClientFields, setIsEditingClientFields] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editModuleId, setEditModuleId] = useState('');
  const [editManagerId, setEditManagerId] = useState('');
  const [modulesList, setModulesList] = useState<any[]>([]);

  const isDeleted = task.lifecycleStatus === 100;
  const canManageLifecycle = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN';
  
  const isTaskManager = task.managers?.some((m: any) => (m.id || m.userId) === currentUser?.id) || task.managerId === currentUser?.id || task.manager?.id === currentUser?.id;
  const canAssignResources = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN' || (currentUser?.role === 'MANAGER' && isTaskManager);
  const canEditResources = canAssignResources && (task.status === 'DRAFT' || task.status === 'ASSIGNED');
  let nextStatuses = NEXT_STATUSES[task.status] || [];
  if (currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN') {
    // Admins see all valid transitions from the matrix, no further filtering required
  } else if (currentUser?.role === 'CLIENT') {
    nextStatuses = task.status === 'DRAFT' ? ['ASSIGNED'] : [];
  } else if (currentUser?.role === 'MANAGER') {
    nextStatuses = nextStatuses.filter(status => 
      (task.status === 'ASSIGNED' && status === 'PENDING_APPROVAL') ||
      (task.status === 'PENDING_APPROVAL' && status === 'IN_DEVELOPMENT') ||
      (['RETURNED_TO_DEVELOPER', 'DELAYED', 'ON_HOLD'].includes(task.status) && status === 'IN_DEVELOPMENT')
    );
  } else if (currentUser?.role === 'DEVELOPER') {
    nextStatuses = nextStatuses.filter(status => 
      (task.status === 'IN_DEVELOPMENT' && status === 'VERIFYING') ||
      (['RETURNED_TO_DEVELOPER', 'DELAYED', 'ON_HOLD'].includes(task.status) && status === 'IN_DEVELOPMENT')
    );
  } else if (currentUser?.role === 'VERIFIER') {
    nextStatuses = nextStatuses.filter(status => 
      (task.status === 'VERIFYING' && [
        'COMPLETED', 'RETURNED_TO_DEVELOPER', 'REJECTED', 'DELAYED', 'ON_HOLD', 'CANCELLED'
      ].includes(status))
    );
  } else {
    nextStatuses = [];
  }

  // Sync initial assignments
  useEffect(() => {
    if (task.managers) {
      setSelectedManagerIds(task.managers.map((m: any) => m.id || m.userId));
    } else if (task.manager) {
      const managerId = task.manager.id || task.manager.userId || '';
      setSelectedManagerIds([managerId]);
    } else {
      setSelectedManagerIds([]);
    }
    if (task.developers) {
      setSelectedDevIds(task.developers.map((d: any) => d.id || d.userId));
    }
    if (task.verifiers) {
      setSelectedVerIds(task.verifiers.map((v: any) => v.id || v.userId));
    }
    if (task.dateStarted) {
      setEditDateStarted(task.dateStarted.split('T')[0]);
    } else {
      setEditDateStarted('');
    }
    setEditStatus(task.status);

    // Sync client & request ID
    setEditClientId(task.clientId || '');
    setEditClientRequestId(task.clientRequestId !== undefined ? String(task.clientRequestId) : '0');

    // Sync client draft editing fields
    setEditTitle(task.title || '');
    setEditDescription(task.description || '');
    setEditModuleId(task.moduleId || task.module?.id || '');
    setEditManagerId(task.managerId || '');
  }, [task]);

  // Load active users list & modules list
  useEffect(() => {
    const shouldLoad = canAssignResources || (currentUser?.role === 'CLIENT' && task.status === 'DRAFT');
    if (shouldLoad) {
      Promise.all([
        api.get('/users?includeModules=true'),
        api.get('/modules')
      ])
        .then(([usersRes, modulesRes]) => {
          setUsersList(usersRes.data || []);
          setModulesList((modulesRes.data || []).map((m: any) => ({
            id: m.id || m.moduleId,
            name: m.name || m.moduleName,
          })));
        })
        .catch((err) => console.error('Failed to load users/modules list', err));
    }
  }, [canAssignResources, currentUser, task.status]);

  const handleStatusUpdate = async (newStatus: string) => {
    if (!newStatus) return;
    const reason = window.prompt(`Please enter a reason for moving this patch to ${newStatus}:`);
    if (reason === null) return; // User canceled

    setUpdating(true);
    setError('');
    try {
      await onStatusChange(task.id, newStatus, reason);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update workflow.');
    } finally {
      setUpdating(false);
    }
  };

  const handleAddDraftFile = (e: React.MouseEvent | React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    const file = draftFile.trim();
    if (file && !commentFiles.includes(file)) {
      setCommentFiles([...commentFiles, file]);
      setDraftFile('');
    }
  };

  const handleRemoveDraftFile = (fileToRemove: string) => {
    setCommentFiles(commentFiles.filter((f) => f !== fileToRemove));
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setUpdating(true);
    setError('');
    try {
      await onCommentAdded(task.id, commentText.trim(), commentFiles);
      setCommentText('');
      setCommentFiles([]);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to add comment.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteRestore = async () => {
    setUpdating(true);
    setError('');
    try {
      if (isDeleted) {
        await onRestore(task.id);
      } else {
        await onDelete(task.id);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update patch lifecycle.');
    } finally {
      setUpdating(false);
    }
  };

  const saveAssignments = async () => {
    let reason = '';
    if (editStatus && editStatus !== task.status) {
      const promptedReason = window.prompt(`Please enter a reason for moving this patch to ${editStatus}:`);
      if (promptedReason === null) return; // Cancel
      reason = promptedReason;
    }

    setUpdating(true);
    setError('');
    try {
      // Auto-map selected users to the module if they do not belong to it
      const allSelectedIds = [...selectedManagerIds, ...selectedDevIds, ...selectedVerIds];
      const usersToMap = usersList.filter(
        (u) => allSelectedIds.includes(u.id || u.userId || '') &&
               task.moduleId &&
               !(u.modules || []).some((m: any) => m.id === task.moduleId || m.moduleId === task.moduleId)
      );

      if (usersToMap.length > 0 && task.moduleId) {
        await Promise.all(
          usersToMap.map(async (user) => {
            const currentModuleIds = (user.modules || []).map((m: any) => m.id || m.moduleId).filter(Boolean) as string[];
            if (!currentModuleIds.includes(task.moduleId!)) {
              await updateUserModules(user.id || user.userId || '', [...currentModuleIds, task.moduleId!]);
            }
          })
        );
      }

      const updated = await updateTaskDetails(task.id, {
        managerIds: selectedManagerIds,
        developerIds: selectedDevIds,
        verifierIds: selectedVerIds,
        status: editStatus,
        dateStarted: editDateStarted || undefined,
        clientId: editClientId ? editClientId : undefined,
        clientRequestId: editClientId ? (parseInt(editClientRequestId) || 0) : 0,
        reason: reason || undefined,
      });

      // Merge updated properties back
      if (updated.managers) {
        setSelectedManagerIds(updated.managers.map((m: any) => m.id || m.userId));
      }
      if (updated.developers) {
        setSelectedDevIds(updated.developers.map((d: any) => d.id || d.userId));
      }
      if (updated.verifiers) {
        setSelectedVerIds(updated.verifiers.map((v: any) => v.id || v.userId));
      }
      if (updated.dateStarted) {
        setEditDateStarted(updated.dateStarted.split('T')[0]);
      } else {
        setEditDateStarted('');
      }
      setEditStatus(updated.status);
      setIsEditingAssignments(false);
      
      if (onUpdated) {
        onUpdated(updated);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save resource assignments.');
    } finally {
      setUpdating(false);
    }
  };

  const saveClientFields = async () => {
    if (!editTitle.trim()) {
      setError('Title is required.');
      return;
    }
    if (!editDescription.trim()) {
      setError('Description is required.');
      return;
    }
    if (!editModuleId) {
      setError('Module is required.');
      return;
    }
    if (!editManagerId) {
      setError('Manager assignment is required.');
      return;
    }

    setUpdating(true);
    setError('');
    try {
      await updateTaskDetails(task.id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        moduleId: editModuleId,
        managerIds: editManagerId ? [editManagerId] : [],
        clientRequestId: parseInt(editClientRequestId) || 0,
      });
      setIsEditingClientFields(false);
      window.location.reload();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save patch details.');
    } finally {
      setUpdating(false);
    }
  };

  const renderUserSelector = (
    label: string,
    allUsersOfRole: TaskUser[],
    selectedIds: string[],
    setSelectedIds: (ids: string[]) => void
  ) => {
    const belongsToSelectedModule = (user: TaskUser) => (
      !task.moduleId || (user.modules || []).some((module: any) => module.id === task.moduleId || module.moduleId === task.moduleId)
    );

    const members = allUsersOfRole.filter(belongsToSelectedModule);
    const nonMembers = allUsersOfRole.filter((u) => !belongsToSelectedModule(u));

    const handleToggle = (id: string) => {
      if (selectedIds.includes(id)) {
        setSelectedIds(selectedIds.filter((x) => x !== id));
      } else {
        setSelectedIds([...selectedIds, id]);
      }
    };

    return (
      <div className="space-y-1.5">
        <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
        <div className="max-h-28 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 p-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
          {members.length === 0 && nonMembers.length === 0 && (
            <div className="text-[11px] text-gray-500 p-1">No users found.</div>
          )}
          {members.map((user) => (
            <label
              key={user.id || user.userId}
              className="flex items-center gap-2 text-xs text-white cursor-pointer hover:bg-gray-800/40 px-2 py-0.5 rounded transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(user.id || user.userId || '')}
                onChange={() => handleToggle(user.id || user.userId || '')}
                className="rounded border-gray-750 bg-gray-850 text-primary-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer accent-primary-500"
              />
              <span className="truncate">{getUserDisplayName(user)}</span>
            </label>
          ))}
          {nonMembers.length > 0 && (
            <>
              <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500 px-2 pt-1.5 pb-0.5 border-t border-gray-800 mt-1.5">
                Non-Members (Will Auto-Assign)
              </div>
              {nonMembers.map((user) => (
                <label
                  key={user.id || user.userId}
                  className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:bg-gray-800/40 px-2 py-0.5 rounded transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(user.id || user.userId || '')}
                    onChange={() => handleToggle(user.id || user.userId || '')}
                    className="rounded border-gray-750 bg-gray-850 text-primary-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer accent-primary-500"
                  />
                  <span className="truncate">{getUserDisplayName(user)}</span>
                </label>
              ))}
            </>
          )}
        </div>
      </div>
    );
  };

  // CLIENT VIEW (LIMITED, READ-ONLY, STUNNING)
  if (currentUser?.role === 'CLIENT') {
    const assignedResources: string[] = [];
    if (task.manager) assignedResources.push(`${getUserDisplayName(task.manager)} (Manager)`);
    if (task.developers && task.developers.length > 0) {
      task.developers.forEach(d => assignedResources.push(`${getUserDisplayName(d)} (Developer)`));
    }
    if (task.verifiers && task.verifiers.length > 0) {
      task.verifiers.forEach(v => assignedResources.push(`${getUserDisplayName(v)} (Verifier)`));
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        
        <div className="relative bg-gray-900 border border-gray-700 shadow-2xl rounded-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-white">
          <div className="flex items-start justify-between p-6 border-b border-gray-800 bg-gray-800/30">
            <div>
              <div className="flex items-center gap-3 mb-2">
                {isEditingClientFields ? (
                  <select
                    value={editModuleId}
                    onChange={(e) => setEditModuleId(e.target.value)}
                    className="text-xs font-semibold bg-gray-850 border border-gray-700 rounded-md px-2 py-1 text-white focus:outline-none focus:border-primary-500"
                  >
                    <option value="">Select Module</option>
                    {modulesList.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs font-bold uppercase tracking-wider text-primary-400 bg-primary-500/10 px-2.5 py-1 rounded-md border border-primary-500/20">
                    {task.module?.name || 'No Module'}
                  </span>
                )}
                <span className="text-xs font-medium uppercase tracking-wider text-gray-400 bg-gray-800 px-2.5 py-1 rounded-md border border-gray-700">
                  {STATUSES.find(s => s.value === task.status)?.label || task.status}
                </span>
              </div>
              {isEditingClientFields ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-xl font-bold bg-gray-850 border border-gray-700 rounded-lg px-3 py-1.5 text-white w-full outline-none focus:border-primary-500 mt-2"
                  placeholder="Patch Title"
                />
              ) : (
                <h2 className="text-2xl font-bold text-white">{task.title}</h2>
              )}
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <div className="space-y-2 text-sm text-gray-400">
              <span className="font-semibold uppercase tracking-wider text-gray-500 text-xs">Description</span>
              {isEditingClientFields ? (
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full h-32 bg-gray-850 border border-gray-700 rounded-xl p-3 text-sm text-white outline-none focus:border-primary-500"
                  placeholder="Describe your request..."
                />
              ) : (
                <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/50 text-gray-300">
                  {task.description || <span className="text-gray-600 italic">No description.</span>}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-gray-800/30 p-5 rounded-xl border border-gray-700/30 text-sm">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Reference No:</span>
                  {isEditingClientFields ? (
                    <input
                      type="number"
                      value={editClientRequestId}
                      onChange={(e) => setEditClientRequestId(e.target.value)}
                      className="w-24 bg-gray-850 border border-gray-700 rounded-md px-2 py-0.5 text-xs text-white focus:outline-none focus:border-primary-500 text-right"
                    />
                  ) : (
                    <span className="text-gray-300 font-medium">{task.clientRequestId !== undefined ? task.clientRequestId : 'N/A'}</span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Date Given:</span>
                  <span className="text-gray-300 font-medium">{task.dateGiven ? new Date(task.dateGiven).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Date Started:</span>
                  <span className="text-gray-300 font-medium">{task.dateStarted ? new Date(task.dateStarted).toLocaleDateString() : 'Not started'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Date Ended:</span>
                  <span className="text-gray-300 font-medium">{task.dateEnded ? new Date(task.dateEnded).toLocaleDateString() : 'In progress'}</span>
                </div>
              </div>

              <div className="space-y-3">
                {isEditingClientFields ? (
                  <div className="space-y-2">
                    <span className="text-gray-500 font-semibold block mb-1">Manager Assignment:</span>
                    <select
                      value={editManagerId}
                      onChange={(e) => setEditManagerId(e.target.value)}
                      className="w-full bg-gray-850 border border-gray-700 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-primary-500"
                    >
                      <option value="">Select Manager</option>
                      {usersList.filter(u => u.role === 'MANAGER' || u.role === 'ADMIN').map((m) => (
                        <option key={m.id || m.userId} value={m.id || m.userId}>
                          {getUserDisplayName(m)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <>
                    <div className="text-gray-500 font-semibold mb-1">Assigned Resources:</div>
                    {assignedResources.length > 0 ? (
                      <ul className="list-disc pl-4 text-gray-300 space-y-1">
                        {assignedResources.map((res, i) => (
                          <li key={i}>{res}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-gray-600 italic">No resources assigned.</div>
                    )}
                  </>
                )}
              </div>
            </div>

            {task.status === 'DRAFT' && (
              <div className="flex justify-end gap-3 border-t border-gray-800 pt-4">
                {isEditingClientFields ? (
                  <>
                    <button 
                      onClick={() => setIsEditingClientFields(false)} 
                      disabled={updating}
                      className="rounded-2xl border border-gray-700 px-5 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={saveClientFields} 
                      disabled={updating}
                      className="inline-flex items-center justify-center rounded-2xl bg-primary-500 px-5 py-3 text-sm font-semibold text-white hover:bg-primary-400 transition-colors disabled:opacity-60"
                    >
                      {updating ? 'Saving...' : 'Save Changes'}
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={onClose} className="rounded-2xl border border-gray-700 px-5 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors">
                      Close
                    </button>
                    <button 
                      onClick={() => setIsEditingClientFields(true)} 
                      className="rounded-2xl border border-gray-700 px-5 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                    >
                      Edit Details
                    </button>
                    <button 
                      onClick={() => handleStatusUpdate('ASSIGNED')} 
                      disabled={updating}
                      className="inline-flex items-center justify-center rounded-2xl bg-primary-500 px-5 py-3 text-sm font-semibold text-white hover:bg-primary-400 transition-colors disabled:opacity-60"
                    >
                      {updating ? 'Submitting...' : 'Submit & Assign to Manager'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ADMINISTRATIVE AND TEAM MEMBER VIEW
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-gray-900 border border-gray-700 shadow-2xl rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-800 bg-gray-800/30">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary-400 bg-primary-500/10 px-2.5 py-1 rounded-md border border-primary-500/20">
                {task.module?.name || 'No Module'}
              </span>
              <span className="text-xs font-medium uppercase tracking-wider text-gray-400 bg-gray-800 px-2.5 py-1 rounded-md border border-gray-700">
                {STATUSES.find(s => s.value === task.status)?.label || task.status}
              </span>
              {isDeleted && (
                <span className="text-xs font-medium uppercase tracking-wider text-red-300 bg-red-500/10 px-2.5 py-1 rounded-md border border-red-500/30">
                  Soft Deleted
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-white">{task.title}</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8 custom-scrollbar">
          
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-8">
            <section>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Description</h3>
              <div className="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed bg-gray-800/50 p-5 rounded-xl border border-gray-700/50 min-h-[100px]">
                {task.description || <span className="text-gray-600 italic">No description provided.</span>}
              </div>
            </section>

            {/* Comments Area */}
            <section>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2 text-white">
                <MessageSquare size={16} /> Comments
              </h3>
              <div className="space-y-4">
                <form onSubmit={handleCommentSubmit} className="space-y-3">
                  <div className="flex gap-3">
                    <input 
                      type="text" 
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Write a comment..."
                      disabled={isDeleted || updating}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500 transition-colors"
                    />
                    <button type="submit" disabled={isDeleted || updating} className="bg-primary-600 hover:bg-primary-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-primary-600/15 hover:shadow-primary-600/25">
                      Post
                    </button>
                  </div>

                  {/* Attachment input row */}
                  <div className="flex gap-2 items-center bg-gray-800/40 p-2.5 rounded-lg border border-gray-700/50">
                    <Paperclip size={14} className="text-gray-400 ml-1 shrink-0" />
                    <input
                      type="text"
                      placeholder="Attach file (e.g. patch-details.patch, index.css)..."
                      value={draftFile}
                      onChange={(e) => setDraftFile(e.target.value)}
                      disabled={isDeleted || updating}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddDraftFile(e);
                        }
                      }}
                      className="flex-1 bg-transparent border-none text-xs text-gray-300 focus:outline-none focus:ring-0 placeholder-gray-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleAddDraftFile}
                      disabled={isDeleted || updating || !draftFile.trim()}
                      className="bg-gray-700/80 hover:bg-gray-700 text-white px-2.5 py-1 rounded-md text-xs font-semibold transition-all border border-gray-600 disabled:opacity-30 disabled:hover:bg-gray-700 flex items-center gap-1 shrink-0"
                    >
                      <Plus size={14} />
                      <span>Add</span>
                    </button>
                  </div>

                  {/* Draft files list */}
                  {commentFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {commentFiles.map((file, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1.5 bg-gray-800/80 hover:bg-gray-800 text-gray-300 text-xs px-2.5 py-1 rounded-full border border-gray-700/60 transition-all shadow-sm">
                          <File size={12} className="text-primary-400" />
                          <span className="font-mono">{file}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDraftFile(file)}
                            className="text-gray-500 hover:text-red-400 transition-colors p-0.5 rounded-full hover:bg-gray-700/50"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </form>
                
                <div className="space-y-4 mt-6">
                  {task.comments && task.comments.length > 0 ? (
                    task.comments.map((comment: any) => (
                      <div key={comment.id} className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm border border-gray-600/30">
                          {getUserInitial(comment.user)}
                        </div>
                        <div className="bg-gray-800/50 border border-gray-700/70 rounded-lg p-3.5 flex-1 shadow-sm">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 mb-1.5 border-b border-gray-700/30 pb-1.5">
                            <span className="text-sm font-semibold text-gray-200">
                              {comment.authorName || getUserDisplayName(comment.user)}
                            </span>
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                              <span className="px-2 py-0.5 rounded bg-gray-700/60 font-semibold text-[10px] tracking-wider uppercase text-primary-300">
                                {comment.authorRole || comment.user?.role || 'User'}
                              </span>
                              <span className="text-gray-600">•</span>
                              <span className="text-gray-500 font-mono">
                                {new Date(comment.createdAt).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                          
                          {/* Ordered comment attachments list */}
                          {comment.files && Array.isArray(comment.files) && comment.files.length > 0 && (
                            <div className="mt-3 pt-2.5 border-t border-gray-700/40 flex flex-wrap gap-2">
                              {comment.files.map((file: any, idx: number) => {
                                const fileName = typeof file === 'string' ? file : (file.name || 'attachment');
                                return (
                                  <div key={idx} className="flex items-center gap-2 bg-gray-900/60 hover:bg-gray-900/95 border border-gray-700/50 rounded-lg px-3 py-1.5 text-xs text-gray-300 transition-all select-none shadow-sm hover:shadow group max-w-xs shrink-0 font-mono">
                                    <FileText size={13} className="text-primary-400 group-hover:scale-105 transition-transform" />
                                    <span className="truncate" title={fileName}>{fileName}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500 italic text-center py-6 border border-dashed border-gray-700 rounded-xl">
                      No comments yet. Be the first to comment!
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            
            {/* Quick Actions (Update Workflow Status) */}
            {nextStatuses.length > 0 && (
              <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2 text-white">
                  <CheckCircle2 size={16} /> Update Workflow
                </h3>
                <div className="flex flex-col gap-2">
                  <select 
                    value="" 
                    onChange={(e) => handleStatusUpdate(e.target.value)}
                    disabled={updating || isDeleted}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500 transition-colors disabled:opacity-50"
                  >
                    <option value="">Move to next stage</option>
                    {STATUSES.filter((status) => nextStatuses.includes(status.value)).map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  {updating && <p className="text-xs text-primary-400 text-center mt-1 animate-pulse">Updating...</p>}
                  {error && <p className="text-xs text-danger-300 mt-2">{error}</p>}
                </div>
              </div>
            )}

            {/* Dynamic Assignments Panel (Multi-Developer & Multi-Verifier) */}
            <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2 text-white">
                  <Users size={16} /> Resources
                </h3>
                {canEditResources && !isDeleted && (
                  <button 
                    onClick={() => {
                      if (isEditingAssignments) {
                        saveAssignments();
                      } else {
                        setIsEditingAssignments(true);
                      }
                    }}
                    className="text-xs font-semibold text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    {isEditingAssignments ? 'Save' : 'Edit'}
                  </button>
                )}
              </div>

              {isEditingAssignments ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-gray-400">Workflow Status</span>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary-500 transition-colors"
                    >
                      {STATUSES.filter(s => s.value === task.status || nextStatuses.includes(s.value)).map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-medium text-gray-400">Date Started</span>
                    <input
                      type="date"
                      value={editDateStarted}
                      onChange={(e) => setEditDateStarted(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary-500 transition-colors"
                    />
                  </div>

                  {renderUserSelector(
                    'Managers *',
                    usersList.filter(u => u.role === 'MANAGER' || u.role === 'ADMIN' || u.role === 'SUPER_ADMIN'),
                    selectedManagerIds,
                    setSelectedManagerIds
                  )}

                  {renderUserSelector(
                    'Developers',
                    usersList.filter(u => u.role === 'DEVELOPER'),
                    selectedDevIds,
                    setSelectedDevIds
                  )}

                  {renderUserSelector(
                    'Verifiers',
                    usersList.filter(u => u.role === 'VERIFIER'),
                    selectedVerIds,
                    setSelectedVerIds
                  )}

                  <div className="space-y-2">
                    <span className="text-xs font-medium text-gray-400">Client Assignment (Optional)</span>
                    <select
                      value={editClientId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditClientId(val);
                        if (!val) {
                          setEditClientRequestId('0');
                        }
                      }}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary-500 transition-colors"
                    >
                      <option value="">No Client (Internal Request)</option>
                      {usersList.filter(u => u.role === 'CLIENT').map((u) => {
                        const id = u.id || u.userId || '';
                        return (
                          <option key={id} value={id}>
                            {getUserDisplayName(u)}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-medium text-gray-400">Client Request ID / Reference No</span>
                    <input
                      type="number"
                      value={editClientRequestId}
                      onChange={(e) => setEditClientRequestId(e.target.value)}
                      disabled={!editClientId}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary-500 transition-colors disabled:opacity-55 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5 text-sm text-gray-300">
                  <div className="flex justify-between items-start">
                    <span className="text-gray-500">Client:</span>
                    <span className="font-medium text-gray-200">{task.client ? getUserDisplayName(task.client) : 'Internal Request'}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-gray-500">Reference No:</span>
                    <span className="font-medium text-gray-200">{task.clientRequestId !== undefined ? task.clientRequestId : 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-1">Managers:</span>
                    {task.managers && task.managers.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-0.5 text-xs text-gray-300">
                        {task.managers.map((m, i) => (
                          <li key={i}>{getUserDisplayName(m)}</li>
                        ))}
                      </ul>
                    ) : task.manager ? (
                      <ul className="list-disc pl-4 space-y-0.5 text-xs text-gray-300">
                        <li>{getUserDisplayName(task.manager)}</li>
                      </ul>
                    ) : (
                      <span className="text-xs text-gray-600 italic">None assigned</span>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-1">Developers:</span>
                    {task.developers && task.developers.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-0.5 text-xs text-gray-300">
                        {task.developers.map((d, i) => (
                          <li key={i}>{getUserDisplayName(d)}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs text-gray-600 italic">None assigned</span>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-1">Verifiers:</span>
                    {task.verifiers && task.verifiers.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-0.5 text-xs text-gray-300">
                        {task.verifiers.map((v, i) => (
                          <li key={i}>{getUserDisplayName(v)}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs text-gray-600 italic">None assigned</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {canManageLifecycle && (
              <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 text-white">Lifecycle</h3>
                <button
                  type="button"
                  onClick={handleDeleteRestore}
                  disabled={updating}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition disabled:opacity-50 ${
                    isDeleted
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-red-600/90 hover:bg-red-500 text-white'
                  }`}
                >
                  {isDeleted ? <RotateCcw size={16} /> : <Trash2 size={16} />}
                  {isDeleted ? 'Restore Patch' : 'Soft Delete Patch'}
                </button>
              </div>
            )}
            
            <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50 text-white">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Dates</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 flex items-center gap-1"><CalendarDays size={14}/> Given</span>
                  <span className="text-gray-300">{task.dateGiven ? new Date(task.dateGiven).toLocaleDateString() : new Date(task.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 flex items-center gap-1"><Clock size={14}/> Started</span>
                  <span className="text-gray-300">{task.dateStarted ? new Date(task.dateStarted).toLocaleDateString() : 'Not started'}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 flex items-center gap-1"><CheckCircle2 size={14}/> Ended</span>
                  <span className="text-gray-300">{task.dateEnded ? new Date(task.dateEnded).toLocaleDateString() : 'In progress'}</span>
                </div>
              </div>
            </div>

            {/* Status History Timeline & Audit Log Tabs */}
            <div>
              <div className="flex items-center gap-4 border-b border-gray-800 pb-3 mb-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('timeline')}
                  className={`text-sm font-semibold uppercase tracking-wider flex items-center gap-2 pb-1 transition-colors border-b-2 ${
                    activeTab === 'timeline'
                      ? 'text-primary-400 border-primary-500'
                      : 'text-gray-400 border-transparent hover:text-gray-200'
                  }`}
                >
                  <Clock size={16} /> Workflow Timeline
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('audit')}
                  className={`text-sm font-semibold uppercase tracking-wider flex items-center gap-2 pb-1 transition-colors border-b-2 ${
                    activeTab === 'audit'
                      ? 'text-primary-400 border-primary-500'
                      : 'text-gray-400 border-transparent hover:text-gray-200'
                  }`}
                >
                  <Users size={16} /> Audit Trail
                </button>
              </div>

              {activeTab === 'timeline' ? (
                <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-2.5 before:w-[2px] before:bg-gray-800 ml-1">
                  {task.statusHistory && task.statusHistory.length > 0 ? (
                    task.statusHistory.map((history: any, i: number) => {
                      const prevLabel = STATUSES.find(s => s.value === history.previousStatus)?.label || history.previousStatus || "Draft";
                      const newLabel = STATUSES.find(s => s.value === history.newStatus)?.label || history.newStatus;
                      const actorName = history.actor ? getUserDisplayName(history.actor) : (history.changedByName || 'System / Author');
                      const actorRole = history.actor?.role ? history.actor.role : (history.changedByRole || 'System');

                      return (
                        <div key={i} className="relative pl-7 text-sm group animate-in slide-in-from-left duration-200">
                          {/* Bullet indicator */}
                          <div className="absolute left-[3px] top-1.5 w-4 h-4 rounded-full bg-primary-600 border-4 border-gray-900 group-hover:bg-primary-500 transition-colors shadow-[0_0_8px_rgba(59,130,246,0.3)] -translate-x-1" />
                          
                          <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-800/80 hover:border-gray-700/80 transition-all space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-gray-500 font-medium">
                              <span className="text-gray-400 font-semibold truncate max-w-[200px]" title={task.title}>Patch: {task.title}</span>
                              <span className="font-mono text-gray-400">{new Date(history.createdAt).toLocaleString()}</span>
                            </div>

                            <div className="text-gray-200 font-semibold flex items-center gap-2 flex-wrap">
                              <span className="text-gray-500 text-xs font-normal bg-gray-900 px-2 py-0.5 rounded border border-gray-800">{prevLabel}</span>
                              <span className="text-gray-500">→</span>
                              <span className="text-primary-400 font-bold bg-primary-500/10 px-2 py-0.5 rounded border border-primary-500/20">{newLabel}</span>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-gray-300">
                              <span className="font-medium text-gray-200">{actorName}</span>
                              <span className="text-[10px] text-primary-300 font-bold bg-primary-500/10 border border-primary-500/20 px-1.5 py-0.2 rounded uppercase tracking-wider">{actorRole}</span>
                            </div>

                            {history.reason && (
                              <p className="text-xs text-gray-400 italic bg-gray-900/60 px-3 py-2 rounded-lg border border-gray-800/60 mt-1">
                                "{history.reason}"
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-gray-500 pl-6 italic">No timeline available.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-2.5 before:w-[2px] before:bg-gray-800 ml-1">
                  {task.auditLogs && task.auditLogs.length > 0 ? (
                    task.auditLogs.map((log: any, i: number) => {
                      const actorName = log.actor ? getUserDisplayName(log.actor) : 'System / Author';
                      const actorRole = log.actor?.role ? log.actor.role : 'System';

                      return (
                        <div key={i} className="relative pl-7 text-sm group animate-in slide-in-from-left duration-200">
                          {/* Bullet indicator */}
                          <div className="absolute left-[3px] top-1.5 w-4 h-4 rounded-full bg-yellow-600 border-4 border-gray-900 group-hover:bg-yellow-500 transition-colors shadow-[0_0_8px_rgba(202,138,4,0.3)] -translate-x-1" />
                          
                          <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-800/80 hover:border-gray-700/80 transition-all space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-gray-500 font-medium">
                              <span className="text-gray-400 font-semibold truncate max-w-[200px]" title={task.title}>Field: {log.fieldChanged}</span>
                              <span className="font-mono text-gray-400">{new Date(log.changedAt).toLocaleString()}</span>
                            </div>

                            <div className="text-gray-200 font-medium space-y-1">
                              {log.oldValue && (
                                <div className="text-xs text-gray-400">
                                  <span className="text-gray-500">Old Value:</span> <span className="bg-gray-900 px-1 py-0.5 rounded border border-gray-800 font-mono text-[11px]">{log.oldValue}</span>
                                </div>
                              )}
                              {log.newValue && (
                                <div className="text-xs text-gray-200">
                                  <span className="text-gray-500">New Value:</span> <span className="bg-primary-500/10 text-primary-300 px-1 py-0.5 rounded border border-primary-500/20 font-mono text-[11px]">{log.newValue}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-xs text-gray-300">
                              <span className="font-medium text-gray-200">{actorName}</span>
                              <span className="text-[10px] text-yellow-500 font-bold bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.2 rounded uppercase tracking-wider">{actorRole}</span>
                            </div>

                            {log.reason && (
                              <p className="text-xs text-gray-400 italic bg-gray-900/60 px-3 py-2 rounded-lg border border-gray-800/60 mt-1">
                                "{log.reason}"
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-gray-500 pl-6 italic">No audit trail available.</p>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
