import React from 'react';
import { Sun, Moon, LogOut, Menu, ShieldAlert, GraduationCap, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { SCHOOL_LOGO_URL } from '../constants/school';

interface NavbarProps {
  onToggleSidebar: () => void;
  currentSectionTitle?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, currentSectionTitle }) => {
  const { activeRole, userProfile, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const getRoleBadge = () => {
    switch (activeRole) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <ShieldAlert className="w-3.5 h-3.5" />
            ADMINISTRATOR
          </span>
        );
      case 'teacher':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <GraduationCap className="w-3.5 h-3.5" />
            FACULTY TEACHER
          </span>
        );
      case 'parent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30">
            <Users className="w-3.5 h-3.5" />
            PARENT / GUARDIAN
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 w-full px-4 md:px-6 flex items-center justify-between border-b transition-colors bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-800 backdrop-blur-md shadow-xs">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
          className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2.5">
          <img
            src={SCHOOL_LOGO_URL}
            alt="Mubende Light Logo"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-blue-500 shadow-sm shrink-0"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Crect fill=%22%230f172a%22 width=%2240%22 height=%2240%22 rx=%2220%22/%3E%3Ctext x=%2220%22 y=%2225%22 text-anchor=middle fill=white font-size=12 font-weight=bold%3EMLSS%3C/text%3E%3C/svg%3E';
            }}
          />
          <span className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 dark:text-white uppercase whitespace-nowrap">
            Mubende Light
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Role Badge */}
        <div className="hidden md:block">{getRoleBadge()}</div>

        {/* Light / Dark Mode Toggle */}
        <button
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors focus:outline-none cursor-pointer"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700 hover:-rotate-12 transition-transform" />
          )}
        </button>

        {/* Logout button directly following theme toggle with no circular avatar */}
        <button
          onClick={logout}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 transition-colors focus:outline-none cursor-pointer"
          title="Log Out of System"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Log Out</span>
        </button>
      </div>
    </header>
  );
};
