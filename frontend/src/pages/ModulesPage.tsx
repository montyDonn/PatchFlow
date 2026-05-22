import { useEffect, useState } from 'react';
import { getModules, createModule, updateModule } from '../api/modules';
import type { Module } from '../api/modules';
import { Plus, Pencil, Save, RefreshCcw } from 'lucide-react';

export default function ModulesPage() {
  const [modules, setModules] = useState<Module[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const loadModules = async () => {
    setLoading(true);
    try {
      const data = await getModules(true);
      setModules(data);
      setError('');
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.error || 'Unable to load modules.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModules();
  }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Module name is required.');
      return;
    }
    setSaving(true);
    try {
      await createModule({ name: name.trim(), description: description.trim() });
      setName('');
      setDescription('');
      await loadModules();
      setError('');
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.error || 'Failed to create module.');
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (module: Module) => {
    setEditingId(module.id);
    setEditName(module.name);
    setEditDescription(module.description || '');
  };

  const handleSaveEdit = async (moduleId: string) => {
    if (!editName.trim()) {
      setError('Module name is required.');
      return;
    }
    setSaving(true);
    try {
      await updateModule(moduleId, {
        name: editName.trim(),
        description: editDescription.trim(),
      });
      setEditingId(null);
      setError('');
      await loadModules();
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.error || 'Failed to save module.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (module: Module) => {
    setSaving(true);
    try {
      await updateModule(module.id, { isActive: !module.isActive });
      await loadModules();
      setError('');
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.error || 'Failed to update module.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {loading && (
        <div className="rounded-3xl border border-gray-700 bg-gray-950/80 p-6 text-center text-sm text-gray-400">
          Loading modules...
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Modules</h2>
          <p className="text-sm text-gray-400 mt-1">Create, update and activate or deactivate modules.</p>
        </div>
        <button
          type="button"
          onClick={loadModules}
          className="inline-flex items-center gap-2 rounded-2xl border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 transition"
        >
          <RefreshCcw size={16} /> Refresh
        </button>
      </div>

      <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-3 rounded-3xl border border-gray-700 bg-gray-950/80 p-5">
          <div className="space-y-2">
            <label className="block text-sm text-gray-300">Module name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-primary-500"
              placeholder="e.g. BILLING"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-gray-300">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full min-h-[120px] rounded-3xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-primary-500"
              placeholder="Optional module description"
            />
          </div>
          {error && <div className="rounded-2xl border border-danger-500/30 bg-danger-500/10 px-4 py-3 text-sm text-danger-200">{error}</div>}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary-500 px-5 py-3 text-sm font-semibold text-white hover:bg-primary-400 transition disabled:opacity-60"
          >
            <Plus size={16} /> Create Module
          </button>
        </div>

        <div className="rounded-3xl border border-gray-700 bg-gray-950/80 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Module count</h3>
          <div className="text-5xl font-bold text-white">{modules.length}</div>
          <p className="text-sm text-gray-400 mt-2">Active and inactive modules are listed below.</p>
        </div>
      </form>

      <div className="overflow-x-auto rounded-3xl border border-gray-700 bg-gray-950/80">
        <table className="min-w-full divide-y divide-gray-700 text-sm text-left">
          <thead className="bg-gray-900/60 text-gray-400">
            <tr>
              <th className="px-4 py-3">Module</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Assignments</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {modules.map((module) => (
              <tr key={module.id} className="hover:bg-white/5">
                <td className="px-4 py-4 align-top">
                  {editingId === module.id ? (
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-2xl border border-gray-700 bg-gray-900 px-3 py-2 text-white outline-none"
                    />
                  ) : (
                    <div className="font-semibold text-white">{module.name}</div>
                  )}
                </td>
                <td className="px-4 py-4 align-top">
                  {editingId === module.id ? (
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full min-h-[72px] rounded-2xl border border-gray-700 bg-gray-900 px-3 py-2 text-white outline-none"
                    />
                  ) : (
                    <div className="text-gray-300">{module.description || '—'}</div>
                  )}
                </td>
                <td className="px-4 py-4 align-top text-gray-300">{module.users?.length ?? 0}</td>
                <td className="px-4 py-4 align-top">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${module.isActive ? 'bg-emerald-500/10 text-emerald-200' : 'bg-red-500/10 text-red-200'}`}>
                    {module.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-4 align-top text-right space-x-2">
                  {editingId === module.id ? (
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(module.id)}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-2xl bg-primary-500 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-400 transition disabled:opacity-60"
                    >
                      <Save size={14} /> Save
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => beginEdit(module)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-gray-700 bg-gray-900 px-3 py-2 text-xs font-semibold text-gray-200 hover:border-primary-500 hover:text-white transition"
                    >
                      <Pencil size={14} /> Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleActive(module)}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-2xl border border-gray-700 bg-gray-900 px-3 py-2 text-xs font-semibold text-gray-200 hover:border-primary-500 hover:text-white transition"
                  >
                    {module.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
