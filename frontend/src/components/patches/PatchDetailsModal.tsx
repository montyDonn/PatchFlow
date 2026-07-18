import React, { useState, useEffect } from 'react';
import { X, Clock, MessageSquare, CalendarDays, CheckCircle2, Trash2, RotateCcw, Users, Paperclip, FileText, File } from 'lucide-react';
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

const getFileUrl = (url: string): string => {
  if (!url) return '';
  const base = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5001/api' : '/api')).replace('/api', '');
  return `${base}${url}`;
};

const getClientDeadline = (description: string) => {
  const match = description?.match(/\[CLIENT_DEADLINE:\s*([^\]]+)\]/);
  return match ? match[1] : null;
};

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
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_DEVELOPMENT', label: 'In Development' },
  { value: 'TESTING', label: 'Testing' },
  { value: 'MANAGER_REVIEW', label: 'Manager Review' },
  { value: 'DEPLOYMENT', label: 'Deployment' },
  { value: 'FINAL_TESTING_OF_PATCH', label: 'Final Testing of Patch' },
  { value: 'COMPLETED', label: 'Completed' },
  // Legacy / exception statuses
  { value: 'RETURNED_TO_DEVELOPER', label: 'Returned to Developer' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'DELAYED', label: 'Delayed' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'CANCELLED', label: 'Cancelled' }
];

const NEXT_STATUSES: Record<string, string[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['ASSIGNED', 'REJECTED', 'CANCELLED'],
  ASSIGNED: ['IN_DEVELOPMENT'],
  IN_DEVELOPMENT: ['TESTING'],
  TESTING: ['MANAGER_REVIEW', 'IN_DEVELOPMENT', 'COMPLETED', 'REJECTED', 'ON_HOLD', 'CANCELLED'],
  MANAGER_REVIEW: ['DEPLOYMENT', 'IN_DEVELOPMENT', 'REJECTED', 'ON_HOLD', 'CANCELLED'],
  DEPLOYMENT: ['FINAL_TESTING_OF_PATCH', 'ON_HOLD', 'CANCELLED'],
  FINAL_TESTING_OF_PATCH: ['COMPLETED', 'IN_DEVELOPMENT'],
  // Legacy statuses kept for backward compatibility
  RETURNED_TO_DEVELOPER: ['IN_DEVELOPMENT'],
  DELAYED: ['IN_DEVELOPMENT'],
  ON_HOLD: ['IN_DEVELOPMENT', 'ASSIGNED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
};

export function PatchDetailsModal({ task, onClose, onStatusChange, onCommentAdded, onDelete, onRestore, onUpdated }: PatchDetailsModalProps) {
  const [updating, setUpdating] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentFiles, setCommentFiles] = useState<string[]>([]);
  const [error, setError] = useState('');
  const currentUser = useAuthStore((state) => state.user);

  // User assignments editing states (for Manager / Admin)
  const [usersList, setUsersList] = useState<TaskUser[]>([]);
  const [selectedManagerIds, setSelectedManagerIds] = useState<string[]>([]);
  const [selectedDevIds, setSelectedDevIds] = useState<string[]>([]);
  const [selectedTesterIds, setSelectedTesterIds] = useState<string[]>([]);
  const [selectedVerIds, setSelectedVerIds] = useState<string[]>([]);
  const [selectedDeployerIds, setSelectedDeployerIds] = useState<string[]>([]);
  const [editDeployerId, setEditDeployerId] = useState('');
  const [editRollbackPlan, setEditRollbackPlan] = useState('');
  const [editDeploymentTarget, setEditDeploymentTarget] = useState('');
  const [isEditingAssignments, setIsEditingAssignments] = useState(false);
  const [editDateStarted, setEditDateStarted] = useState('');
  const [editPlannedEndDate, setEditPlannedEndDate] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [activeTab, setActiveTab] = useState<'timeline' | 'audit'>('timeline');

  // Inline deadline editing states (Bug 2 fix)
  const [isEditingDeadline, setIsEditingDeadline] = useState(false);
  const [inlineDeadline, setInlineDeadline] = useState('');
  const [savingDeadline, setSavingDeadline] = useState(false);

  // Whether the assignment panel was auto-opened (Bug 3 fix)
  const [autoOpenedAssignment, setAutoOpenedAssignment] = useState(false);

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
  const canManageLifecycle = currentUser?.role === 'SUPER_ADMIN';

  // currentUser.id may be undefined for sessions created before the login fix.
  // Fall back to currentUser.userId (the raw field the backend sends) for robustness.
  const currentUserId = currentUser?.id || (currentUser as any)?.userId;

  const isTaskManager =
    task.managers?.some((m: any) => (m.id || m.userId) === currentUserId) ||
    task.managerId === currentUserId ||
    task.manager?.id === currentUserId ||
    task.manager?.userId === currentUserId;

  const canAssignResources =
    currentUser?.role === 'SUPER_ADMIN' ||
    (currentUser?.role === 'MANAGER' && isTaskManager);

  const canEditResources = canAssignResources && !['COMPLETED', 'REJECTED', 'CANCELLED'].includes(task.status);
  let nextStatuses = NEXT_STATUSES[task.status] || [];

  // When the patch is awaiting manager approval, ASSIGNED must NOT be reachable
  // via the normal dropdown — the manager must go through the Approve & Assign card
  // (which enforces deadline + resource selection before promoting the status).
  if (task.status === 'PENDING_APPROVAL' && canAssignResources) {
    nextStatuses = nextStatuses.filter(s => s !== 'ASSIGNED');
  }
  if (currentUser?.role === 'SUPER_ADMIN') {
    // Admins see all transitions
  } else if (currentUser?.role === 'CLIENT') {
    nextStatuses = task.status === 'DRAFT' ? ['PENDING_APPROVAL', 'CANCELLED'] :
                   task.status === 'FINAL_TESTING_OF_PATCH' ? ['COMPLETED', 'IN_DEVELOPMENT'] : [];
  } else if (currentUser?.role === 'MANAGER') {
    nextStatuses = isTaskManager ? nextStatuses.filter(status =>
      (task.status === 'PENDING_APPROVAL' && status === 'ASSIGNED') ||
      (task.status === 'ASSIGNED' && status === 'IN_DEVELOPMENT') ||
      (task.status === 'MANAGER_REVIEW' && ['DEPLOYMENT', 'IN_DEVELOPMENT', 'REJECTED', 'ON_HOLD', 'CANCELLED'].includes(status)) ||
      (task.status === 'DEPLOYMENT' && ['FINAL_TESTING_OF_PATCH', 'ON_HOLD', 'CANCELLED'].includes(status)) ||
      (task.status === 'FINAL_TESTING_OF_PATCH' && ['COMPLETED', 'IN_DEVELOPMENT'].includes(status)) ||
      (['TESTING', 'RETURNED_TO_DEVELOPER', 'DELAYED', 'ON_HOLD'].includes(task.status) && status === 'IN_DEVELOPMENT')
    ) : [];
  } else if (currentUser?.role === 'DEVELOPER') {
    nextStatuses = nextStatuses.filter(status =>
      (task.status === 'IN_DEVELOPMENT' && status === 'TESTING') ||
      (['TESTING', 'RETURNED_TO_DEVELOPER', 'DELAYED', 'ON_HOLD'].includes(task.status) && status === 'IN_DEVELOPMENT')
    );
  } else if (currentUser?.role === 'VERIFIER') {
    const isVerifier = task.verifiers?.some((v: any) => (v.id || v.userId) === currentUserId);
    const isDeployer = currentUserId === task.deployerId;
    nextStatuses = isVerifier ? nextStatuses.filter(status =>
      (task.status === 'TESTING' && ['MANAGER_REVIEW', 'IN_DEVELOPMENT', 'COMPLETED', 'REJECTED', 'ON_HOLD', 'CANCELLED'].includes(status)) ||
      (task.status === 'FINAL_TESTING_OF_PATCH' && ['COMPLETED', 'IN_DEVELOPMENT'].includes(status)) ||
      (task.status === 'DEPLOYMENT' && status === 'FINAL_TESTING_OF_PATCH' && (isDeployer || isVerifier))
    ) : [];
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
    if (task.testers) {
      setSelectedTesterIds(task.testers.map((t: any) => t.id || t.userId));
    }
    if (task.verifiers) {
      setSelectedVerIds(task.verifiers.map((v: any) => v.id || v.userId));
    }
    if (task.deployers) {
      setSelectedDeployerIds(task.deployers.map((d: any) => d.id || d.userId));
    }
    setEditDeployerId(task.deployerId || '');
    setEditRollbackPlan(task.rollbackPlan || '');
    setEditDeploymentTarget(task.deploymentTarget || '');
    if (task.dateStarted) {
      setEditDateStarted(task.dateStarted.split('T')[0]);
    } else {
      setEditDateStarted('');
    }
    if (task.plannedEndDate) {
      setEditPlannedEndDate(task.plannedEndDate.split('T')[0]);
    } else {
      // Pre-fill with client's requested deadline so the manager doesn't
      // have to retype it if they accept it unchanged ("no edit required" case).
      const clientDl = getClientDeadline(task.description);
      setEditPlannedEndDate(clientDl || '');
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

  // Bug 3 fix: Auto-open assignment panel when manager/admin opens an ASSIGNED
  // patch that has no developers or verifiers assigned yet
  useEffect(() => {
    if (
      canAssignResources &&
      task.status === 'ASSIGNED' &&
      (!task.developers || task.developers.length === 0) &&
      (!task.testers || task.testers.length === 0) &&
      (!task.verifiers || task.verifiers.length === 0) &&
      (!task.deployers || task.deployers.length === 0)
    ) {
      setIsEditingAssignments(true);
      setAutoOpenedAssignment(true);
    }
  }, [task.id]); // only trigger once when the modal opens for this task

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

    let reason = '';
    if (newStatus === 'PENDING_APPROVAL') {
      reason = 'Submitted for manager review';
    } else if (newStatus === 'ASSIGNED') {
      reason = 'Approved and assigned resources';
    } else {
      const promptVal = window.prompt(`Please enter a reason for moving this patch to ${newStatus}:`);
      if (promptVal === null) return; // User canceled
      reason = promptVal;
    }

    setUpdating(true);
    setError('');
    try {
      await onStatusChange(task.id, newStatus, reason);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update workflow.');
    } finally {
      setUpdating(false);
    }
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
    const allSelectedIds = [...selectedManagerIds, ...selectedDevIds, ...selectedTesterIds, ...selectedVerIds, ...selectedDeployerIds];
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
        testerIds: selectedTesterIds,
        verifierIds: selectedVerIds,
        deployerIds: selectedDeployerIds,
        deployerId: editDeployerId || undefined,
        rollbackPlan: editRollbackPlan || undefined,
        deploymentTarget: editDeploymentTarget || undefined,
        status: editStatus,
        dateStarted: editDateStarted || undefined,
        plannedEndDate: editPlannedEndDate || undefined,
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
      if (updated.testers) {
        setSelectedTesterIds(updated.testers.map((t: any) => t.id || t.userId));
      }
      if (updated.verifiers) {
        setSelectedVerIds(updated.verifiers.map((v: any) => v.id || v.userId));
      }
      if (updated.deployers) {
        setSelectedDeployerIds(updated.deployers.map((d: any) => d.id || d.userId));
      }
      if (updated.dateStarted) {
        setEditDateStarted(updated.dateStarted.split('T')[0]);
      } else {
        setEditDateStarted('');
      }
      if (updated.plannedEndDate) {
        setEditPlannedEndDate(updated.plannedEndDate.split('T')[0]);
      } else {
        setEditPlannedEndDate('');
      }
      setEditDeployerId(updated.deployerId || '');
      setEditRollbackPlan(updated.rollbackPlan || '');
      setEditDeploymentTarget(updated.deploymentTarget || '');
      setEditStatus(updated.status);
      setIsEditingAssignments(false);

      if (onUpdated) {
        onUpdated(updated);
      }
      if (updated.status !== task.status) {
        onClose();
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save resource assignments.');
    } finally {
      setUpdating(false);
    }
  };

  // ── Approve & Assign handler ────────────────────────────────────────────────
  // Runs when manager submits the dedicated Approve & Assign card.
  // Saves developers, verifiers and approved deadline in one call, then
  // moves the patch to ASSIGNED — no separate dropdown click required.
  const handleApproveAndAssign = async () => {
    if (!editPlannedEndDate) {
      setError('Please select an Approved Deadline.');
      return;
    }
    setUpdating(true);
    setError('');
    try {
      // Auto-map users to the module if they are not already members
      const allSelectedIds = [...selectedManagerIds, ...selectedDevIds, ...selectedTesterIds, ...selectedVerIds, ...selectedDeployerIds];
      const usersToMap = usersList.filter(
        (u) =>
          allSelectedIds.includes(u.id || u.userId || '') &&
          task.moduleId &&
          !(u.modules || []).some(
            (m: any) => m.id === task.moduleId || m.moduleId === task.moduleId
          )
      );
      if (usersToMap.length > 0 && task.moduleId) {
        await Promise.all(
          usersToMap.map(async (user) => {
            const currentModuleIds = (user.modules || [])
              .map((m: any) => m.id || m.moduleId)
              .filter(Boolean) as string[];
            if (!currentModuleIds.includes(task.moduleId!)) {
              await updateUserModules(user.id || user.userId || '', [
                ...currentModuleIds,
                task.moduleId!,
              ]);
            }
          })
        );
      }

      const updated = await updateTaskDetails(task.id, {
        managerIds: selectedManagerIds,
        developerIds: selectedDevIds,
        testerIds: selectedTesterIds,
        verifierIds: selectedVerIds,
        deployerIds: selectedDeployerIds,
        status: 'ASSIGNED',
        plannedEndDate: editPlannedEndDate,
        reason: 'Approved and assigned resources',
      });

      // Sync local state
      if (updated.managers)
        setSelectedManagerIds(updated.managers.map((m: any) => m.id || m.userId));
      if (updated.developers)
        setSelectedDevIds(updated.developers.map((d: any) => d.id || d.userId));
      if (updated.testers)
        setSelectedTesterIds(updated.testers.map((t: any) => t.id || t.userId));
      if (updated.verifiers)
        setSelectedVerIds(updated.verifiers.map((v: any) => v.id || v.userId));
      if (updated.deployers)
        setSelectedDeployerIds(updated.deployers.map((d: any) => d.id || d.userId));
      if (updated.plannedEndDate)
        setEditPlannedEndDate(updated.plannedEndDate.split('T')[0]);
      setEditStatus(updated.status);

      if (onUpdated) {
        onUpdated(updated);
      }
      if (updated.status !== task.status) {
        onClose();
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to approve and assign resources.');
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
        <div className="max-h-36 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 p-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
          {allUsersOfRole.length === 0 ? (
            <div className="text-[11px] text-gray-500 p-1 italic">No users found. Loading...</div>
          ) : (
            allUsersOfRole.map((user) => {
              const uid = user.id || user.userId || '';
              const isChecked = selectedIds.includes(uid);
              return (
                <label
                  key={uid}
                  className={`flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-800/60 px-2 py-1 rounded transition-colors ${isChecked ? 'text-white' : 'text-gray-400'}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggle(uid)}
                    className="rounded border-gray-700 bg-gray-850 text-primary-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer accent-primary-500"
                  />
                  <span className="truncate font-medium">{getUserDisplayName(user)}</span>
                </label>
              );
            })
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
    if (task.testers && task.testers.length > 0) {
      task.testers.forEach(t => assignedResources.push(`${getUserDisplayName(t)} (Tester)`));
    }
    if (task.verifiers && task.verifiers.length > 0) {
      task.verifiers.forEach(v => assignedResources.push(`${getUserDisplayName(v)} (Verifier)`));
    }
    if (task.deployers && task.deployers.length > 0) {
      task.deployers.forEach(d => assignedResources.push(`${getUserDisplayName(d)} (Deployer)`));
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        <div className="relative bg-gray-900 border border-gray-700 shadow-2xl rounded-2xl w-[95vw] md:max-w-2xl lg:max-w-4xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 text-white">
          <div className="flex items-start justify-between p-4 sm:p-6 border-b border-gray-800 bg-gray-800/30 shrink-0">
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

          <div className="p-4 sm:p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
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
                {getClientDeadline(task.description) && (
                  <div className="flex justify-between items-center border-t border-gray-700/30 pt-2 mt-2">
                    <span className="text-gray-500 font-semibold text-primary-400">Requested Deadline:</span>
                    <span className="text-primary-300 font-medium font-mono">{new Date(getClientDeadline(task.description)!).toLocaleDateString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-semibold text-primary-400">Approved Deadline:</span>
                  {task.plannedEndDate ? (
                    <span className="text-emerald-400 font-medium font-mono">{new Date(task.plannedEndDate).toLocaleDateString()}</span>
                  ) : (
                    <span className="text-amber-400 font-medium italic">Pending Manager Approval</span>
                  )}
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

            {/* Client Attachments Section */}
            <div className="space-y-2 text-sm text-gray-400">
              <span className="font-semibold uppercase tracking-wider text-gray-500 text-xs">Attachments ({task.attachments?.length || 0})</span>
              {task.attachments && task.attachments.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-800/40 p-4 rounded-xl border border-gray-700/50">
                  {task.attachments.map((attachment: any) => {
                    const fileUrl = getFileUrl(attachment.fileUrl);
                    return (
                      <a
                        key={attachment.id}
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 bg-gray-900/60 hover:bg-gray-900/90 border border-gray-700/50 rounded-xl p-2.5 text-xs text-gray-300 transition-all font-mono"
                      >
                        <FileText size={15} className="text-primary-400 shrink-0" />
                        <span className="truncate" title={attachment.fileName}>{attachment.fileName}</span>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-gray-600 italic bg-gray-850 p-4 rounded-xl border border-gray-800 text-center">
                  No files attached.
                </div>
              )}
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
                      onClick={() => handleStatusUpdate('PENDING_APPROVAL')}
                      disabled={updating}
                      className="inline-flex items-center justify-center rounded-2xl bg-primary-500 px-5 py-3 text-sm font-semibold text-white hover:bg-primary-400 transition-colors disabled:opacity-60"
                    >
                      {updating ? 'Submitting...' : 'Submit for Manager Review'}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-gray-900 border border-gray-700 shadow-2xl rounded-2xl w-[95vw] md:max-w-3xl lg:max-w-5xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-start justify-between p-4 sm:p-6 border-b border-gray-800 bg-gray-800/30 shrink-0">
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
            {/* Show Change ID */}
            {(() => {
              const idMatch = task.description?.match(/\[CHANGE_ID:\s*([^\]]+)\]/);
              const displayId = (task.id && /^\d{12}$/.test(task.id)) ? task.id : (idMatch ? idMatch[1] : task.id);
              if (!displayId) return null;
              return (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-primary-300 font-mono">
                  <span className="text-gray-500">#</span>{displayId}
                </div>
              );
            })()}
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Visual Stepper */}
        {(() => {
          const STAGE_STEPS = [
            { label: 'Request', statuses: ['DRAFT', 'PENDING_APPROVAL'] },
            { label: 'Planning', statuses: ['ASSIGNED'] },
            { label: 'Development', statuses: ['IN_DEVELOPMENT', 'RETURNED_TO_DEVELOPER', 'DELAYED'] },
            { label: 'Testing', statuses: ['TESTING'] },
            { label: 'Review', statuses: ['MANAGER_REVIEW'] },
            { label: 'Deployment', statuses: ['DEPLOYMENT'] },
            { label: 'Final Testing', statuses: ['FINAL_TESTING_OF_PATCH'] },
            { label: 'Closure', statuses: ['COMPLETED', 'REJECTED', 'CANCELLED'] }
          ];

          const activeIdx = STAGE_STEPS.findIndex(s => s.statuses.includes(task.status));
          
          const getPrevCompleter = () => {
            if (!task.statusHistory || task.statusHistory.length === 0) return null;
            const last = [...task.statusHistory].reverse().find(h => h.newStatus === task.status && h.previousStatus !== task.status);
            return last ? {
              name: last.changedByName || last.changedByUsername || 'System',
              role: last.changedByRole || 'User',
              date: new Date(last.createdAt).toLocaleDateString()
            } : null;
          };

          const prevCompleter = getPrevCompleter();

          const getStageResponsible = (idx: number) => {
            switch(idx) {
              case 0: return task.client ? getUserDisplayName(task.client) : (task.author ? getUserDisplayName(task.author) : 'Client / Author');
              case 1: return task.managers && task.managers.length > 0 ? task.managers.map(getUserDisplayName).join(', ') : 'Managers';
              case 2: return task.developers && task.developers.length > 0 ? task.developers.map(getUserDisplayName).join(', ') : 'Developers';
              case 3: return task.verifiers && task.verifiers.length > 0 ? task.verifiers.map(getUserDisplayName).join(', ') : 'Verifiers / QA';
              case 4: return task.managers && task.managers.length > 0 ? task.managers.map(getUserDisplayName).join(', ') : 'Managers';
              case 5: return task.deployer ? getUserDisplayName(task.deployer) : 'Assign Deployer';
              case 6: return task.verifiers && task.verifiers.length > 0 ? task.verifiers.map(getUserDisplayName).join(', ') : 'Verifiers / QA';
              default: return 'None';
            }
          };

          return (
            <div className="bg-gray-950/60 border-b border-gray-800 p-4 shrink-0 space-y-3">
              <div className="flex items-center justify-between overflow-x-auto gap-4 py-2 scrollbar-none">
                {STAGE_STEPS.map((step, idx) => {
                  const isActive = idx === activeIdx;
                  const isCompleted = idx < activeIdx || (task.status === 'COMPLETED' && idx === 7);
                  const isDelayed = isActive && (task.status === 'DELAYED' || (task.plannedEndDate && new Date(task.plannedEndDate).getTime() < Date.now()));
                  const isBlocked = isActive && task.status === 'ON_HOLD';

                  let circleColor = 'border-gray-700 text-gray-500 bg-gray-900';
                  let textColor = 'text-gray-500';
                  if (isCompleted) {
                    circleColor = 'border-emerald-500 text-emerald-400 bg-emerald-950/40';
                    textColor = 'text-gray-300';
                  } else if (isActive) {
                    if (isDelayed) {
                      circleColor = 'border-orange-500 text-orange-400 bg-orange-950/40 animate-pulse';
                      textColor = 'text-orange-400 font-bold';
                    } else if (isBlocked) {
                      circleColor = 'border-yellow-500 text-yellow-400 bg-yellow-950/40 animate-pulse';
                      textColor = 'text-yellow-400 font-bold';
                    } else {
                      circleColor = 'border-primary-500 text-primary-400 bg-primary-950/40 shadow shadow-primary-500/20';
                      textColor = 'text-white font-bold';
                    }
                  }

                  return (
                    <div key={idx} className="flex items-center flex-1 last:flex-initial min-w-[90px] group">
                      <div className="flex flex-col items-center gap-1.5 relative">
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-semibold ${circleColor} transition-all`}>
                          {idx + 1}
                        </div>
                        <span className={`text-[10px] uppercase tracking-wider text-center truncate max-w-[100px] ${textColor}`}>
                          {step.label}
                        </span>
                      </div>
                      {idx < 7 && (
                        <div className={`flex-1 h-0.5 mx-2 rounded ${isCompleted ? 'bg-emerald-600' : 'bg-gray-800'}`} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Ownership Sub-panel */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-gray-900/40 border border-gray-800 rounded-xl px-4 py-2 text-gray-400">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider">Current Stage Owner:</span>
                  <span className="font-semibold text-gray-200">{activeIdx >= 0 ? getStageResponsible(activeIdx) : 'N/A'}</span>
                </div>
                {prevCompleter && (
                  <div className="flex items-center gap-2 border-l border-gray-800 pl-3">
                    <span className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider">Prev Stage Completed By:</span>
                    <span className="text-gray-300 font-medium">{prevCompleter.name} ({prevCompleter.role}) on {prevCompleter.date}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 border-l border-gray-800 pl-3">
                  <span className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider">Next Owner:</span>
                  <span className="text-gray-400 font-medium">
                    {activeIdx < 7 ? getStageResponsible(activeIdx + 1) : 'Closed'}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 custom-scrollbar">

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
                  <div className="flex items-center justify-between gap-3 bg-gray-800/40 p-3 rounded-lg border border-gray-700/50">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-primary-400 hover:text-primary-300 transition-colors select-none">
                      <Paperclip size={14} className="shrink-0" />
                      <span>Attach File (uploads instantly)</span>
                      <input
                        type="file"
                        className="hidden"
                        disabled={isDeleted || updating}
                        onChange={async (e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            const file = e.target.files[0];
                            setUpdating(true);
                            setError('');
                            try {
                              const formData = new FormData();
                              formData.append('file', file);
                              const taskRes = await api.post(`/tasks/${task.id}/attachments`, formData, {
                                headers: {
                                  'Content-Type': 'multipart/form-data',
                                },
                              });
                              const attachments = taskRes.data.attachments || [];
                              const latestAttachment = attachments[attachments.length - 1];
                              if (latestAttachment) {
                                setCommentFiles([...commentFiles, latestAttachment.fileUrl]);
                              }
                              if (onUpdated) {
                                onUpdated(taskRes.data);
                              }
                            } catch (err: any) {
                              setError(err?.response?.data?.error || 'Failed to upload attachment.');
                            } finally {
                              setUpdating(false);
                            }
                          }
                        }}
                      />
                    </label>
                    <span className="text-[10px] text-gray-500">PDF, patches, zip, images supported</span>
                  </div>

                  {/* Draft files list */}
                  {commentFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {commentFiles.map((fileUrl, idx) => {
                        const fileName = fileUrl.substring(fileUrl.lastIndexOf('/') + 1).split('_')[0] + fileUrl.substring(fileUrl.lastIndexOf('.'));
                        return (
                          <span key={idx} className="inline-flex items-center gap-1.5 bg-gray-800/80 hover:bg-gray-800 text-gray-300 text-xs px-2.5 py-1 rounded-full border border-gray-700/60 transition-all shadow-sm">
                            <File size={12} className="text-primary-400" />
                            <span className="font-mono">{fileName}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setCommentFiles(commentFiles.filter((f) => f !== fileUrl));
                              }}
                              className="text-gray-500 hover:text-red-400 transition-colors p-0.5 rounded-full hover:bg-gray-700/50"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        );
                      })}
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
                                const isUrl = typeof file === 'string' && file.startsWith('/uploads/');
                                const fileUrl = isUrl ? getFileUrl(file) : '#';
                                const fileName = isUrl
                                  ? file.substring(file.lastIndexOf('/') + 1).split('_')[0] + file.substring(file.lastIndexOf('.'))
                                  : (typeof file === 'string' ? file : (file.name || 'attachment'));
                                return (
                                  <a
                                    key={idx}
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 bg-gray-900/60 hover:bg-gray-900/95 border border-gray-700/50 rounded-lg px-3 py-1.5 text-xs text-gray-300 transition-all select-none shadow-sm hover:shadow group max-w-xs shrink-0 font-mono"
                                  >
                                    <FileText size={13} className="text-primary-400 group-hover:scale-105 transition-transform" />
                                    <span className="truncate" title={fileName}>{fileName}</span>
                                  </a>
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
                  <CheckCircle2 size={16} /> Move to Next Stage
                </h3>
                <div className="flex flex-col gap-2">
                  <select
                    value=""
                    onChange={(e) => handleStatusUpdate(e.target.value)}
                    disabled={updating || isDeleted}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500 transition-colors disabled:opacity-50"
                  >
                    <option value="">Select next stage...</option>
                    {STATUSES.filter((status) => nextStatuses.includes(status.value)).map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  {updating && <p className="text-xs text-primary-400 text-center mt-1 animate-pulse">Updating...</p>}
                  {error && <p className="text-xs text-danger-300 mt-2">{error}</p>}
                </div>
              </div>
            )}

            {/* ── Approve & Assign card (PENDING_APPROVAL only, managers/admins) ── */}
            {task.status === 'PENDING_APPROVAL' && canAssignResources && !isDeleted && (
              <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/70 rounded-xl p-5 border border-primary-500/30 shadow-lg shadow-primary-500/5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2 text-white mb-1">
                    <CheckCircle2 size={16} className="text-primary-400" /> Approve &amp; Assign
                  </h3>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Set the approved deadline and assign developers &amp; verifiers, then click <span className="text-primary-300 font-semibold">Approve</span> to move the patch to the next stage.
                  </p>
                </div>

                <div className="space-y-3.5">
                  {/* Approved Deadline */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                      Approved Deadline
                      {getClientDeadline(task.description) && (
                        <span className="ml-2 text-[10px] text-primary-400 normal-case font-normal">
                          (Client requested: {new Date(getClientDeadline(task.description)!).toLocaleDateString()})
                        </span>
                      )}
                    </label>
                    <input
                      type="date"
                      value={editPlannedEndDate}
                      onChange={(e) => setEditPlannedEndDate(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary-500 transition-colors"
                    />
                  </div>

                  {/* Developers */}
                  {renderUserSelector(
                    'Developers',
                    usersList.filter((u) => u.role === 'DEVELOPER'),
                    selectedDevIds,
                    setSelectedDevIds
                  )}

                  {/* Testers */}
                  {renderUserSelector(
                    'Testers',
                    usersList.filter((u) => u.role === 'TESTER'),
                    selectedTesterIds,
                    setSelectedTesterIds
                  )}

                  {/* Verifiers */}
                  {renderUserSelector(
                    'Verifiers',
                    usersList.filter((u) => u.role === 'VERIFIER'),
                    selectedVerIds,
                    setSelectedVerIds
                  )}

                  {/* Submit */}
                  <button
                    onClick={handleApproveAndAssign}
                    disabled={updating || !editPlannedEndDate}
                    className="w-full bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg text-xs transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={13} />
                    {updating ? 'Approving…' : 'Approve & Assign Resources'}
                  </button>

                  {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
                </div>
              </div>
            )}

            {/* Bug 3: Auto-assignment alert banner */}
            {autoOpenedAssignment && isEditingAssignments && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3 animate-in slide-in-from-top duration-300">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                  <Users size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-300">Resource Assignment Required</p>
                  <p className="text-xs text-amber-400/80 mt-1">This patch has been approved but needs developers and verifiers assigned before work can begin.</p>
                </div>
              </div>
            )}

            {/* Dynamic Assignments Panel (Multi-Developer & Multi-Verifier) */}
            <div className={`bg-gray-800/50 rounded-xl p-5 border ${autoOpenedAssignment && isEditingAssignments ? 'border-amber-500/40 ring-1 ring-amber-500/20' : 'border-gray-700/50'}`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2 text-white">
                  <Users size={16} /> Resources
                </h3>
                {canEditResources && !isDeleted && (
                  <button
                    onClick={() => {
                      if (isEditingAssignments) {
                        saveAssignments();
                        setAutoOpenedAssignment(false);
                      } else {
                        setIsEditingAssignments(true);
                      }
                    }}
                    className="text-xs font-semibold text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    {isEditingAssignments ? 'Save' : 'Edit'}
                  </button>
                )}
                {/* Always-visible Add Resource button for admins/managers not in edit mode */}
                {canAssignResources && !isDeleted && !isEditingAssignments && ['COMPLETED', 'REJECTED', 'CANCELLED'].includes(task.status) && (
                  <span className="text-xs text-gray-600 italic">Locked</span>
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

                  <div className="space-y-2">
                    <span className="text-xs font-medium text-gray-400">Approved Deadline</span>
                    <input
                      type="date"
                      value={editPlannedEndDate}
                      onChange={(e) => setEditPlannedEndDate(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary-500 transition-colors"
                    />
                  </div>

                  {renderUserSelector(
                    'Managers *',
                    usersList.filter(u => u.role === 'MANAGER' || u.role === 'SUPER_ADMIN'),
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
                    'Testers',
                    usersList.filter(u => u.role === 'TESTER'),
                    selectedTesterIds,
                    setSelectedTesterIds
                  )}

                  {renderUserSelector(
                    'Verifiers',
                    usersList.filter(u => u.role === 'VERIFIER'),
                    selectedVerIds,
                    setSelectedVerIds
                  )}

                  {renderUserSelector(
                    'Deployers',
                    usersList.filter(u => u.role === 'DEPLOYER'),
                    selectedDeployerIds,
                    setSelectedDeployerIds
                  )}

                  <div className="space-y-2">
                    <span className="text-xs font-medium text-gray-400">Deployer</span>
                    <select
                      value={editDeployerId}
                      onChange={(e) => setEditDeployerId(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary-500 transition-colors"
                    >
                      <option value="">Select Deployer</option>
                      {usersList.filter(u => u.role === 'DEPLOYER').map((u) => {
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
                    <span className="text-xs font-medium text-gray-400">Deployment Target</span>
                    <input
                      type="text"
                      value={editDeploymentTarget}
                      onChange={(e) => setEditDeploymentTarget(e.target.value)}
                      placeholder="e.g. Production Server, UAT Environment"
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary-500 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-medium text-gray-400">Rollback Plan</span>
                    <textarea
                      value={editRollbackPlan}
                      onChange={(e) => setEditRollbackPlan(e.target.value)}
                      placeholder="Describe how to revert if the deployment fails"
                      rows={3}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary-500 transition-colors resize-none"
                    />
                  </div>

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


                </div>
              ) : (
                <div className="space-y-3.5 text-sm text-gray-300">
                  <div className="flex justify-between items-start">
                    <span className="text-gray-500">Client:</span>
                    <span className="font-medium text-gray-200">{task.client ? getUserDisplayName(task.client) : 'Internal Request'}</span>
                  </div>
                  {/* Show client phone if stored in description */}
                  {(() => {
                    const phoneMatch = task.description?.match(/\[CLIENT_PHONE:\s*([^\]]+)\]/);
                    if (!phoneMatch) return null;
                    return (
                      <div className="flex justify-between items-start">
                        <span className="text-gray-500">Client Phone:</span>
                        <span className="font-medium text-primary-300 font-mono text-xs">{phoneMatch[1]}</span>
                      </div>
                    );
                  })()}

                  {getClientDeadline(task.description) && (
                    <div className="flex justify-between items-start border-t border-gray-700/30 pt-2.5">
                      <span className="text-gray-500 font-semibold text-primary-400">Requested Deadline:</span>
                      <span className="text-primary-300 font-medium font-mono text-xs">{new Date(getClientDeadline(task.description)!).toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-start">
                    <span className="text-gray-500 font-semibold text-primary-400">Approved Deadline:</span>
                    {task.plannedEndDate ? (
                      <span className="text-emerald-400 font-medium font-mono text-xs">{new Date(task.plannedEndDate).toLocaleDateString()}</span>
                    ) : (
                      <span className="text-amber-400 font-medium italic text-xs">Pending Manager Approval</span>
                    )}
                  </div>

                  <div className="border-t border-gray-700/30 pt-2.5">
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
                    <span className="text-gray-500 block mb-1">Testers:</span>
                    {task.testers && task.testers.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-0.5 text-xs text-gray-300">
                        {task.testers.map((t, i) => (
                          <li key={i}>{getUserDisplayName(t)}</li>
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
                  <div>
                    <span className="text-gray-500 block mb-1">Deployers:</span>
                    {task.deployers && task.deployers.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-0.5 text-xs text-gray-300">
                        {task.deployers.map((d, i) => (
                          <li key={i}>{getUserDisplayName(d)}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs text-gray-600 italic">None assigned</span>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-1">Deployer:</span>
                    {task.deployer ? (
                      <span className="font-medium text-gray-200">{getUserDisplayName(task.deployer)}</span>
                    ) : (
                      <span className="text-xs text-gray-600 italic">None assigned</span>
                    )}
                  </div>
                  {task.deploymentTarget && (
                    <div>
                      <span className="text-gray-500 block mb-1">Deployment Target:</span>
                      <span className="font-medium text-gray-200 text-xs">{task.deploymentTarget}</span>
                    </div>
                  )}
                  {task.rollbackPlan && (
                    <div>
                      <span className="text-gray-500 block mb-1">Rollback Plan:</span>
                      <p className="font-medium text-gray-200 text-xs whitespace-pre-wrap">{task.rollbackPlan}</p>
                    </div>
                  )}
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
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition disabled:opacity-50 ${isDeleted
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-red-600/90 hover:bg-red-500 text-white'
                    }`}
                >
                  {isDeleted ? <RotateCcw size={16} /> : <Trash2 size={16} />}
                  {isDeleted ? 'Restore Patch' : 'Soft Delete Patch'}
                </button>
              </div>
            )}

            {/* Attachments Section */}
            <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50 text-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Paperclip size={16} /> Attachments ({task.attachments?.length || 0})
                </h3>
                {/* Upload button directly in attachments panel */}
                {!isDeleted && (
                  <label className="text-xs font-semibold text-primary-400 hover:text-primary-300 transition-colors cursor-pointer select-none">
                    Upload
                    <input
                      type="file"
                      className="hidden"
                      disabled={updating}
                      onChange={async (e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          const file = e.target.files[0];
                          setUpdating(true);
                          setError('');
                          try {
                            const formData = new FormData();
                            formData.append('file', file);
                            const taskRes = await api.post(`/tasks/${task.id}/attachments`, formData, {
                              headers: {
                                'Content-Type': 'multipart/form-data',
                              },
                            });
                            if (onUpdated) {
                              onUpdated(taskRes.data);
                            }
                          } catch (err: any) {
                            setError(err?.response?.data?.error || 'Failed to upload attachment.');
                          } finally {
                            setUpdating(false);
                          }
                        }
                      }}
                    />
                  </label>
                )}
              </div>

              {task.attachments && task.attachments.length > 0 ? (
                <div className="space-y-2.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                  {task.attachments.map((attachment: any) => {
                    const fileUrl = getFileUrl(attachment.fileUrl);
                    const formattedSize = attachment.size
                      ? (attachment.size > 1024 * 1024
                        ? `${(attachment.size / (1024 * 1024)).toFixed(1)} MB`
                        : `${(attachment.size / 1024).toFixed(0)} KB`)
                      : 'N/A';
                    return (
                      <div key={attachment.id} className="bg-gray-900/60 hover:bg-gray-900/90 border border-gray-700/50 rounded-xl p-2.5 flex items-start gap-2.5 transition-all">
                        <FileText size={16} className="text-primary-400 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-gray-200 hover:text-primary-300 transition-colors block truncate font-mono"
                            title={attachment.fileName}
                          >
                            {attachment.fileName}
                          </a>
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mt-1">
                            <span>{formattedSize}</span>
                            <span>•</span>
                            <span className="truncate" title={attachment.uploader?.name || 'Unknown'}>By {attachment.uploader?.name || 'Unknown'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-gray-500 italic text-center py-4 border border-dashed border-gray-700 rounded-xl">
                  No files attached yet.
                </div>
              )}
            </div>

            <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50 text-white">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Dates</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 flex items-center gap-1"><CalendarDays size={14} /> Given</span>
                  <span className="text-gray-300">{task.dateGiven ? new Date(task.dateGiven).toLocaleDateString() : new Date(task.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 flex items-center gap-1"><Clock size={14} /> Started</span>
                  <span className="text-gray-300">{task.dateStarted ? new Date(task.dateStarted).toLocaleDateString() : 'Not started'}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 flex items-center gap-1"><CheckCircle2 size={14} /> Ended</span>
                  <span className="text-gray-300">{task.dateEnded ? new Date(task.dateEnded).toLocaleDateString() : 'In progress'}</span>
                </div>
                {getClientDeadline(task.description) && (
                  <div className="flex justify-between items-center text-sm border-t border-gray-700/30 pt-2 mt-2">
                    <span className="text-gray-500 flex items-center gap-1 font-semibold"><Clock size={14} /> Requested Deadline</span>
                    <span className="text-primary-300 font-medium font-mono">{new Date(getClientDeadline(task.description)!).toLocaleDateString()}</span>
                  </div>
                )}
                {/* Bug 2 fix: Inline editable Approved Deadline */}
                <div className="border-t border-gray-700/30 pt-2 mt-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 flex items-center gap-1 font-semibold"><CheckCircle2 size={14} /> Approved Deadline</span>
                    {!isEditingDeadline ? (
                      <div className="flex items-center gap-2">
                        {task.plannedEndDate ? (
                          <span className="text-emerald-400 font-medium font-mono">{new Date(task.plannedEndDate).toLocaleDateString()}</span>
                        ) : (
                          <span className="text-amber-400 font-medium italic">Pending Approval</span>
                        )}
                        {canAssignResources && !isDeleted && !['COMPLETED', 'REJECTED', 'CANCELLED'].includes(task.status) && (
                          <button
                            onClick={() => {
                              setInlineDeadline(task.plannedEndDate ? task.plannedEndDate.split('T')[0] : '');
                              setIsEditingDeadline(true);
                            }}
                            className="text-[10px] font-semibold text-primary-400 hover:text-primary-300 transition-colors bg-primary-500/10 hover:bg-primary-500/20 border border-primary-500/20 px-2 py-0.5 rounded-md"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={inlineDeadline}
                          onChange={(e) => setInlineDeadline(e.target.value)}
                          className="bg-gray-900 border border-gray-700 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-primary-500 transition-colors w-[130px]"
                        />
                        <button
                          onClick={async () => {
                            if (!inlineDeadline) {
                              setError('Please select a deadline date.');
                              return;
                            }
                            setSavingDeadline(true);
                            setError('');
                            try {
                              const updated = await updateTaskDetails(task.id, {
                                plannedEndDate: inlineDeadline,
                              });
                              setIsEditingDeadline(false);
                              if (onUpdated) onUpdated(updated);
                            } catch (err: any) {
                              setError(err?.response?.data?.error || 'Failed to update deadline.');
                            } finally {
                              setSavingDeadline(false);
                            }
                          }}
                          disabled={savingDeadline}
                          className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-2 py-0.5 rounded-md disabled:opacity-50"
                        >
                          {savingDeadline ? '...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setIsEditingDeadline(false)}
                          className="text-[10px] font-semibold text-gray-400 hover:text-gray-300 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Status History Timeline & Audit Log Tabs */}
            <div>
              <div className="flex items-center gap-4 border-b border-gray-800 pb-3 mb-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('timeline')}
                  className={`text-sm font-semibold uppercase tracking-wider flex items-center gap-2 pb-1 transition-colors border-b-2 ${activeTab === 'timeline'
                      ? 'text-primary-400 border-primary-500'
                      : 'text-gray-400 border-transparent hover:text-gray-200'
                    }`}
                >
                  <Clock size={16} /> Workflow Timeline
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('audit')}
                  className={`text-sm font-semibold uppercase tracking-wider flex items-center gap-2 pb-1 transition-colors border-b-2 ${activeTab === 'audit'
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
