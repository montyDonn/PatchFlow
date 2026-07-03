import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Mail, Phone, User, Save, AlertCircle, CheckCircle, Lock, KeyRound } from 'lucide-react';
import api from '../api/client';
import { changePassword } from '../api/users';
import { useAuthStore } from '../store/authStore';

export default function SettingsPage() {
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMessage, setPwdMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    api.get('/users/me')
      .then(res => {
        const data = res.data;
        setName(data.name || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load profile", err);
        setLoading(false);
      });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await api.put('/users/me', { name, email, phone });
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save profile.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMessage(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwdMessage({ type: 'error', text: 'All fields are required.' });
      return;
    }
    if (newPassword.length < 8) {
      setPwdMessage({ type: 'error', text: 'New password must be at least 8 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setPwdSaving(true);
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
      setPwdMessage({ type: 'success', text: 'Password updated successfully! Logging you out...' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        logout();
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setPwdMessage({ type: 'error', text: err.response?.data?.error || 'Failed to change password.' });
    } finally {
      setPwdSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-primary-500/10 text-primary-400 rounded-xl">
          <Settings size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-100">User Settings</h1>
          <p className="text-sm text-gray-400">Manage your profile information.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Side: Profile Summary */}
        <div className="md:col-span-1 glass border border-gray-700/50 rounded-2xl p-6 flex flex-col items-center text-center space-y-4">
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-primary-600 to-indigo-600 flex items-center justify-center text-3xl font-extrabold text-white shadow-lg">
            {user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-100">{user?.name}</h2>
            <p className="text-xs text-primary-400 font-medium mt-0.5">{user?.designation || 'Member'}</p>
            <p className="text-[11px] text-gray-500 font-mono mt-1">@{user?.username}</p>
          </div>
          <div className="w-full pt-4 border-t border-gray-800/80 text-left space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 font-medium">Role:</span>
              <span className="text-gray-300 font-semibold">{user?.role}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 font-medium">Status:</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Active
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Form Container */}
        <div className="md:col-span-2 space-y-6">
          {/* Profile Form */}
          <form onSubmit={handleSave} className="glass border border-gray-700/50 rounded-2xl p-6 space-y-6">
            <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2 pb-3 border-b border-gray-800">
              <User size={20} className="text-primary-400" />
              Profile Information
            </h2>

            {message && (
              <div className={`p-4 rounded-xl border flex items-start gap-3 text-sm ${
                message.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}>
                {message.type === 'success' ? <CheckCircle size={20} className="flex-shrink-0" /> : <AlertCircle size={20} className="flex-shrink-0" />}
                <span>{message.text}</span>
              </div>
            )}

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                <User size={16} className="text-gray-400" />
                Full Name
              </label>
              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-950/40 border border-gray-700/60 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                <Mail size={16} className="text-gray-400" />
                Email
              </label>
              <input
                type="email"
                placeholder="Enter email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-950/40 border border-gray-700/60 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                <Phone size={16} className="text-gray-400" />
                Phone Number
              </label>
              <input
                type="text"
                placeholder="Enter phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-gray-950/40 border border-gray-700/60 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t border-gray-800/60 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 disabled:bg-primary-800 text-white font-medium text-sm px-6 py-2.5 rounded-xl transition-colors cursor-pointer shadow-lg shadow-primary-900/20"
              >
                <Save size={16} />
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>

          {/* Change Password Form */}
          <form onSubmit={handlePasswordChange} className="glass border border-gray-700/50 rounded-2xl p-6 space-y-6">
            <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2 pb-3 border-b border-gray-800">
              <KeyRound size={20} className="text-primary-400" />
              Change Password
            </h2>

            {pwdMessage && (
              <div className={`p-4 rounded-xl border flex items-start gap-3 text-sm ${
                pwdMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}>
                {pwdMessage.type === 'success' ? <CheckCircle size={20} className="flex-shrink-0" /> : <AlertCircle size={20} className="flex-shrink-0" />}
                <span>{pwdMessage.text}</span>
              </div>
            )}

            {/* Current Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                <Lock size={16} className="text-gray-400" />
                Current Password
              </label>
              <input
                type="password"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-gray-950/40 border border-gray-700/60 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                <Lock size={16} className="text-gray-400" />
                New Password
              </label>
              <input
                type="password"
                placeholder="Enter new password (min. 8 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-gray-950/40 border border-gray-700/60 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                <Lock size={16} className="text-gray-400" />
                Confirm New Password
              </label>
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-gray-950/40 border border-gray-700/60 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t border-gray-800/60 flex justify-end">
              <button
                type="submit"
                disabled={pwdSaving}
                className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 disabled:bg-primary-800 text-white font-medium text-sm px-6 py-2.5 rounded-xl transition-colors cursor-pointer shadow-lg shadow-primary-900/20"
              >
                <Save size={16} />
                {pwdSaving ? 'Saving...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
