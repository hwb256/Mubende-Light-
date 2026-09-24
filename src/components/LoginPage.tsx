import React, { useState } from 'react';
import {
  ShieldAlert,
  GraduationCap,
  Users,
  Sun,
  Moon,
  ArrowLeft,
  Lock,
  Mail,
  AlertCircle,
  Loader2,
  Info,
} from 'lucide-react';
import { Role } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { SCHOOL_LOGO_URL } from '../constants/school';

interface LoginPageProps {
  role: Role;
  onBack: () => void;
  onSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ role, onBack, onSuccess }) => {
  const { login } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getRoleConfig = () => {
    switch (role) {
      case 'admin':
        return {
          title: 'Admin Access Control',
          subtitle: 'Head office, registrar, bursar, and master administration access',
          icon: ShieldAlert,
          color: 'amber',
          borderHover: 'hover:border-amber-500/50',
          btnBg: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20',
          placeholderEmail: 'admin@mubendelight.sc.ug',
        };
      case 'teacher':
        return {
          title: 'Faculty Access Control Gate',
          subtitle: 'Teaching staff lesson registers, assessment marks, and timetables',
          icon: GraduationCap,
          color: 'emerald',
          borderHover: 'hover:border-emerald-500/50',
          btnBg: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20',
          placeholderEmail: 'teacher@mubendelight.sc.ug',
        };
      case 'parent':
        return {
          title: 'Parent Access Control Gate',
          subtitle: 'Academic progress tracking, terminal report cards, and fee clearance',
          icon: Users,
          color: 'blue',
          borderHover: 'hover:border-blue-500/50',
          btnBg: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20',
          placeholderEmail: 'parent@mubendelight.sc.ug',
        };
      default:
        return {
          title: 'Institutional Portal',
          subtitle: 'Mubende Light SSS Management System',
          icon: Users,
          color: 'blue',
          borderHover: 'hover:border-blue-500/50',
          btnBg: 'bg-blue-600 hover:bg-blue-700 text-white',
          placeholderEmail: 'user@mubendelight.sc.ug',
        };
    }
  };

  const config = getRoleConfig();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Email address and password are required.');
      return;
    }
    setError(null);
    setLoading(true);
    const res = await login(email, password, role);
    setLoading(false);
    if (res.success) {
      onSuccess();
    } else {
      setError(res.error || 'Authentication failed. Please verify credentials.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Top Bar */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Role Selection
        </button>
        <button
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
        </button>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-2xl dark:shadow-black/80 transition-all text-center relative overflow-hidden">
          {/* Circular logo */}
          <div className="flex justify-center mb-3">
            <img
              src={SCHOOL_LOGO_URL}
              alt="Mubende Light SSS"
              className="w-20 h-20 rounded-full object-cover border-3 border-blue-500 shadow-lg shadow-blue-500/30"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22%3E%3Crect fill=%22%230f172a%22 width=%2280%22 height=%2280%22 rx=%2240%22/%3E%3Ctext x=%2240%22 y=%2247%22 text-anchor=middle fill=white font-size=20 font-weight=bold%3EMLSS%3C/text%3E%3C/svg%3E';
              }}
            />
          </div>

          <h2 className="text-lg font-black tracking-wider uppercase text-slate-900 dark:text-white mb-0.5">
            MUBENDE LIGHT SSS
          </h2>
          <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold italic mb-1">
            &ldquo;Education is Light.&rdquo;
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 font-medium">
            {config.title}
          </p>

          {/* Strict Notice */}
          <div className="mb-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2.5 text-left">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <span>
              <strong>School Access Credentials:</strong> Use your official institutional email and password provisioned by administration.
            </span>
          </div>

          {/* Error Alert with full diagnostics */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2 text-left animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Sign In Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Official Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder={config.placeholderEmail}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Password / Passcode
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50 mt-2 ${config.btnBg}`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Authenticating...
                </>
              ) : (
                `Enter ${role.toUpperCase()} Portal`
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};
