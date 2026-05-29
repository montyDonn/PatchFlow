import { useEffect, useState, useMemo } from 'react';
import api from '../api/client';
import {
  Activity, CheckCircle, Clock, RotateCcw, FileText, UserCheck,
  ShieldCheck, Code2, Search, XCircle, PauseCircle, TimerOff,
  Ban, ArrowRight, X, Layers
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { PatchDetailsModal } from '../components/patches/PatchDetailsModal';

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

/* ── Status configuration ──────────────────────────────────── */

const STAGES: {
  status: string;
  label: string;
  icon: React.ReactNode;
  gradient: string;
  ring: string;
  bg: string;
  text: string;
  border: string;
  glow: string;
  chartColor: string;
}[] = [
  {
    status: 'DRAFT',
    label: 'Draft',
    icon: <FileText size={18} />,
    gradient: 'from-slate-500 to-slate-600',
    ring: 'ring-slate-400/40',
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    border: 'border-slate-500/30',
    glow: 'shadow-slate-500/20',
    chartColor: '#94a3b8',
  },
  {
    status: 'ASSIGNED',
    label: 'Assigned',
    icon: <UserCheck size={18} />,
    gradient: 'from-blue-500 to-blue-600',
    ring: 'ring-blue-400/40',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    glow: 'shadow-blue-500/20',
    chartColor: '#60a5fa',
  },
  {
    status: 'PENDING_APPROVAL',
    label: 'Pending Approval',
    icon: <ShieldCheck size={18} />,
    gradient: 'from-amber-500 to-amber-600',
    ring: 'ring-amber-400/40',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    glow: 'shadow-amber-500/20',
    chartColor: '#fbbf24',
  },
  {
    status: 'IN_DEVELOPMENT',
    label: 'In Development',
    icon: <Code2 size={18} />,
    gradient: 'from-purple-500 to-purple-600',
    ring: 'ring-purple-400/40',
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    glow: 'shadow-purple-500/20',
    chartColor: '#a78bfa',
  },
  {
    status: 'VERIFYING',
    label: 'Verifying',
    icon: <Search size={18} />,
    gradient: 'from-indigo-500 to-indigo-600',
    ring: 'ring-indigo-400/40',
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-400',
    border: 'border-indigo-500/30',
    glow: 'shadow-indigo-500/20',
    chartColor: '#818cf8',
  },
  {
    status: 'COMPLETED',
    label: 'Completed',
    icon: <CheckCircle size={18} />,
    gradient: 'from-emerald-500 to-emerald-600',
    ring: 'ring-emerald-400/40',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    glow: 'shadow-emerald-500/20',
    chartColor: '#34d399',
  },
  {
    status: 'RETURNED_TO_DEVELOPER',
    label: 'Returned',
    icon: <RotateCcw size={18} />,
    gradient: 'from-rose-500 to-rose-600',
    ring: 'ring-rose-400/40',
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
    glow: 'shadow-rose-500/20',
    chartColor: '#fb7185',
  },
  {
    status: 'REJECTED',
    label: 'Rejected',
    icon: <XCircle size={18} />,
    gradient: 'from-red-500 to-red-600',
    ring: 'ring-red-400/40',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/30',
    glow: 'shadow-red-500/20',
    chartColor: '#f87171',
  },
  {
    status: 'DELAYED',
    label: 'Delayed',
    icon: <TimerOff size={18} />,
    gradient: 'from-orange-500 to-orange-600',
    ring: 'ring-orange-400/40',
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
    glow: 'shadow-orange-500/20',
    chartColor: '#fb923c',
  },
  {
    status: 'ON_HOLD',
    label: 'On Hold',
    icon: <PauseCircle size={18} />,
    gradient: 'from-yellow-500 to-yellow-600',
    ring: 'ring-yellow-400/40',
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
    glow: 'shadow-yellow-500/20',
    chartColor: '#facc15',
  },
  {
    status: 'CANCELLED',
    label: 'Cancelled',
    icon: <Ban size={18} />,
    gradient: 'from-gray-500 to-gray-600',
    ring: 'ring-gray-400/40',
    bg: 'bg-gray-500/10',
    text: 'text-gray-400',
    border: 'border-gray-500/30',
    glow: 'shadow-gray-500/20',
    chartColor: '#9ca3af',
  },
];

/* ── Donut Chart Component ─────────────────────────────────── */

function DonutChart({
  segments,
  total,
  selectedStatus,
}: {
  segments: { status: string; count: number; color: string }[];
  total: number;
  selectedStatus: string | null;
}) {
  const SIZE = 180;
  const STROKE = 18;
  const RADIUS = (SIZE - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  const nonZero = segments.filter(s => s.count > 0);
  let accumulated = 0;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={STROKE}
        />
        {/* Segments */}
        {nonZero.map((seg) => {
          const fraction = seg.count / (total || 1);
          const dashLen = fraction * CIRCUMFERENCE;
          const offset = (accumulated / (total || 1)) * CIRCUMFERENCE;
          accumulated += seg.count;

          const isSelected = selectedStatus === seg.status;
          const isOther = selectedStatus && !isSelected;

          return (
            <circle
              key={seg.status}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={seg.color}
              strokeWidth={isSelected ? STROKE + 4 : STROKE}
              strokeDasharray={`${dashLen} ${CIRCUMFERENCE - dashLen}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              className="transition-all duration-500"
              style={{
                opacity: isOther ? 0.25 : 1,
                ['--circumference' as any]: CIRCUMFERENCE,
                ['--dash-offset' as any]: CIRCUMFERENCE - dashLen,
              }}
            />
          );
        })}
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-gray-100">{total}</span>
        <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">
          {selectedStatus
            ? STAGES.find(s => s.status === selectedStatus)?.label || 'Patches'
            : 'Total'}
        </span>
      </div>
    </div>
  );
}

/* ── Main Dashboard ────────────────────────────────────────── */

const Dashboard = () => {
  const currentUser = useAuthStore((state) => state.user);
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [stageTasks, setStageTasks] = useState<DashboardTask[]>([]);
  const [stageLoading, setStageLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  const handleTaskClick = async (taskId: string) => {
    try {
      const res = await api.get(`/tasks/${taskId}`);
      setSelectedTask(res.data);
    } catch (error) {
      console.error('Error fetching task details:', error);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string, reason?: string) => {
    await api.patch(`/tasks/${taskId}/status`, { status: newStatus, reason });
    await fetchData();
    if (selectedStage) {
      const res = await api.get(`/tasks?status=${selectedStage}`);
      setStageTasks(res.data || []);
    }
  };

  const handleCommentAdded = async (taskId: string, content: string, files?: string[]) => {
    await api.post(`/tasks/${taskId}/comments`, { content, files });
    const res = await api.get(`/tasks/${taskId}`);
    setSelectedTask(res.data);
  };

  const handleDelete = async (taskId: string) => {
    await api.delete(`/tasks/${taskId}`);
    setSelectedTask(null);
    await fetchData();
    if (selectedStage) {
      const res = await api.get(`/tasks?status=${selectedStage}`);
      setStageTasks(res.data || []);
    }
  };

  const handleRestore = async (taskId: string) => {
    await api.post(`/tasks/${taskId}/restore`);
    const res = await api.get(`/tasks/${taskId}`);
    setSelectedTask(res.data);
    await fetchData();
    if (selectedStage) {
      const res = await api.get(`/tasks?status=${selectedStage}`);
      setStageTasks(res.data || []);
    }
  };

  const handleUpdated = async (updatedTask: any) => {
    setSelectedTask(updatedTask);
    await fetchData();
    if (selectedStage) {
      const res = await api.get(`/tasks?status=${selectedStage}`);
      setStageTasks(res.data || []);
    }
  };

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

  const handleStageClick = async (status: string) => {
    if (selectedStage === status) {
      setSelectedStage(null);
      setStageTasks([]);
    } else {
      setSelectedStage(status);
      setStageLoading(true);
      try {
        const res = await api.get(`/tasks?status=${status}`);
        setStageTasks(res.data || []);
      } catch (error) {
        console.error('Error fetching stage tasks:', error);
      } finally {
        setStageLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  /* Derived data */
  const stageCounts = useMemo(() => {
    const map: Record<string, number> = {};
    STAGES.forEach(s => { map[s.status] = 0; });
    tasks.forEach(t => {
      if (map[t.status] !== undefined) map[t.status]++;
    });
    return map;
  }, [tasks]);

  const donutSegments = useMemo(
    () => STAGES.map(s => ({ status: s.status, count: stageCounts[s.status] || 0, color: s.chartColor })),
    [stageCounts],
  );

  const recentAll = useMemo(
    () => [...tasks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8),
    [tasks],
  );

  const selectedStageConfig = STAGES.find(s => s.status === selectedStage);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  const totalTasks = tasks.length;
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="space-y-8 animate-in fade-in duration-500 custom-scrollbar">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-gray-100">
          {greeting}, {currentUser?.firstName || currentUser?.username || 'there'}
        </h1>
        <p className="text-gray-400 text-sm">
          Here's what's happening across your change management pipeline.
        </p>
      </div>

      {/* ── Overview Row: Donut + Stage Cards ───────────── */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Donut card */}
        <div className="glass-card p-6 flex flex-col items-center justify-center min-w-[240px] animate-fade-slide-up">
          <DonutChart
            segments={donutSegments}
            total={selectedStage ? (stageCounts[selectedStage] || 0) : totalTasks}
            selectedStatus={selectedStage}
          />
          <p className="text-xs text-gray-500 mt-4 text-center">
            Click a stage to filter
          </p>
        </div>

        {/* Stage cards grid */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {STAGES.map((stage, idx) => {
            const count = stageCounts[stage.status] || 0;
            const isSelected = selectedStage === stage.status;
            const hasPatches = count > 0;

            return (
              <button
                key={stage.status}
                onClick={() => handleStageClick(stage.status)}
                className={`
                  animate-fade-slide-up stagger-${idx + 1}
                  relative group flex flex-col items-start p-4 rounded-xl border
                  transition-all duration-300 cursor-pointer select-none text-left
                  ${isSelected
                    ? `${stage.border} ${stage.bg} ring-2 ${stage.ring} shadow-lg ${stage.glow}`
                    : 'border-gray-700/40 bg-gray-800/40 hover:border-gray-600/60 hover:bg-gray-800/70'
                  }
                `}
              >
                {/* Icon + Label */}
                <div className="flex items-center gap-2 mb-3 w-full">
                  <div className={`p-1.5 rounded-lg ${stage.bg} ${stage.text} transition-colors`}>
                    {stage.icon}
                  </div>
                  <span className={`text-xs font-semibold uppercase tracking-wider truncate ${
                    isSelected ? stage.text : 'text-gray-400 group-hover:text-gray-300'
                  } transition-colors`}>
                    {stage.label}
                  </span>
                </div>

                {/* Count */}
                <div className="flex items-end gap-2 w-full">
                  <span className={`text-2xl font-bold ${isSelected ? 'text-white' : 'text-gray-200'} transition-colors`}>
                    {count}
                  </span>
                  {hasPatches && !isSelected && (
                    <span className={`w-1.5 h-1.5 rounded-full mb-2 ${stage.text} animate-pulse-glow`} />
                  )}
                </div>

                {/* Hover arrow */}
                <div className={`absolute right-3 bottom-3 ${stage.text} opacity-0 group-hover:opacity-70 transition-opacity`}>
                  <ArrowRight size={14} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Filtered Patch List / Default Recent Activity ── */}
      {selectedStage && selectedStageConfig ? (
        <div className="glass-card flex flex-col animate-fade-slide-up">
          {/* Header */}
          <div className="p-5 border-b border-gray-700/50 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-100 flex items-center gap-3">
              <span className={`p-1.5 rounded-lg ${selectedStageConfig.bg} ${selectedStageConfig.text}`}>
                {selectedStageConfig.icon}
              </span>
              {selectedStageConfig.label} Patches
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${selectedStageConfig.bg} ${selectedStageConfig.text}`}>
                {stageTasks.length}
              </span>
            </h2>
            <button
              onClick={() => { setSelectedStage(null); setStageTasks([]); }}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors border border-gray-700"
            >
              <X size={14} />
              Clear
            </button>
          </div>

          {/* Content */}
          <div className="p-5">
            {stageLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-6 h-6 rounded-full border-2 border-primary-500/20 border-t-primary-500 animate-spin" />
                <p className="text-xs text-gray-500">Fetching patches…</p>
              </div>
            ) : stageTasks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {stageTasks.map((task, i) => (
                  <div
                    key={task.id}
                    className={`
                      animate-fade-slide-up stagger-${Math.min(i + 1, 11)}
                      group flex flex-col p-4 rounded-xl border border-gray-700/30
                      bg-gray-900/50 hover:bg-gray-800/70 hover:border-gray-600/50
                      transition-all duration-200 hover:shadow-md hover:shadow-black/20 cursor-pointer
                    `}
                    onClick={() => handleTaskClick(task.id)}
                  >
                    <div className="flex justify-between items-start gap-3 mb-3">
                      <h3 className="font-semibold text-gray-200 line-clamp-1 group-hover:text-white transition-colors">
                        {task.title}
                      </h3>
                      <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${selectedStageConfig.bg} ${selectedStageConfig.text} ${selectedStageConfig.border} border`}>
                        {selectedStageConfig.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-800/50">
                      <span className="text-xs text-gray-500 flex items-center gap-1.5">
                        <Layers size={12} />
                        {task.module?.name || 'No Module'}
                      </span>
                      <span className="text-xs text-gray-400 font-medium">
                        {getAssigneeName(task.assignee)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-500 py-16 gap-2">
                <div className={`p-3 rounded-full ${selectedStageConfig.bg} ${selectedStageConfig.text} opacity-40`}>
                  {selectedStageConfig.icon}
                </div>
                <p className="text-sm">No patches in <span className="font-medium">{selectedStageConfig.label}</span>.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Default: Recent Activity */
        <div className="glass-card flex flex-col animate-fade-slide-up">
          <div className="p-5 border-b border-gray-700/50 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
              <Activity size={18} className="text-primary-500" />
              Recent Activity
            </h2>
            <Link
              to="/patches"
              className="text-xs font-semibold text-primary-400 hover:text-primary-300 transition-colors flex items-center gap-1"
            >
              View Board <ArrowRight size={14} />
            </Link>
          </div>
          <div className="p-5">
            {recentAll.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {recentAll.map((task, i) => {
                  const stageConf = STAGES.find(s => s.status === task.status);
                  return (
                    <div
                      key={task.id}
                      className={`
                        animate-fade-slide-up stagger-${Math.min(i + 1, 11)}
                        group flex flex-col p-4 rounded-xl border border-gray-700/30
                        bg-gray-900/50 hover:bg-gray-800/70 hover:border-gray-600/50
                        transition-all duration-200 cursor-pointer hover:shadow-md hover:shadow-black/20
                      `}
                      onClick={() => handleTaskClick(task.id)}
                    >
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <h3 className="font-semibold text-gray-200 text-sm line-clamp-1 group-hover:text-white transition-colors">
                          {task.title}
                        </h3>
                      </div>
                      <span className={`self-start text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border mb-3 ${
                        stageConf
                          ? `${stageConf.bg} ${stageConf.text} ${stageConf.border}`
                          : 'bg-gray-500/10 text-gray-400 border-gray-500/30'
                      }`}>
                        {stageConf?.label || task.status}
                      </span>
                      <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-800/50">
                        <span className="text-xs text-gray-500 flex items-center gap-1.5">
                          <Layers size={12} />
                          {task.module?.name || 'No Module'}
                        </span>
                        <span className="text-xs text-gray-400 font-medium">
                          {getAssigneeName(task.assignee)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-500 py-16 gap-2">
                <Clock size={32} className="opacity-40" />
                <p className="text-sm">No patches yet. Create your first change to get started.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedTask && (
        <PatchDetailsModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onStatusChange={handleStatusChange}
          onCommentAdded={handleCommentAdded}
          onDelete={handleDelete}
          onRestore={handleRestore}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
};

export default Dashboard;
