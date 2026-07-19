import { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, LogOut, Bell, Layers, Users, Share2, BarChart3, Shield, Sun, Moon, ClipboardList, Palette, Settings, Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../api/client';
import { SwitchAccountDropdown } from './layout/SwitchAccountDropdown';
import logo from '../assets/logo.png';

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  isCollapsed: boolean;
  isActive: boolean;
  onClick: () => void;
  danger?: boolean;
}

function NavItem({ to, icon: Icon, label, isCollapsed, isActive, onClick, danger }: NavItemProps) {
  return (
    <Link 
      to={to} 
      onClick={onClick}
      title={isCollapsed ? label : undefined}
      className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 rounded-lg font-medium transition-colors cursor-pointer
        ${danger 
          ? 'text-gray-400 hover:text-danger-500 hover:bg-danger-500/10' 
          : isActive 
            ? 'bg-gray-700/50 text-gray-100' 
            : 'text-gray-400 hover:bg-gray-700/30 hover:text-gray-100'
        }
      `}
    >
      <Icon size={20} className="shrink-0" />
      {!isCollapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

interface SidebarProps {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
}

function Sidebar({ isCollapsed, isMobileOpen, onToggleCollapse, onCloseMobile }: SidebarProps) {
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed md:sticky top-0 z-50 flex flex-col h-screen border-r border-gray-700/50 bg-gray-900 transition-all duration-300
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        ${isCollapsed ? 'w-20' : 'w-64'}
      `}>
        <div className={`p-5 flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3'} border-b border-gray-800/60 bg-gray-900/10 shrink-0`}>
          <img src={logo} alt="Logo" className="w-10 h-10 object-contain rounded-xl shrink-0" />
          {!isCollapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="font-extrabold text-lg tracking-tight text-gray-100 leading-none truncate">PatchFlow</span>
              <span className="text-[10px] text-gray-500 font-semibold tracking-wider uppercase mt-1 truncate">Change Board</span>
            </div>
          )}
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
          <NavItem to="/" icon={LayoutDashboard} label="Dashboard" isCollapsed={isCollapsed} isActive={location.pathname === '/'} onClick={onCloseMobile} />
          <NavItem to="/patches" icon={CheckSquare} label="Change Board" isCollapsed={isCollapsed} isActive={location.pathname === '/patches'} onClick={onCloseMobile} />
          
          {(user?.role === 'SUPER_ADMIN' || user?.role === 'MANAGER' || user?.role === 'CLIENT') && (
            <NavItem to="/reports" icon={BarChart3} label="Reports" isCollapsed={isCollapsed} isActive={location.pathname === '/reports'} onClick={onCloseMobile} />
          )}
          
          <NavItem to="/settings" icon={Settings} label="Settings" isCollapsed={isCollapsed} isActive={location.pathname === '/settings'} onClick={onCloseMobile} />
          
          {user?.role === 'SUPER_ADMIN' && (
            <>
              <div className={`pt-4 pb-2 ${isCollapsed ? 'text-center' : 'px-4'}`}>
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  {isCollapsed ? '---' : 'Administration'}
                </span>
              </div>
              <NavItem to="/modules" icon={Layers} label="Modules" isCollapsed={isCollapsed} isActive={location.pathname === '/modules'} onClick={onCloseMobile} />
              <NavItem to="/assignments" icon={Users} label="User Assignments" isCollapsed={isCollapsed} isActive={location.pathname === '/assignments'} onClick={onCloseMobile} />
              <NavItem to="/hierarchy" icon={Share2} label="Resource Hierarchy" isCollapsed={isCollapsed} isActive={location.pathname === '/hierarchy'} onClick={onCloseMobile} />
              <NavItem to="/admin" icon={Shield} label="Admin Panel" isCollapsed={isCollapsed} isActive={location.pathname === '/admin'} onClick={onCloseMobile} />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-gray-700/50 space-y-2 shrink-0 bg-gray-900">
          <button 
            onClick={handleLogout} 
            title={isCollapsed ? "Sign Out" : undefined}
            className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} w-full py-3 rounded-lg text-gray-400 hover:text-danger-500 hover:bg-danger-500/10 transition-colors cursor-pointer`}
          >
            <LogOut size={20} className="shrink-0" />
            {!isCollapsed && <span className="truncate">Sign Out</span>}
          </button>
          
          {/* Desktop Toggle Button */}
          <button 
            onClick={onToggleCollapse}
            className="hidden md:flex items-center justify-center w-full py-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </aside>
    </>
  );
}

interface TopbarProps {
  theme: 'blue' | 'white' | 'black';
  onThemeToggle: () => void;
  onOpenMobileSidebar: () => void;
}

function Topbar({ theme, onThemeToggle, onOpenMobileSidebar }: TopbarProps) {
  const user = useAuthStore(state => state.user);
  const isAdmin = user?.role === 'SUPER_ADMIN';

  const [notifications, setNotifications] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [showBellTooltip, setShowBellTooltip] = useState(false);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchNotifications = () => {
    api.get("/notifications").then(res => setNotifications(res.data)).catch(console.error);
  };

  useEffect(() => {
    fetchNotifications();
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
    <header className="h-16 border-b border-gray-700/50 glass flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 shrink-0">
      <div className="flex items-center gap-3">
        <button 
          onClick={onOpenMobileSidebar}
          className="md:hidden p-2 -ml-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition-colors"
        >
          <Menu size={24} />
        </button>
        <h1 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
          <span className="hidden sm:inline-block bg-primary-500/20 text-primary-400 px-3 py-1 rounded-full text-sm">
            {user?.role.replace(/_/g, ' ')}
          </span>
          <span className="truncate max-w-[150px] sm:max-w-none">Overview</span>
        </h1>
      </div>
      
      <div className="flex items-center gap-2 sm:gap-6">
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

        <div
          className="relative cursor-pointer hover:text-white text-gray-400 transition-colors"
          onMouseEnter={handleBellEnter}
          onMouseLeave={handleBellLeave}
        >
          <div className="p-2">
            <Bell size={22} />
          </div>
          {totalBadge > 0 && (
            <span className={`absolute top-0.5 right-0.5 flex h-[18px] min-w-[18px] px-1 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-lg
              ${unreadNotifications > 0 ? 'bg-danger-500' : 'bg-amber-500'}`}>
              {totalBadge > 99 ? '99+' : totalBadge}
            </span>
          )}

          {showBellTooltip && (
            <div className="absolute right-0 top-12 w-72 sm:w-80 rounded-xl border border-gray-700 bg-gray-900 shadow-2xl p-4 z-50 text-left pointer-events-auto flex flex-col gap-3 max-h-96 overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center pb-2 border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Notifications</span>
                  {unreadNotifications > 0 && (
                    <span className="text-[10px] bg-danger-500/20 text-danger-400 font-bold px-2 py-0.5 rounded-full">
                      {unreadNotifications} New
                    </span>
                  )}
                </div>
                {notifications.length > 0 && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await api.delete("/notifications/clear");
                        // Re-fetch from server to ensure badge is accurate
                        api.get("/notifications").then(res => setNotifications(res.data)).catch(() => setNotifications([]));
                      } catch (err) {
                        console.error("Failed to clear notifications", err);
                      }
                    }}
                    className="text-[10px] font-semibold text-primary-400 hover:text-primary-300 transition-colors bg-primary-500/10 hover:bg-primary-500/20 border border-primary-500/20 px-2 py-0.5 rounded-md cursor-pointer select-none"
                  >
                    Clear All
                  </button>
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
        <div className="ml-1 sm:ml-2">
          <SwitchAccountDropdown />
        </div>
      </div>
    </header>
  );
}

export function Layout() {
  const [theme, setTheme] = useState<'blue' | 'white' | 'black'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'white' || saved === 'black' || saved === 'blue') return saved;
    if (saved === 'light') return 'white';
    if (saved === 'dark') return 'blue';
    return 'blue';
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  });
  
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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

  const toggleSidebarCollapse = () => {
    const newVal = !isSidebarCollapsed;
    setIsSidebarCollapsed(newVal);
    localStorage.setItem('sidebarCollapsed', String(newVal));
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 overflow-hidden">
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        isMobileOpen={isMobileSidebarOpen}
        onToggleCollapse={toggleSidebarCollapse}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />
      <main className="flex-1 flex flex-col min-w-0 relative">
        <Topbar 
          theme={theme} 
          onThemeToggle={toggleTheme} 
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
