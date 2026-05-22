import { useEffect, useState } from 'react';
import api from '../api/client';
import { Activity, CheckCircle, Clock, RotateCcw, TrendingUp, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CreatePatchModal } from '../components/CreatePatchModal';
import { useAuthStore } from '../store/authStore';

interface DashboardTask {
  id: string;
  title: string;
  description: string;
  status: string;
  module?: { name: string };
  assignee?: { name?: string; firstName?: string; lastName?: string; username?: string };
  createdAt: string;
}

/** Safely get display name for a task's assignee */
function getAssigneeName(assignee?: DashboardTask['assignee']): string {
  if (!assignee) return 'Unassigned';
  if (assignee.firstName) {
    return assignee.lastName
      ? `${assignee.firstName} ${assignee.lastName}`
      : assignee.firstName;
  }
  return assignee.name || assignee.username || 'Unassigned';
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT:                 { label: 'Draft',            color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  ASSIGNED:              { label: 'Assigned',         color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  PENDING_APPROVAL:      { label: 'Pending Approval', color: 'bg-warning-500/10 text-warning-500 border-warning-500/20' },
  IN_DEVELOPMENT:        { label: 'In Development',   color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  VERIFYING:             { label: 'Verifying',        color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  COMPLETED:             { label: 'Completed',        color: 'bg-success-500/10 text-success-500 border-success-500/20' },
  RETURNED_TO_DEVELOPER: { label: 'Returned',         color: 'bg-danger-500/10 text-danger-400 border-danger-500/20' },
  REJECTED:              { label: 'Rejected',         color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  DELAYED:               { label: 'Delayed',          color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  ON_HOLD:               { label: 'On Hold',          color: 'bg-yellow-600/10 text-yellow-500 border-yellow-600/20' },
  CANCELLED:             { label: 'Cancelled',        color: 'bg-gray-600/10 text-gray-400 border-gray-600/20' },
};

const Dashboard = () => {
  const currentUser = useAuthStore((state) => state.user);
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setCreateOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/tasks');
      setTasks(res.data || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  const totalTasks = tasks.length;
  const deployed   = tasks.filter(t => t.status === 'COMPLETED').length;
  const inProgress = tasks.filter(t => !['COMPLETED', 'DRAFT', 'REJECTED', 'CANCELLED', 'DELAYED', 'ON_HOLD'].includes(t.status)).length;
  const returned   = tasks.filter(t => t.status === 'RETURNED_TO_DEVELOPER').length;

  const recentActive = tasks.filter(t => !['COMPLETED', 'REJECTED', 'CANCELLED'].includes(t.status)).slice(0, 5);
  const recentDone   = tasks.filter(t => t.status === 'COMPLETED').slice(0, 5);
  const canCreatePatch = currentUser?.role === 'SUPER_ADMIN' ||
                         currentUser?.role === 'ADMIN' ||
                         currentUser?.role === 'MANAGER' ||
                         currentUser?.role === 'DEVELOPER' ||
                         currentUser?.role === 'CLIENT';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="text-gray-400 mt-2">Patch Deployment Overview — monitor all patches across 10 modules.</p>
        </div>
        {canCreatePatch && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-400"
          >
            <Plus size={16} /> Create Patch
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card p-6 flex items-center space-x-4 hover:border-primary-500/50 transition-colors">
          <div className="p-3 bg-primary-500/20 text-primary-500 rounded-lg">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-400">Total Patches</p>
            <p className="text-3xl font-bold text-white">{totalTasks}</p>
          </div>
        </div>

        <div className="glass-card p-6 flex items-center space-x-4 hover:border-warning-500/50 transition-colors">
          <div className="p-3 bg-warning-500/20 text-warning-500 rounded-lg">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-400">In Progress</p>
            <p className="text-3xl font-bold text-white">{inProgress}</p>
          </div>
        </div>

        <div className="glass-card p-6 flex items-center space-x-4 hover:border-success-500/50 transition-colors">
          <div className="p-3 bg-success-500/20 text-success-500 rounded-lg">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-400">Deployed</p>
            <p className="text-3xl font-bold text-white">{deployed}</p>
          </div>
        </div>

        <div className="glass-card p-6 flex items-center space-x-4 hover:border-danger-500/50 transition-colors">
          <div className="p-3 bg-danger-500/20 text-danger-400 rounded-lg">
            <RotateCcw size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-400">Returned</p>
            <p className="text-3xl font-bold text-white">{returned}</p>
          </div>
        </div>
      </div>

      {canCreatePatch && <CreatePatchModal open={isCreateOpen} onClose={() => setCreateOpen(false)} onCreated={fetchData} />}

      {/* Workflow Status Summary */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <TrendingUp size={20} className="text-primary-500" />
          Workflow Pipeline
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {Object.entries(STATUS_LABELS).map(([status, { label, color }]) => {
            const count = tasks.filter(t => t.status === status).length;
            return (
              <div key={status} className={`flex flex-col items-center p-3 rounded-lg border ${color}`}>
                <span className="text-2xl font-bold">{count}</span>
                <span className="text-[10px] font-medium uppercase tracking-wider mt-1 text-center">{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Active Tasks */}
        <div className="glass-card flex flex-col">
          <div className="p-6 border-b border-gray-700/50 flex justify-between items-center">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-warning-500"></span>
              Active Patches
            </h2>
            <Link to="/patches" className="text-sm text-primary-500 hover:text-primary-400 transition-colors">
              View Board →
            </Link>
          </div>
          <div className="p-6 flex-1">
            {recentActive.length > 0 ? (
              <div className="space-y-4">
                {recentActive.map((task) => {
                  const s = STATUS_LABELS[task.status] || { label: task.status, color: '' };
                  return (
                    <div key={task.id} className="flex flex-col p-4 bg-gray-900/50 rounded-lg border border-gray-700/30 hover:border-gray-600 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-gray-200 line-clamp-1">{task.title}</h3>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full border ${s.color}`}>
                          {s.label}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400 flex items-center justify-between">
                        <span>{task.module?.name || 'No Module'}</span>
                        <span>{getAssigneeName(task.assignee)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 py-8">
                <Clock className="mb-2 opacity-50" size={32} />
                <p>No active patches right now.</p>
              </div>
            )}
          </div>
        </div>

        {/* Deployed Patches */}
        <div className="glass-card flex flex-col">
          <div className="p-6 border-b border-gray-700/50 flex justify-between items-center">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success-500"></span>
              Recently Deployed
            </h2>
            <Link to="/patches" className="text-sm text-primary-500 hover:text-primary-400 transition-colors">
              View Board →
            </Link>
          </div>
          <div className="p-6 flex-1">
            {recentDone.length > 0 ? (
              <div className="space-y-4">
                {recentDone.map((task) => (
                  <div key={task.id} className="flex flex-col p-4 bg-gray-900/50 rounded-lg border border-gray-700/30 hover:border-gray-600 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-gray-200 line-clamp-1">{task.title}</h3>
                      <span className="text-xs font-medium px-2 py-1 bg-success-500/10 text-success-500 rounded-full border border-success-500/20">
                        Deployed
                      </span>
                    </div>
                    <div className="text-sm text-gray-400 flex items-center justify-between">
                      <span>{task.module?.name || 'No Module'}</span>
                      <span>{getAssigneeName(task.assignee)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 py-8">
                <CheckCircle className="mb-2 opacity-50" size={32} />
                <p>No deployed patches yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
