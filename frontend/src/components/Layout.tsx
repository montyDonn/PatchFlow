import { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, LogOut, Activity, Bell, Layers, Users, Share2, BarChart3, Shield } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../api/client';
import { SwitchAccountDropdown } from './layout/SwitchAccountDropdown';

function Sidebar() {
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-64 border-r border-gray-700/50 glass hidden md:flex flex-col h-screen sticky top-0">
      <div className="p-6 flex items-center gap-3">
        <Activity className="text-primary-500" size={28} />
        <span className="font-bold text-xl tracking-tight">Change Management</span>
      </div>
      
      <nav className="flex-1 px-4 py-6 space-y-2">
        <Link to="/" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-700/50 text-white font-medium transition-colors">
          <LayoutDashboard size={20} />
          Dashboard
        </Link>
        <Link to="/patches" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-700/30 hover:text-white transition-colors">
          <CheckSquare size={20} />
          Change Board
        </Link>
        {(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'CLIENT') && (
          <Link to="/reports" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-700/30 hover:text-white transition-colors">
            <BarChart3 size={20} />
            Reports
          </Link>
        )}
        {(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && (
          <>
            <Link to="/modules" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-700/30 hover:text-white transition-colors">
              <Layers size={20} />
              Modules
            </Link>
            <Link to="/assignments" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-700/30 hover:text-white transition-colors">
              <Users size={20} />
              User Assignments
            </Link>
            <Link to="/hierarchy" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-700/30 hover:text-white transition-colors">
              <Share2 size={20} />
              Resource Hierarchy
            </Link>
            <Link to="/admin" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-700/30 hover:text-white transition-colors">
              <Shield size={20} />
              Admin Panel
            </Link>
          </>
        )}

      </nav>

      <div className="p-4 border-t border-gray-700/50">
        <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-gray-400 hover:text-danger-500 hover:bg-danger-500/10 transition-colors cursor-pointer">
          <LogOut size={20} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

function Topbar() {
  const user = useAuthStore(state => state.user);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    api.get("/notifications").then(res => setNotifications(res.data)).catch(console.error);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="h-16 border-b border-gray-700/50 glass flex items-center justify-between px-6 sticky top-0 z-10">
      <h1 className="text-lg font-semibold text-gray-200">
        <span className="bg-primary-500/20 text-primary-400 px-3 py-1 rounded-full text-sm mr-3">
          {user?.role.replace(/_/g, ' ')}
        </span>
        Overview
      </h1>
      <div className="flex items-center gap-6">
        <div className="relative cursor-pointer hover:text-white text-gray-400 transition-colors">
          <Bell size={22} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger-500 text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </div>
        <SwitchAccountDropdown />
      </div>
    </header>
  );
}

export function Layout() {
  return (
    <div className="flex min-h-screen bg-gray-900 text-gray-100">
      <Sidebar />
      <main className="flex-1 flex flex-col relative">
        <Topbar />
        <div className="p-6 flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
