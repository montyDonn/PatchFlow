import { useState } from 'react';
import { useTasks } from '../hooks/useTasks';
import { PatchColumn } from '../components/patches/PatchColumn';
import { PatchDetailsModal } from '../components/patches/PatchDetailsModal';
import { CreatePatchModal } from '../components/CreatePatchModal';
import type { Task } from '../api/tasks';
import api from '../api/client';
import { Clock, ShieldCheck, Send, PlayCircle, CheckCircle2, Search, Filter, Plus, Trash2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const COLUMNS = [
  {
    id: "DRAFT",
    title: "Draft",
    icon: <Clock size={18} className="text-gray-400" />,
    statuses: ["DRAFT"],
    borderClass: "border-gray-500",
    bgClass: "bg-gray-800/40",
  },
  {
    id: "PENDING_APPROVAL",
    title: "Pending Approval",
    icon: <ShieldCheck size={18} className="text-yellow-400" />,
    statuses: ["PENDING_APPROVAL"],
    borderClass: "border-yellow-500",
    bgClass: "bg-yellow-500/10",
  },
  {
    id: "ASSIGNED",
    title: "Assigned / In Progress",
    icon: <Send size={18} className="text-blue-400" />,
    statuses: ["ASSIGNED", "IN_DEVELOPMENT", "RETURNED_TO_DEVELOPER"],
    borderClass: "border-blue-500",
    bgClass: "bg-blue-500/10",
  },
  {
    id: "VERIFYING",
    title: "Verifying",
    icon: <PlayCircle size={18} className="text-purple-400" />,
    statuses: ["VERIFYING"],
    borderClass: "border-purple-500",
    bgClass: "bg-purple-500/10",
  },
  {
    id: "COMPLETED",
    title: "Completed & Final",
    icon: <CheckCircle2 size={18} className="text-green-400" />,
    statuses: ["COMPLETED", "REJECTED", "DELAYED", "ON_HOLD", "CANCELLED"],
    borderClass: "border-green-500",
    bgClass: "bg-green-500/10",
  },
  {
    id: "DELETED",
    title: "Deleted",
    icon: <Trash2 size={18} className="text-red-400" />,
    statuses: [],
    borderClass: "border-red-500",
    bgClass: "bg-red-500/10",
  },
];

export default function PatchBoardPage() {
  const currentUser = useAuthStore((state) => state.user);
  const canCreatePatch = currentUser?.role === 'SUPER_ADMIN' ||
                         currentUser?.role === 'MANAGER' ||
                         currentUser?.role === 'DEVELOPER' ||
                         currentUser?.role === 'CLIENT';
  const { 
    tasks, modules, users, loading, error, 
    search, setSearch,
    selectedModule, setSelectedModule,
    selectedAssignee, setSelectedAssignee,
    includeDeleted, setIncludeDeleted,
    updateTaskStatus,
    addComment,
    deleteTask,
    restoreDeletedTask,
    refresh,
  } = useTasks();

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);

  // Re-fetch full task data (with comments, timeline, attachments, audit logs)
  // before opening the details modal. The list-level objects are lightweight
  // and lack nested relationships needed for the PatchDetailsModal.
  const handleTaskClick = async (task: Task) => {
    try {
      const res = await api.get(`/tasks/${task.id}`);
      setSelectedTask(res.data);
    } catch (error) {
      console.error('Error fetching full task details:', error);
      // Fallback to the list-level object if fetch fails
      setSelectedTask(task);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-danger-400">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
      {/* Header & Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Change Board</h2>
            <p className="text-sm text-gray-400 mt-1">Manage the lifecycle of all changes</p>
          </div>
          {canCreatePatch && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-400"
            >
              <Plus size={16} /> Create Change
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 bg-gray-800/40 p-3 rounded-xl border border-gray-700/50">
          <div className="w-full sm:flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text"
              placeholder="Search by name, ID, developer, manager, client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>
          
          <div className="w-full sm:w-auto flex items-center gap-2">
            <Filter size={16} className="text-gray-400 hidden sm:block" />
            <select 
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="w-full sm:w-auto bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500 transition-colors"
            >
              <option value="">All Modules</option>
              {modules.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <select 
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="w-full sm:w-auto bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500 transition-colors"
            >
              <option value="">All Assignees</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name || u.username || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unknown'}</option>
              ))}
            </select>
          </div>
          {currentUser?.role === 'SUPER_ADMIN' && (
            <label className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(e) => setIncludeDeleted(e.target.checked)}
                className="accent-primary-500 cursor-pointer"
              />
              Show deleted
            </label>
          )}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
        <div className="flex gap-5 min-w-max h-full items-start">
          {COLUMNS.map(col => {
            let colTasks;
            if (col.id === "DELETED") {
              colTasks = tasks.filter(t => t.lifecycleStatus === 100);
            } else {
              colTasks = tasks.filter(t => t.lifecycleStatus !== 100 && col.statuses.includes(t.status));
            }

            if (col.id === "DELETED" && !includeDeleted) {
              return null;
            }

            return (
              <PatchColumn 
                key={col.id}
                id={col.id}
                title={col.title}
                icon={col.icon}
                borderClass={col.borderClass}
                bgClass={col.bgClass}
                tasks={colTasks}
                onTaskClick={handleTaskClick}
              />
            );
          })}
        </div>
      </div>

      {/* Task Details Modal */}
      {selectedTask && (
        <PatchDetailsModal 
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onStatusChange={async (id, status, reason) => {
            await updateTaskStatus(id, status, reason);
            setSelectedTask(null);
          }}
          onCommentAdded={async (id, content, files) => {
            const updated = await addComment(id, content, files);
            setSelectedTask(updated);
          }}
          onDelete={async (id) => {
            await deleteTask(id);
            setSelectedTask(null);
          }}
          onRestore={async (id) => {
            const updated = await restoreDeletedTask(id);
            setSelectedTask(updated);
          }}
          onUpdated={async (updatedTask) => {
            await refresh();
            setSelectedTask((current) => (current === null ? null : updatedTask));
          }}
        />
      )}
      <CreatePatchModal
        open={isCreateOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={refresh}
      />
    </div>
  );
}
