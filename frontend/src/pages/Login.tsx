import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import api from "../api/client";
import { Activity } from "lucide-react";

export function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("upcl@123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/login", { username, password });
      login(response.data.user, response.data.token);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.error || "An error occurred during login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center gap-3">
          <Activity className="text-primary-500" size={40} />
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Change Management</h2>
        </div>
        <h2 className="mt-6 text-center text-2xl font-bold text-gray-200">
          Sign in to your account
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="glass-card py-8 px-4 sm:rounded-xl sm:px-10">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-medium text-gray-300">
                Email / Username
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm placeholder-gray-400 bg-gray-800 text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-colors"
                  placeholder="admin"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300">
                Password
              </label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm placeholder-gray-400 bg-gray-800 text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="text-danger-500 text-sm font-medium bg-danger-500/10 p-3 rounded-md border border-danger-500/20">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 focus:ring-offset-gray-900 transition-colors disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </div>
            
            {/* <div className="mt-4 text-xs text-gray-400 text-center space-y-1">
              <div>All users password: <strong className="text-gray-300 font-mono">upcl@123</strong></div>
              <div>Client Demo: <strong className="text-gray-300 font-mono">komal, abhishekrishi, sachinp, pankaj</strong></div>
              <div>Legacy Demo: <strong className="text-gray-300 font-mono">superadmin1, admin1, manager1, developer1, verifier1, client1</strong></div>
            </div> */}
          </form>
        </div>
      </div>
    </div>
  );
}
