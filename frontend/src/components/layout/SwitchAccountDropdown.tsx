import { useState, useRef, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import api from '../../api/client';
import { ChevronDown, Check, UserCircle2, Search, KeyRound } from 'lucide-react';

const ROLE_GROUPS = [
  { label: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] },
  { label: 'MANAGERS', roles: ['MANAGER'] },
  { label: 'DEVELOPERS', roles: ['DEVELOPER'] },
  { label: 'VERIFIERS', roles: ['VERIFIER'] },
  { label: 'CLIENTS', roles: ['CLIENT'] },
  { label: 'VIEWERS & OTHERS', roles: ['VIEWER', 'UPCL_VIEWER'] },
];

export function SwitchAccountDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dbAccounts, setDbAccounts] = useState<any[]>([]);
  
  const currentUser = useAuthStore(state => state.user);
  const login = useAuthStore(state => state.login);
  const logout = useAuthStore(state => state.logout);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fallback default list using the correct "upcl@123" password
  const defaultAccounts = useMemo(() => [
    { username: 'superadmin1', name: 'Super Admin 1', role: 'SUPER_ADMIN', pwd: 'upcl@123', moduleCount: 12 },
    { username: 'admin1', name: 'Admin 1', role: 'VIEWER', pwd: 'upcl@123', moduleCount: 5 },
    { username: 'manager1', name: 'Manager 1', role: 'MANAGER', pwd: 'upcl@123', moduleCount: 4 },
    { username: 'developer1', name: 'Developer 1', role: 'DEVELOPER', pwd: 'upcl@123', moduleCount: 2 },
    { username: 'verifier1', name: 'Verifier 1', role: 'VERIFIER', pwd: 'upcl@123', moduleCount: 0 },
    { username: 'client1', name: 'Client 1', role: 'CLIENT', pwd: 'upcl@123', moduleCount: 0 },
    { username: 'komal', name: 'Komal', role: 'CLIENT', pwd: 'upcl@123', moduleCount: 0 },
    { username: 'abhishekrishi', name: 'AbhishekRishi', role: 'MANAGER', pwd: 'upcl@123', moduleCount: 4 },
    { username: 'sachinp', name: 'SachinP', role: 'DEVELOPER', pwd: 'upcl@123', moduleCount: 2 },
    { username: 'pankaj', name: 'Pankaj', role: 'VERIFIER', pwd: 'upcl@123', moduleCount: 0 },
  ], []);

  // Fetch users dynamically from database
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await api.get('/users');
        if (Array.isArray(response.data)) {
          setDbAccounts(response.data);
        }
      } catch (err) {
        console.error('Failed to fetch users:', err);
      }
    };
    if (currentUser) {
      fetchUsers();
    }
  }, [currentUser]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const accounts = useMemo(() => {
    if (dbAccounts.length > 0) {
      return dbAccounts.map(u => ({
        username: u.username,
        name: u.name || u.username,
        role: u.role,
        pwd: 'upcl@123', // Demo password for all users
        moduleCount: u.modules?.length || 0
      }));
    }
    return defaultAccounts;
  }, [dbAccounts, defaultAccounts]);

  const handleSwitch = async (account: typeof defaultAccounts[0]) => {
    if (currentUser?.username === account.username) return;
    
    setLoading(account.username);
    try {
      logout();
      const response = await api.post('/auth/login', { 
        username: account.username, 
        password: account.pwd 
      });
      
      login(response.data.user, response.data.token);
      
      // Show toast
      setToast(`Logged in as ${account.username} (${account.role})`);
      setTimeout(() => {
        setToast(null);
        // Force full reload to refresh roles, permissions, and sidebar
        window.location.href = '/';
      }, 1000);
      
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to switch account:', err);
      alert(`Failed to switch to ${account.username}`);
    } finally {
      // Don't clear loading if successful because we're redirecting
      if (toast === null) setLoading(null);
    }
  };

  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => 
      acc.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [accounts, searchQuery]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 hover:bg-gray-800/50 p-1.5 pl-3 rounded-full transition-colors"
      >
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-gray-100">{currentUser?.name || currentUser?.username || 'User'}</p>
          <p className="text-xs text-gray-400 capitalize">{currentUser?.role?.replace(/_/g, ' ').toLowerCase() || 'Role'}</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary-600 to-accent-500 flex items-center justify-center font-bold text-lg shadow-lg shadow-primary-500/20 text-white">
          {currentUser?.name?.[0] || currentUser?.username?.[0]?.toUpperCase() || "U"}
        </div>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-gray-900 border border-gray-700/50 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col max-h-[80vh]">
          
          {/* Header & Search */}
          <div className="p-3 border-b border-gray-800 bg-gray-800/20 shrink-0">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-3">
              <UserCircle2 size={14} /> Switch Account
            </h3>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500 transition-colors"
                autoFocus
              />
            </div>
          </div>
          
          {/* Accounts List */}
          <div className="overflow-y-auto py-1 custom-scrollbar flex-1">
            {filteredAccounts.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-4">No accounts found.</p>
            ) : (
              ROLE_GROUPS.map(group => {
                const groupAccounts = filteredAccounts.filter(acc => group.roles.includes(acc.role));
                if (groupAccounts.length === 0) return null;

                return (
                  <div key={group.label} className="mb-2">
                    <div className="px-4 py-1.5 bg-gray-800/40 text-[10px] font-bold text-gray-500 tracking-widest uppercase">
                      {group.label}
                    </div>
                    {groupAccounts.map((account) => {
                      const isActive = currentUser?.username === account.username;
                      const isSwitching = loading === account.username;
                      
                      return (
                        <button
                          key={account.username}
                          onClick={() => handleSwitch(account)}
                          disabled={isSwitching || loading !== null}
                          className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors
                            ${isActive ? 'bg-primary-500/10 text-white' : 'hover:bg-gray-800 text-gray-300'}
                            ${isSwitching ? 'opacity-50 cursor-wait' : ''}
                          `}
                        >
                          <div className="w-8 h-8 shrink-0 rounded-full bg-gray-700 flex items-center justify-center font-bold text-sm text-white">
                            {account.username[0].toUpperCase()}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isActive ? 'text-primary-400' : ''}`}>
                              {account.name}
                            </p>
                            <p className="text-[10px] text-gray-500 font-mono mt-0.5 truncate">
                              {account.role} • {account.username}
                              {account.moduleCount > 0 && ` • ${account.moduleCount} modules`}
                            </p>
                          </div>
                          
                          {isSwitching ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                          ) : isActive ? (
                            <Check size={16} className="text-primary-500 shrink-0" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-800 bg-gray-800/40 shrink-0 flex items-center justify-center gap-2 text-xs text-gray-500">
            <KeyRound size={12} />
            <span>Demo password: <strong className="font-mono text-gray-400">upcl@123</strong></span>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-gray-800 border border-gray-700 text-white px-4 py-3 rounded-lg shadow-xl animate-in slide-in-from-bottom-4 flex items-center gap-3 z-50">
          <div className="w-8 h-8 rounded-full bg-success-500/20 text-success-500 flex items-center justify-center">
            <Check size={16} />
          </div>
          <p className="text-sm font-medium">{toast}</p>
        </div>
      )}
    </div>
  );
}
