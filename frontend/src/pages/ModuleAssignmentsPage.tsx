import { useEffect, useMemo, useState } from 'react';
import { getUsers, updateUserModules } from '../api/users';
import type { User } from '../api/users';
import { getModules } from '../api/modules';
import type { Module } from '../api/modules';
import { RefreshCcw, Pencil, Save } from 'lucide-react';

export default function ModuleAssignmentsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, modulesRes] = await Promise.all([
        getUsers(undefined, true),
        getModules(false),
      ]);
      setUsers(usersRes);
      setModules(modulesRes);
      setError('');
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.error || 'Unable to load assignments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredUsers = useMemo(() => {
    const lower = filter.toLowerCase();
    return users.filter((user) =>
      user.name.toLowerCase().includes(lower) ||
      user.username.toLowerCase().includes(lower) ||
      (user.modules || []).some((module) => module.name.toLowerCase().includes(lower))
    );
  }, [filter, users]);

  const openEdit = (user: User) => {
    setSelectedUserId(user.id);
    setSelectedModules(user.modules?.map((module) => module.id) || []);
  };

  const handleModuleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const options = Array.from(event.target.selectedOptions).map((option) => option.value);
    setSelectedModules(options);
  };

  const saveAssignment = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      await updateUserModules(selectedUserId, selectedModules);
      await loadData();
      setSelectedUserId(null);
      setError('');
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.error || 'Failed to update user assignments.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {loading && (
        <div className="rounded-3xl border border-gray-700 bg-gray-950/80 p-6 text-center text-sm text-gray-400">
          Loading assignments...
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">User Module Assignments</h2>
          <p className="text-sm text-gray-400 mt-1">Assign users to modules, remove assignments, and move users between modules.</p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="inline-flex items-center gap-2 rounded-2xl border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 transition"
        >
          <RefreshCcw size={16} /> Refresh
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.7fr]">
        <div className="rounded-3xl border border-gray-700 bg-gray-950/80 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold text-white">Users</h3>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search users or modules"
              className="max-w-sm rounded-2xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-primary-500"
            />
          </div>

          <div className="mt-4 overflow-x-auto rounded-3xl border border-gray-800 bg-gray-900/80">
            <table className="min-w-full text-sm text-left text-gray-200">
              <thead className="bg-gray-950/80 text-gray-400">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Modules</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-white">{user.name}</td>
                    <td className="px-4 py-3 text-gray-400">{user.role}</td>
                    <td className="px-4 py-3">
                      {(user.modules || []).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {user.modules?.map((module) => (
                            <span key={module.id} className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-300">
                              {module.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-500">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(user)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-gray-700 bg-gray-900 px-3 py-2 text-xs font-semibold text-gray-200 hover:border-primary-500 hover:text-white transition"
                      >
                        <Pencil size={14} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-700 bg-gray-950/80 p-5 min-h-[240px]">
          <h3 className="text-sm font-semibold text-white">Assignment Editor</h3>
          <p className="text-sm text-gray-400 mt-2">Select a user to change module assignments.</p>

          {selectedUserId ? (
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm text-gray-300">Modules</label>
                <select
                  multiple
                  value={selectedModules}
                  onChange={handleModuleChange}
                  className="mt-2 h-56 w-full rounded-3xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-primary-500"
                >
                  {modules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedUserId(null)}
                  className="rounded-2xl border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={saveAssignment}
                  className="inline-flex items-center gap-2 rounded-2xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-400 transition disabled:opacity-60"
                >
                  <Save size={14} /> Save Assignments
                </button>
              </div>
              {error && <div className="rounded-2xl border border-danger-500/30 bg-danger-500/10 px-4 py-3 text-sm text-danger-200">{error}</div>}
            </div>
          ) : (
            <div className="mt-6 rounded-3xl border border-dashed border-gray-700 bg-gray-900/60 px-4 py-8 text-center text-sm text-gray-400">
              Select a user from the list to edit module assignments.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
