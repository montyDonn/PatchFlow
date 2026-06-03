import { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, LogOut, Bell, Layers, Users, Share2, BarChart3, Shield, Sun, Moon, ClipboardList, Palette } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../api/client';
import { SwitchAccountDropdown } from './layout/SwitchAccountDropdown';
import logo from '../assets/logo.png';

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
      <div className="p-5 flex items-center gap-3 border-b border-gray-800/60 bg-gray-900/10">
        <img src={logo} alt="Logo" className="w-10 h-10 object-contain rounded-xl" />
        <div className="flex flex-col">
          <span className="font-extrabold text-lg tracking-tight text-gray-100 leading-none">PatchFlow</span>
          <span className="text-[10px] text-gray-500 font-semibold tracking-wider uppercase mt-1">Change Board</span>
        </div>
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
  theme: 'blue' | 'white' | 'black';
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
  const fetchNotifications = () => {
    api.get("/notifications").then(res => setNotifications(res.data)).catch(console.error);
  };

  useEffect(() => {
    fetchNotifications();
    // Poll notifications every 30s to keep it real-time
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await api.patch(`/notifications/${notificationId}/read`);
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

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
          className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          title={`Current Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}. Click to switch.`}
        >
          {theme === 'blue' && <Palette size={20} className="text-primary-400" />}
          {theme === 'white' && <Sun size={20} className="text-amber-500" />}
          {theme === 'black' && <Moon size={20} className="text-purple-400" />}
          <span className="text-xs font-semibold capitalize hidden sm:inline">{theme}</span>
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

          {/* Interactive Notifications List Dropdown */}
          {showBellTooltip && (
            <div className="absolute right-0 top-8 w-80 rounded-xl border border-gray-700 bg-gray-900 shadow-2xl p-4 z-50 text-left pointer-events-auto flex flex-col gap-3 max-h-96 overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center pb-2 border-b border-gray-800">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Notifications</span>
                {unreadNotifications > 0 && (
                  <span className="text-[10px] bg-danger-500/20 text-danger-400 font-bold px-2 py-0.5 rounded-full">
                    {unreadNotifications} New
                  </span>
                )}
              </div>
              <div className="space-y-2 flex-1 overflow-y-auto max-h-60 custom-scrollbar pr-0.5">
                {notifications.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-6">No notifications yet.</p>
                ) : (
                  notifications.slice(0, 10).map((n) => (
                    <div
                      key={n.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!n.read) handleMarkAsRead(n.id);
                      }}
                      className={`group flex flex-col p-2.5 rounded-lg border transition-all cursor-pointer ${
                        n.read
                          ? 'border-gray-805 bg-gray-950/20 text-gray-400'
                          : 'border-primary-500/30 bg-primary-500/5 text-gray-200 hover:bg-primary-500/10'
                      }`}
                    >
                      <p className="text-xs leading-relaxed break-words">{n.message}</p>
                      <div className="flex justify-between items-center mt-2 pt-1 border-t border-gray-800/20">
                        <span className="text-[9px] text-gray-500 font-mono">
                          {new Date(n.createdAt).toLocaleDateString()}
                        </span>
                        {!n.read && (
                          <span className="text-[9px] font-semibold text-primary-400 group-hover:text-primary-300 transition-colors">
                            Mark as read
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              {isAdmin && pendingRequests > 0 && (
                <div className="flex items-center gap-2.5 text-xs bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5 text-gray-300 mt-1">
                  <ClipboardList size={14} className="text-amber-400 flex-shrink-0" />
                  <span className="flex-1">
                    <span className="font-semibold text-amber-300">{pendingRequests}</span> pending account requests
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
        <SwitchAccountDropdown />
      </div>
    </header>
  );
}

export function Layout() {
  const [theme, setTheme] = useState<'blue' | 'white' | 'black'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'white' || saved === 'black' || saved === 'blue') return saved;
    // Compatibility fallbacks for older dark/light settings
    if (saved === 'light') return 'white';
    if (saved === 'dark') return 'blue';
    return 'blue';
  });

  useEffect(() => {
    const doc = document.documentElement;
    doc.classList.remove('theme-blue', 'theme-white', 'theme-black', 'light');
    if (theme === 'white') {
      doc.classList.add('theme-white', 'light');
    } else if (theme === 'black') {
      doc.classList.add('theme-black');
    } else {
      doc.classList.add('theme-blue');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      if (prev === 'blue') return 'white';
      if (prev === 'white') return 'black';
      return 'blue';
    });
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
