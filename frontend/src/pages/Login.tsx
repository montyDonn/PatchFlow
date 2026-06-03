import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import api from "../api/client";
import { submitAccessRequest } from "../api/accountRequests";
import logo from "../assets/logo.png";
import {
  Eye, EyeOff, X, ChevronLeft,
  UserCheck, Users, CheckCircle, Phone, User, Lock, AtSign,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type PanelStep = "role" | "form" | "success";
type Role = "CLIENT" | "VIEWER";

interface RoleCard {
  role: Role;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  border: string;
  bg: string;
}

const ROLE_CARDS: RoleCard[] = [
  {
    role: "CLIENT",
    title: "Client Access",
    subtitle: "For external clients who raise and track change requests",
    icon: <UserCheck size={28} />,
    color: "text-green-400",
    border: "border-green-500/40",
    bg: "bg-green-500/10",
  },
  {
    role: "VIEWER",
    title: "Viewer Access",
    subtitle: "Read-only observer — monitor patches without making changes",
    icon: <Users size={28} />,
    color: "text-sky-400",
    border: "border-sky-500/40",
    bg: "bg-sky-500/10",
  },
];

// ─── Request Access Panel ────────────────────────────────────────────────────
function RequestAccessPanel({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<PanelStep>("role");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    username: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    setStep("form");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || !form.username.trim() || !form.password) {
      setError("Name, username, and password are required.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (!selectedRole) return;

    setLoading(true);
    try {
      await submitAccessRequest({
        name: form.name.trim(),
        username: form.username.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        role: selectedRole,
      });
      setStep("success");
    } catch (err: any) {
      setError(err.response?.data?.error || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const selectedCard = ROLE_CARDS.find((c) => c.role === selectedRole);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sliding panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md flex flex-col bg-gray-950 border-l border-gray-800 shadow-2xl animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            {step === "form" && (
              <button
                onClick={() => { setStep("role"); setError(""); }}
                className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <div>
              <h2 className="text-white font-bold text-lg">Request Account Access</h2>
              <p className="text-gray-500 text-xs mt-0.5">
                {step === "role" && "Choose the type of access you need"}
                {step === "form" && `Registering as ${selectedCard?.title}`}
                {step === "success" && "Request submitted!"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-500 hover:text-white hover:bg-gray-800 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">

          {/* ── Step 1: Role Picker ── */}
          {step === "role" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400 leading-relaxed">
                Select the type of account you need. An admin will review your request
                before your account is activated.
              </p>
              <div className="space-y-3 mt-6">
                {ROLE_CARDS.map((card) => (
                  <button
                    key={card.role}
                    onClick={() => handleRoleSelect(card.role)}
                    className={`w-full text-left p-5 rounded-2xl border transition-all hover:scale-[1.01] active:scale-[0.99] group
                      ${card.border} ${card.bg} hover:brightness-110`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`${card.color} mt-0.5 transition-transform group-hover:scale-110`}>
                        {card.icon}
                      </div>
                      <div>
                        <div className={`font-bold text-base ${card.color}`}>{card.title}</div>
                        <div className="text-sm text-gray-400 mt-1">{card.subtitle}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-6 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                <p className="text-xs text-amber-400 leading-relaxed">
                  <strong>Note:</strong> Internal roles (Developer, Manager, Verifier) can only be
                  created by a system administrator. Contact your admin directly for those accounts.
                </p>
              </div>
            </div>
          )}

          {/* ── Step 2: Registration Form ── */}
          {step === "form" && selectedCard && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Role badge */}
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-medium ${selectedCard.color} ${selectedCard.border} ${selectedCard.bg}`}>
                {selectedCard.icon && <span className="scale-75">{selectedCard.icon}</span>}
                {selectedCard.title}
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                  <input
                    id="req-name"
                    type="text"
                    required
                    autoFocus
                    value={form.name}
                    onChange={update("name")}
                    placeholder="Your full name"
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-primary-500 transition"
                  />
                </div>
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Username <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                  <input
                    id="req-username"
                    type="text"
                    required
                    value={form.username}
                    onChange={update("username")}
                    placeholder="Choose a username"
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-primary-500 transition"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                  <input
                    id="req-phone"
                    type="tel"
                    value={form.phone}
                    onChange={update("phone")}
                    placeholder="+91 98765 43210"
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-primary-500 transition"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Password <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                  <input
                    id="req-password"
                    type={showPwd ? "text" : "password"}
                    required
                    value={form.password}
                    onChange={update("password")}
                    placeholder="Min. 6 characters"
                    className="w-full pl-9 pr-10 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-primary-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
                  >
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Confirm Password <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                  <input
                    id="req-confirm-password"
                    type={showConfirm ? "text" : "password"}
                    required
                    value={form.confirmPassword}
                    onChange={update("confirmPassword")}
                    placeholder="Re-enter your password"
                    className={`w-full pl-9 pr-10 py-2.5 bg-gray-900 border rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none transition
                      ${form.confirmPassword && form.password !== form.confirmPassword
                        ? "border-red-500/60 focus:border-red-500"
                        : "border-gray-700 focus:border-primary-500"
                      }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
                  >
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {form.confirmPassword && form.password !== form.confirmPassword && (
                  <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-sm text-red-400">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-900/30"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Submitting…
                  </span>
                ) : (
                  "Submit Request"
                )}
              </button>
            </form>
          )}

          {/* ── Step 3: Success ── */}
          {step === "success" && (
            <div className="flex flex-col items-center text-center py-8 space-y-5">
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle className="text-emerald-400" size={40} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Request Submitted!</h3>
                <p className="text-gray-400 text-sm mt-2 leading-relaxed max-w-xs">
                  Your access request has been received. An administrator will review
                  it and activate your account shortly.
                </p>
              </div>
              <div className="w-full p-4 rounded-xl border border-gray-700 bg-gray-900 text-left space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Username</span>
                  <span className="text-white font-mono">{form.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Role Requested</span>
                  <span className={`font-semibold ${selectedCard?.color}`}>{selectedCard?.title}</span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl border border-gray-700 text-gray-300 text-sm hover:bg-gray-800 transition"
              >
                Back to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────
export function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPanel, setShowPanel] = useState(false);

  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await api.post("/auth/login", { username, password });
      const rawUser = response.data.user;
      // Backend returns `userId`; normalize to `id` for the auth store
      const normalizedUser = { ...rawUser, id: rawUser.id || rawUser.userId };
      login(normalizedUser, response.data.token);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.error || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary-600/10 rounded-full blur-3xl" />
        </div>

        {/* Logo / heading */}
        <div className="sm:mx-auto sm:w-full sm:max-w-md relative">
          <div className="flex justify-center items-center gap-3">
            <img src={logo} alt="Logo" className="w-14 h-14 object-contain rounded-2xl" />
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Change Management
            </h1>
          </div>
          <p className="mt-3 text-center text-sm text-gray-500">
            PatchFlow · Powered by UPCL
          </p>
        </div>

        {/* Card */}
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative">
          <div className="glass-card py-8 px-6 sm:rounded-2xl border border-gray-800">
            <h2 className="text-center text-xl font-bold text-white mb-6">
              Sign in to your account
            </h2>

            <form className="space-y-5" onSubmit={handleLogin}>
              {/* Username */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                  <input
                    id="login-username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-600 rounded-xl shadow-sm placeholder-gray-500 bg-gray-800 text-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-sm transition-colors"
                    placeholder="Enter your username"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                  <input
                    id="login-password"
                    type={showPwd ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 border border-gray-600 rounded-xl shadow-sm placeholder-gray-500 bg-gray-800 text-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-sm transition-colors"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
                  >
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="text-red-400 text-sm font-medium bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                  {error}
                </div>
              )}

              {/* Sign In button */}
              <button
                id="login-submit"
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-primary-600 hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 focus:ring-offset-gray-900 transition-all disabled:opacity-50 shadow-lg shadow-primary-900/20"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            {/* Divider */}
            <div className="relative mt-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-gray-900 px-3 text-gray-500 rounded">
                  Don't have an account?
                </span>
              </div>
            </div>

            {/* Request Access link */}
            <button
              id="request-access-btn"
              type="button"
              onClick={() => setShowPanel(true)}
              className="mt-4 w-full py-2.5 rounded-xl border border-gray-700 text-sm text-gray-300 hover:text-white hover:border-primary-500/50 hover:bg-primary-500/5 transition-all font-medium"
            >
              Request Account Access
            </button>
          </div>
        </div>
      </div>

      {/* Slide-in panel */}
      {showPanel && <RequestAccessPanel onClose={() => setShowPanel(false)} />}
    </>
  );
}
