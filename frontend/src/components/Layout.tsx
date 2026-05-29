import { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, LogOut, Activity, Bell, Layers, Users, Share2, BarChart3, Shield, Sun, Moon, ClipboardList } from 'lucide-react';
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
        <span className="font-bold text-xl tracking-tight text-gray-100">Change Management</span>
      </div>
      
      <nav className="flex-1 px-4 py-6 space-y-2">
        <Link to="/" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-700/50 text-gray-100 font-medium transition-colors">
          <LayoutDashboard size={20} />
          Dashboard
        </Link>
        <Link to="/patches" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-700/30 hover:text-gray-100 transition-colors">
          <CheckSquare size={20} />
          Change Board
        </Link>
        {(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'CLIENT') && (
          <Link to="/reports" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-700/30 hover:text-gray-100 transition-colors">
            <BarChart3 size={20} />
            Reports
          </Link>
        )}
        {(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && (
          <>
            <Link to="/modules" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-700/30 hover:text-gray-100 transition-colors">
              <Layers size={20} />
              Modules
            </Link>
            <Link to="/assignments" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-700/30 hover:text-gray-100 transition-colors">
              <Users size={20} />
              User Assignments
            </Link>
            <Link to="/hierarchy" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-700/30 hover:text-gray-100 transition-colors">
              <Share2 size={20} />
              Resource Hierarchy
            </Link>
            <Link to="/admin" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-700/30 hover:text-gray-100 transition-colors">
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

interface TopbarProps {
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
}

function Topbar({ theme, onThemeToggle }: TopbarProps) {
  const user = useAuthStore(state => state.user);
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const [notifications, setNotifications] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [showBellTooltip, setShowBellTooltip] = useState(false);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch in-app notifications
  useEffect(() => {
    api.get("/notifications").then(res => setNotifications(res.data)).catch(console.error);
  }, []);

  // Fetch pending account requests count (admin only), refresh every 60s
  useEffect(() => {
    if (!isAdmin) return;

    const fetchPending = () => {
      api.get("/admin/account-requests?status=PENDING")
        .then(res => setPendingRequests(Array.isArray(res.data) ? res.data.length : 0))
        .catch(() => setPendingRequests(0));
    };

    fetchPending();
    const interval = setInterval(fetchPending, 60_000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  const unreadNotifications = notifications.filter(n => !n.read).length;
  const totalBadge = unreadNotifications + (isAdmin ? pendingRequests : 0);

  const handleBellEnter = () => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    setShowBellTooltip(true);
  };
  const handleBellLeave = () => {
    tooltipTimer.current = setTimeout(() => setShowBellTooltip(false), 150);
  };

  return (
    <header className="h-16 border-b border-gray-700/50 glass flex items-center justify-between px-6 sticky top-0 z-10">
      <h1 className="text-lg font-semibold text-gray-200">
        <span className="bg-primary-500/20 text-primary-400 px-3 py-1 rounded-full text-sm mr-3">
          {user?.role.replace(/_/g, ' ')}
        </span>
        Overview
      </h1>
      <div className="flex items-center gap-6">
        <button
          onClick={onThemeToggle}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition-colors cursor-pointer"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* Bell icon with combined badge + hover tooltip breakdown */}
        <div
          className="relative cursor-pointer hover:text-white text-gray-400 transition-colors"
          onMouseEnter={handleBellEnter}
          onMouseLeave={handleBellLeave}
        >
          <Bell size={22} />

          {/* Combined badge (red for normal notifications, amber if only pending requests) */}
          {totalBadge > 0 && (
            <span className={`absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] px-1 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-lg
              ${unreadNotifications > 0 ? 'bg-danger-500' : 'bg-amber-500'}`}>
              {totalBadge > 99 ? '99+' : totalBadge}
            </span>
          )}

          {/* Hover tooltip — shows breakdown for admins */}
          {showBellTooltip && isAdmin && totalBadge > 0 && (
            <div className="absolute right-0 top-8 w-64 rounded-xl border border-gray-700 bg-gray-900 shadow-2xl p-3 space-y-2 z-50 text-left pointer-events-none">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notifications</p>
              {unreadNotifications > 0 && (
                <div className="flex items-center gap-2.5 text-sm">
                  <span className="w-2 h-2 rounded-full bg-danger-500 flex-shrink-0" />
                  <span className="text-gray-300">
                    <span className="font-semibold text-white">{unreadNotifications}</span> unread notification{unreadNotifications !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              {pendingRequests > 0 && (
                <div className="flex items-center gap-2.5 text-sm">
                  <ClipboardList size={14} className="text-amber-400 flex-shrink-0" />
                  <span className="text-gray-300">
                    <span className="font-semibold text-amber-300">{pendingRequests}</span> pending account request{pendingRequests !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              <p className="text-[10px] text-gray-600 pt-1 border-t border-gray-800">
                Go to Admin Panel → Requests to review
              </p>
            </div>
          )}
        </div>
        <SwitchAccountDropdown />
      </div>
    </header>
  );
}

export function Layout() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="flex min-h-screen bg-gray-900 text-gray-100">
      <Sidebar />
      <main className="flex-1 flex flex-col relative">
        <Topbar theme={theme} onThemeToggle={toggleTheme} />
        <div className="p-6 flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
