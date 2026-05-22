import { useEffect, useMemo, useState } from 'react';
import { getModuleHierarchy } from '../api/modules';
import type { ModuleHierarchy } from '../api/modules';
import { Search, Layers, Users, ShieldCheck, Activity } from 'lucide-react';

export default function ResourceHierarchyPage() {
  const [hierarchy, setHierarchy] = useState<ModuleHierarchy[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');

  const loadHierarchy = async () => {
    setLoading(true);
    try {
      const data = await getModuleHierarchy();
      setHierarchy(data);
      setError('');
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.error || 'Unable to load hierarchy.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHierarchy();
  }, []);

  const filtered = useMemo(() => {
    const lower = filter.toLowerCase();
    return hierarchy.filter((module) =>
      module.name.toLowerCase().includes(lower) ||
      module.description.toLowerCase().includes(lower) ||
      module.managers.some((assignment) => assignment.user.name.toLowerCase().includes(lower) || assignment.user.username.toLowerCase().includes(lower)) ||
      module.resources.some((assignment) => assignment.user.name.toLowerCase().includes(lower) || assignment.user.username.toLowerCase().includes(lower))
    );
  }, [filter, hierarchy]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Resource Hierarchy</h2>
          <p className="text-sm text-gray-400 mt-1">Matrix view showing module → managers → resources/developers → deployment → verification.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search modules or users"
              className="rounded-2xl border border-gray-700 bg-gray-900 px-10 py-2 text-sm text-white outline-none focus:border-primary-500"
            />
          </div>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-danger-500/30 bg-danger-500/10 px-4 py-3 text-sm text-danger-200">{error}</div>}

      <div className="space-y-5">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-gray-700 bg-gray-950/80 p-8 text-center text-sm text-gray-400">
            No matching modules or users found.
          </div>
        ) : (
          filtered.map((module) => (
            <div key={module.id} className="rounded-3xl border border-gray-700 bg-gray-950/80 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">{module.name}</h3>
                  <p className="text-sm text-gray-400 mt-1">{module.description || 'No description provided.'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs text-blue-200">Managers {module.counts.managers}</span>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">Resources {module.counts.resources}</span>
                  <span className="rounded-full bg-sky-500/10 px-3 py-1 text-xs text-sky-200">Deployers {module.counts.deployers}</span>
                  <span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs text-purple-200">Verifiers {module.counts.verifiers}</span>
                </div>
              </div>

              <div className="grid gap-4 mt-6 lg:grid-cols-4">
                <div className="rounded-3xl border border-gray-800 bg-gray-900/70 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-gray-400 mb-3">
                    <Layers size={14} /> Managers
                  </div>
                  {module.managers.length ? module.managers.map((assignment) => (
                    <div key={assignment.id} className="mb-2 rounded-2xl bg-gray-950 px-3 py-2 text-sm text-gray-200">
                      {assignment.user.name} <span className="text-gray-500">({assignment.user.role})</span>
                    </div>
                  )) : <div className="text-gray-500 text-sm">No managers</div>}
                </div>
                <div className="rounded-3xl border border-gray-800 bg-gray-900/70 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-gray-400 mb-3">
                    <Users size={14} /> Resources / Developers
                  </div>
                  {module.resources.length ? module.resources.map((assignment) => (
                    <div key={assignment.id} className="mb-2 rounded-2xl bg-gray-950 px-3 py-2 text-sm text-gray-200">
                      {assignment.user.name} <span className="text-gray-500">({assignment.user.role})</span>
                    </div>
                  )) : <div className="text-gray-500 text-sm">No assigned resources</div>}
                </div>
                <div className="rounded-3xl border border-gray-800 bg-gray-900/70 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-gray-400 mb-3">
                    <ShieldCheck size={14} /> Deployment
                  </div>
                  {module.deployers.length ? module.deployers.map((assignment) => (
                    <div key={assignment.id} className="mb-2 rounded-2xl bg-gray-950 px-3 py-2 text-sm text-gray-200">
                      {assignment.user.name}
                    </div>
                  )) : <div className="text-gray-500 text-sm">No deployment team members</div>}
                </div>
                <div className="rounded-3xl border border-gray-800 bg-gray-900/70 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-gray-400 mb-3">
                    <Activity size={14} /> Verification
                  </div>
                  {module.verifiers.length ? module.verifiers.map((assignment) => (
                    <div key={assignment.id} className="mb-2 rounded-2xl bg-gray-950 px-3 py-2 text-sm text-gray-200">
                      {assignment.user.name}
                    </div>
                  )) : <div className="text-gray-500 text-sm">No verification team members</div>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
