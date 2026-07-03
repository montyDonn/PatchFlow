import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../api/client';
import { 
  BarChart3, 
  Calendar, 
  ChevronDown,
  ChevronUp,
  FileSpreadsheet, 
  Filter, 
  MessageSquare,
  RotateCcw, 
  Search
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface User {
  userId: string;
  name: string;
  role: string;
  username: string;
}

interface Module {
  moduleId: string;
  moduleName: string;
  isActive: boolean;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  lifecycleStatus: number;
  createdAt: string;
  updatedAt: string;
  dateGiven: string;
  dateStarted: string | null;
  dateEnded: string | null;
  clientRequestId?: number;
  module: { id: string; name: string } | null;
  client: User | null;
  manager: User | null;
  managers: User[];
  developers: User[];
  verifiers: User[];
  comments?: Array<{
    id: string;
    content: string;
    createdAt: string;
    authorName?: string | null;
    authorRole?: string | null;
    user?: User | null;
  }>;
  statusHistory: Array<{
    id: string;
    previousStatus: string;
    newStatus: string;
    reason: string | null;
    createdAt: string;
    actor: User | null;
    changedByName?: string | null;
    changedByUsername?: string | null;
    changedByRole?: string | null;
  }>;
}

const STATUSES = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'IN_DEVELOPMENT', label: 'In Development' },
  { value: 'VERIFYING', label: 'Verifying' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'RETURNED_TO_DEVELOPER', label: 'Returned' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'DELAYED', label: 'Delayed' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'CANCELLED', label: 'Cancelled' }
];

export default function ReportsPage() {
  const currentUser = useAuthStore(state => state.user);
  
  // Data lists
  const [tasks, setTasks] = useState<Task[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Expanded row state for audit/comments
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [expandedTab, setExpandedTab] = useState<'comments' | 'history'>('comments');

  // Filter states
  const [viewPreset, setViewPreset] = useState<'weekly' | 'monthly' | 'custom'>('weekly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedManager, setSelectedManager] = useState('');
  const [selectedDeveloper, setSelectedDeveloper] = useState('');
  const [selectedVerifier, setSelectedVerifier] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch reference lists (modules and users)
  useEffect(() => {
    Promise.all([
      api.get('/modules'),
      api.get('/users?includeModules=true')
    ]).then(([modulesRes, usersRes]) => {
      setModules(modulesRes.data.filter((m: any) => m.isActive));
      setUsers(usersRes.data.filter((u: any) => u.isActive));
    }).catch(console.error);
  }, []);

  // Fetch report data
  const fetchReportData = () => {
    setLoading(true);
    const params: any = {
      view: viewPreset,
    };
    if (viewPreset === 'custom') {
      params.startDate = startDate;
      params.endDate = endDate;
    }
    if (selectedModule) params.moduleId = selectedModule;
    if (selectedClient) params.clientId = selectedClient;
    if (selectedManager) params.managerId = selectedManager;
    if (selectedDeveloper) params.developerId = selectedDeveloper;
    if (selectedVerifier) params.verifierId = selectedVerifier;
    if (selectedStatus) params.status = selectedStatus;

    api.get('/reports/data', { params })
      .then(res => {
        setTasks(res.data.data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load reports", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    // Avoid fetching custom range if dates are incomplete
    if (viewPreset === 'custom' && (!startDate || !endDate)) {
      return;
    }
    fetchReportData();
  }, [
    viewPreset, startDate, endDate, selectedModule, 
    selectedClient, selectedManager, selectedDeveloper, 
    selectedVerifier, selectedStatus
  ]);

  const resetFilters = () => {
    setViewPreset('weekly');
    setStartDate('');
    setEndDate('');
    setSelectedModule('');
    setSelectedClient('');
    setSelectedManager('');
    setSelectedDeveloper('');
    setSelectedVerifier('');
    setSelectedStatus('');
    setSearchQuery('');
    setExpandedTaskId(null);
  };

  // Filter tasks locally by search query
  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.module?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group users by role for select controls
  const clients = users.filter(u => u.role === 'CLIENT');
  const managers = users.filter(u => u.role === 'MANAGER' || u.role === 'ADMIN');
  const developers = users.filter(u => u.role === 'DEVELOPER');
  const verifiers = users.filter(u => u.role === 'VERIFIER');

  // Format Status label helper
  const getStatusLabel = (val: string) => {
    return STATUSES.find(s => s.value === val)?.label || val;
  };

  // Generate detailed workflow summary path
  const getDetailedWorkflowSummary = (task: Task) => {
    if (!task.statusHistory || task.statusHistory.length === 0) return 'No status history';
    return task.statusHistory.map(h => {
      const actorName = h.actor?.name || h.changedByName || 'System / Author';
      const actorRole = h.actor?.role || h.changedByRole || 'System';
      const timeStr = new Date(h.createdAt).toLocaleString();
      const reasonPart = h.reason ? ` Reason: "${h.reason}"` : '';
      return `${getStatusLabel(h.previousStatus || 'DRAFT')} → ${getStatusLabel(h.newStatus)} by ${actorName} (${actorRole}) at ${timeStr}.${reasonPart}`;
    }).join(' | ');
  };

  // ----------------------------------------------------
  // EXPORT EXCEL
  const handleExportExcel = () => {
    const excelData = filteredTasks.map(t => ({
      'Change Name': t.title,
      'Module': t.module?.name || 'N/A',
      'Client': t.client?.name || 'N/A',
      'Managers': t.managers?.map(m => m.name).join(', ') || t.manager?.name || 'N/A',
      'Developers': t.developers.map(d => d.name).join(', ') || 'N/A',
      'Verifiers': t.verifiers.map(v => v.name).join(', ') || 'N/A',
      'Current Status': getStatusLabel(t.status),
      'Date Given': t.dateGiven ? new Date(t.dateGiven).toLocaleDateString() : 'N/A',
      'Date Started': t.dateStarted ? new Date(t.dateStarted).toLocaleDateString() : 'N/A',
      'Date Ended': t.dateEnded ? new Date(t.dateEnded).toLocaleDateString() : 'N/A',
      'Last Updated': new Date(t.updatedAt).toLocaleString(),
      'Comments Summary': t.comments?.map(c => `[${c.authorRole || c.user?.role || 'User'}] @${c.authorName || c.user?.name || 'User'}: ${c.content}`).join(' | ') || 'No comments',
      'Workflow History Summary': getDetailedWorkflowSummary(t)
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Changes Report");
    
    const maxLens = Object.keys(excelData[0] || {}).map(key => {
      let maxLen = key.length;
      excelData.forEach(row => {
        const val = String((row as any)[key] || '');
        if (val.length > maxLen) maxLen = val.length;
      });
      return { wch: Math.min(maxLen + 2, 50) };
    });
    worksheet['!cols'] = maxLens;

    XLSX.writeFile(workbook, `ChangeManagement_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };



  const isClient = currentUser?.role === 'CLIENT';

  return (
    <div className="space-y-6">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <BarChart3 className="text-primary-500" /> {isClient ? 'My Change Reports' : 'System Reports'}
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {isClient 
              ? 'View real-time progress and timeline summaries of your change requests.' 
              : 'Detailed breakdown, status summaries, and export capabilities for all active change workflows.'
            }
          </p>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={handleExportExcel}
            disabled={filteredTasks.length === 0}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700/80 border border-gray-700/60 text-gray-200 px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet size={16} className="text-green-500" /> Export Excel
          </button>
        </div>
      </div>

      {/* Control / Filter Bar */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-4">
        
        {/* Preset & Time Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-800 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-2">Time presets:</span>
            <div className="bg-gray-950 p-1 rounded-xl flex gap-1 border border-gray-800">
              <button
                onClick={() => setViewPreset('weekly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewPreset === 'weekly' 
                    ? 'bg-primary-500 text-white shadow-lg' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Weekly
              </button>
              <button
                onClick={() => setViewPreset('monthly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewPreset === 'monthly' 
                    ? 'bg-primary-500 text-white shadow-lg' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setViewPreset('custom')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewPreset === 'custom' 
                    ? 'bg-primary-500 text-white shadow-lg' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Custom Range
              </button>
            </div>
          </div>

          {/* Custom Date Controls */}
          {viewPreset === 'custom' && (
            <div className="flex items-center gap-3 text-xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2 bg-gray-950 border border-gray-800 rounded-xl px-3 py-2">
                <Calendar size={14} className="text-gray-500" />
                <span className="text-gray-400">From:</span>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                  className="bg-transparent border-0 text-white focus:ring-0 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2 bg-gray-950 border border-gray-800 rounded-xl px-3 py-2">
                <Calendar size={14} className="text-gray-500" />
                <span className="text-gray-400">To:</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                  className="bg-transparent border-0 text-white focus:ring-0 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Reset Filters button */}
          <button 
            onClick={resetFilters}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-primary-400 transition-colors cursor-pointer"
          >
            <RotateCcw size={14} /> Reset Filters
          </button>
        </div>

        {/* Dropdown Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          
          {/* Module Select */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Module</label>
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:border-primary-500 focus:outline-none transition-colors"
            >
              <option value="">All Modules</option>
              {modules.map(m => (
                <option key={m.moduleId} value={m.moduleId}>{m.moduleName}</option>
              ))}
            </select>
          </div>

          {/* Client Select (Hidden for Client) */}
          {!isClient && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Client</label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:border-primary-500 focus:outline-none transition-colors"
              >
                <option value="">All Clients</option>
                {clients.map(c => (
                  <option key={c.userId} value={c.userId}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Manager Select */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Manager</label>
            <select
              value={selectedManager}
              onChange={(e) => setSelectedManager(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:border-primary-500 focus:outline-none transition-colors"
            >
              <option value="">All Managers</option>
              {managers.map(m => (
                <option key={m.userId} value={m.userId}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Developer Select */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Developer</label>
            <select
              value={selectedDeveloper}
              onChange={(e) => setSelectedDeveloper(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:border-primary-500 focus:outline-none transition-colors"
            >
              <option value="">All Developers</option>
              {developers.map(d => (
                <option key={d.userId} value={d.userId}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Verifier Select */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Verifier</label>
            <select
              value={selectedVerifier}
              onChange={(e) => setSelectedVerifier(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:border-primary-500 focus:outline-none transition-colors"
            >
              <option value="">All Verifiers</option>
              {verifiers.map(v => (
                <option key={v.userId} value={v.userId}>{v.name}</option>
              ))}
            </select>
          </div>

          {/* Status Select */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:border-primary-500 focus:outline-none transition-colors"
            >
              <option value="">All Statuses</option>
              {STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Local Search Query */}
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-3 text-gray-500" />
          <input 
            type="text"
            placeholder="Search report by change name or module name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-950 border border-gray-850 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:border-primary-500 focus:outline-none transition-colors shadow-inner"
          />
        </div>

      </div>

      {/* Tabular Reports */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 rounded-full border-4 border-primary-500/20 border-t-primary-500 animate-spin" />
              <p className="text-sm text-gray-400 font-medium">Querying workflow reports...</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-16">
              <Filter size={36} className="mx-auto text-gray-600 mb-3" />
              <p className="text-sm text-gray-400 font-semibold">No reports match the selected filters.</p>
              <p className="text-xs text-gray-500 mt-1">Try resetting presets or searching for different criteria.</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-xs whitespace-nowrap">
              <thead className="bg-gray-950 text-gray-400 font-semibold uppercase tracking-wider border-b border-gray-800">
                <tr>
                  <th className="px-4 py-4 w-8"></th>
                  <th className="px-6 py-4">Change Name</th>
                  <th className="px-6 py-4">Module</th>
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4">Managers</th>
                  <th className="px-6 py-4">Developers</th>
                  <th className="px-6 py-4">Verifiers</th>
                  <th className="px-6 py-4">Current Status</th>
                  <th className="px-6 py-4">Date Given</th>
                  <th className="px-6 py-4">Date Started</th>
                  <th className="px-6 py-4">Date Ended</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-gray-300">
                {filteredTasks.map(task => {
                  const isExpanded = expandedTaskId === task.id;
                  const commentCount = task.comments?.length || 0;
                  const historyCount = task.statusHistory?.length || 0;

                  return (
                    <>
                      <tr
                        key={task.id}
                        className={`hover:bg-gray-800/20 transition-colors cursor-pointer ${isExpanded ? 'bg-gray-800/30' : ''}`}
                        onClick={() => {
                          setExpandedTaskId(isExpanded ? null : task.id);
                          setExpandedTab('comments');
                        }}
                      >
                        <td className="px-4 py-4">
                          <button
                            className="text-gray-500 hover:text-primary-400 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedTaskId(isExpanded ? null : task.id);
                              setExpandedTab('comments');
                            }}
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>
                        <td className="px-6 py-4 font-semibold text-white truncate max-w-[150px]" title={task.title}>
                          <div>{task.title}</div>
                          {/* Show Change ID */}
                          {(() => {
                            const m = task.description?.match(/\[CHANGE_ID:\s*([^\]]+)\]/);
                            const displayId = (task.id && /^\d{12}$/.test(task.id)) ? task.id : (m ? m[1] : task.id);
                            return displayId ? <div className="text-[10px] text-primary-400 font-mono mt-0.5">#{displayId}</div> : null;
                          })()}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 bg-gray-950 rounded border border-gray-800 text-gray-400 font-medium">
                            {task.module?.name || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 truncate max-w-[100px]" title={task.client?.name || 'N/A'}>
                          {task.client?.name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 truncate max-w-[120px]" title={task.managers?.map(m => m.name).join(', ') || task.manager?.name || 'N/A'}>
                          {task.managers?.map(m => m.name).join(', ') || task.manager?.name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 truncate max-w-[120px]" title={task.developers.map(d => d.name).join(', ') || 'N/A'}>
                          {task.developers.map(d => d.name).join(', ') || 'N/A'}
                        </td>
                        <td className="px-6 py-4 truncate max-w-[120px]" title={task.verifiers.map(v => v.name).join(', ') || 'N/A'}>
                          {task.verifiers.map(v => v.name).join(', ') || 'N/A'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            task.status === 'COMPLETED' 
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                              : task.status === 'IN_DEVELOPMENT'
                              ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
                              : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                          }`}>
                            {getStatusLabel(task.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono">
                          {task.dateGiven ? new Date(task.dateGiven).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 font-mono">
                          {task.dateStarted ? new Date(task.dateStarted).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 font-mono">
                          {task.dateEnded ? new Date(task.dateEnded).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>

                      {/* Expanded Row — Comments & Audit */}
                      {isExpanded && (
                        <tr key={`${task.id}-expanded`} className="bg-gray-900/80">
                          <td colSpan={12} className="px-6 py-4">
                            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                              {/* Tab Buttons */}
                              <div className="flex gap-4 border-b border-gray-700 mb-4 pb-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setExpandedTab('comments'); }}
                                  className={`flex items-center gap-1.5 text-xs font-semibold pb-1 border-b-2 transition-colors ${
                                    expandedTab === 'comments'
                                      ? 'text-primary-400 border-primary-500'
                                      : 'text-gray-500 border-transparent hover:text-gray-300'
                                  }`}
                                >
                                  <MessageSquare size={12} />
                                  Comments ({commentCount})
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setExpandedTab('history'); }}
                                  className={`flex items-center gap-1.5 text-xs font-semibold pb-1 border-b-2 transition-colors ${
                                    expandedTab === 'history'
                                      ? 'text-primary-400 border-primary-500'
                                      : 'text-gray-500 border-transparent hover:text-gray-300'
                                  }`}
                                >
                                  <RotateCcw size={12} />
                                  Workflow History ({historyCount})
                                </button>
                              </div>

                              {expandedTab === 'comments' ? (
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                  {task.comments && task.comments.length > 0 ? (
                                    task.comments.map((comment, idx) => (
                                      <div key={idx} className="flex gap-2 bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                                        <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                                          {(comment.authorName || comment.user?.name || 'U')[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className="text-xs font-semibold text-gray-200">
                                              {comment.authorName || comment.user?.name || 'User'}
                                            </span>
                                            <span className="text-[10px] text-primary-300 bg-primary-500/10 px-1.5 py-0.5 rounded border border-primary-500/20 uppercase font-semibold">
                                              {comment.authorRole || comment.user?.role || 'User'}
                                            </span>
                                            <span className="text-[10px] text-gray-500 font-mono">
                                              {new Date(comment.createdAt).toLocaleString()}
                                            </span>
                                          </div>
                                          <p className="text-xs text-gray-300">{comment.content}</p>
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-xs text-gray-500 italic py-2 text-center">No comments for this change.</p>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                  {task.statusHistory && task.statusHistory.length > 0 ? (
                                    task.statusHistory.map((h, idx) => {
                                      const actorName = h.actor?.name || h.changedByName || 'System / Author';
                                      const actorRole = h.actor?.role || h.changedByRole || 'System';
                                      return (
                                        <div key={idx} className="flex flex-col bg-gray-800/50 rounded-lg p-3 border border-gray-700/50 gap-1">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-[10px] text-gray-500 bg-gray-900 px-2 py-0.5 rounded border border-gray-800">
                                              {getStatusLabel(h.previousStatus || 'DRAFT')}
                                            </span>
                                            <span className="text-gray-600">→</span>
                                            <span className="text-[10px] text-primary-400 font-bold bg-primary-500/10 px-2 py-0.5 rounded border border-primary-500/20">
                                              {getStatusLabel(h.newStatus)}
                                            </span>
                                            <span className="text-[10px] text-gray-200 font-semibold ml-1">{actorName}</span>
                                            <span className="text-[10px] text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20 uppercase font-semibold">{actorRole}</span>
                                            <span className="text-[10px] text-gray-500 font-mono ml-auto">{new Date(h.createdAt).toLocaleString()}</span>
                                          </div>
                                          {h.reason && (
                                            <p className="text-[10px] text-gray-400 italic bg-gray-900/60 px-2 py-1 rounded border border-gray-800/60">
                                              "{h.reason}"
                                            </p>
                                          )}
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <p className="text-xs text-gray-500 italic py-2 text-center">No workflow history available.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
