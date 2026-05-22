import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuthStore } from "../store/authStore";

interface ApiUser {
  userId?: string;
  id?: string;
  username: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role: string;
  isActive?: boolean;
}

export function Settings() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createError, setCreateError] = useState("");
  
  // Form state matches backend: POST /api/auth/register expects { username, name, password, role }
  const [newUser, setNewUser] = useState({
    username: "",
    name: "",
    password: "",
    role: "DEVELOPER"
  });

  const currentUser = useAuthStore((state) => state.user);

  const fetchUsers = async () => {
    try {
      const res = await api.get("/auth/users");
      setUsers(res.data);
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    try {
      // Backend expects: { username, name, password, role }
      await api.post("/auth/register", {
        username: newUser.username.trim(),
        name: newUser.name.trim(),
        password: newUser.password,
        role: newUser.role,
      });
      setShowCreateModal(false);
      setNewUser({ username: "", name: "", password: "", role: "DEVELOPER" });
      fetchUsers();
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to create user";
      setCreateError(msg);
    }
  };

  if (currentUser?.role !== "SUPER_ADMIN" && currentUser?.role !== "MANAGER") {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-200">Settings</h2>
        <div className="glass-card p-6 text-gray-400">
          General settings view coming soon...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-white">User Management</h2>
        {currentUser?.role === "SUPER_ADMIN" && (
          <button 
            onClick={() => setShowCreateModal(true)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-lg shadow-primary-500/20"
          >
            Create User
          </button>
        )}
      </div>

      <div className="glass-card p-6">
        {loading ? (
          <div className="text-center py-10 text-gray-400">Loading users...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-700 text-sm text-gray-400">
                  <th className="pb-3 font-medium pl-2">Name</th>
                  <th className="pb-3 font-medium">Email</th>
                  <th className="pb-3 font-medium">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, idx) => {
                  // Backend returns: { userId, username, name, role, isActive }
                  // Support both name-based and firstName/lastName-based shapes
                  const displayName = u.name || (u.firstName && u.lastName
                    ? `${u.firstName} ${u.lastName}`
                    : u.firstName || u.lastName || u.username || '—');
                  const displayEmail = u.email || u.username || '—';
                  const rowKey = u.userId || u.id || u.username || idx;
                  return (
                    <tr key={rowKey} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                      <td className="py-4 font-medium pl-2 text-white">{displayName}</td>
                      <td className="py-4 text-sm text-gray-400">{displayEmail}</td>
                      <td className="py-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          u.role === 'SUPER_ADMIN' ? 'bg-danger-500/20 text-danger-400' :
                          u.role === 'MANAGER'     ? 'bg-warning-500/20 text-warning-400' :
                          'bg-primary-500/20 text-primary-400'
                        }`}>
                          {(u.role || '').replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-card w-full max-w-md p-6 relative border border-gray-700/50">
            <h3 className="text-xl font-bold mb-4 text-white">Create New User</h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Username <span className="text-danger-400">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. jsmith"
                  value={newUser.username}
                  onChange={e => setNewUser({...newUser, username: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Full Name <span className="text-danger-400">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. John Smith"
                  value={newUser.name}
                  onChange={e => setNewUser({...newUser, name: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Password <span className="text-danger-400">*</span>
                </label>
                <input 
                  type="password" 
                  required
                  value={newUser.password}
                  onChange={e => setNewUser({...newUser, password: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Role</label>
                <select 
                  value={newUser.role}
                  onChange={e => setNewUser({...newUser, role: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-500"
                >
                  <option value="CLIENT">Client</option>
                  <option value="ADMIN">Admin</option>
                  <option value="MANAGER">Manager</option>
                  <option value="DEVELOPER">Developer</option>
                  <option value="VERIFIER">Verifier</option>
                </select>
              </div>
              {createError && (
                <div className="text-danger-400 text-sm bg-danger-500/10 border border-danger-500/20 p-3 rounded-lg">
                  {createError}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-700/50">
                <button 
                  type="button" 
                  onClick={() => { setShowCreateModal(false); setCreateError(""); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white transition-colors shadow-lg shadow-primary-500/20 cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
