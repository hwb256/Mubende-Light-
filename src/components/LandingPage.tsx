import React from 'react';
import {
  ShieldAlert,
  GraduationCap,
  Users,
  Sun,
  Moon,
  ArrowRight,
  School,
  Sparkles,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { Role } from '../types';
import { SCHOOL_LOGO_URL } from '../constants/school';

interface LandingPageProps {
  onSelectRole: (role: Role) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSelectRole }) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Top Banner */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <img
            src={SCHOOL_LOGO_URL}
            alt="Mubende Light SSS Logo"
            className="w-11 h-11 rounded-full object-cover border-2 border-blue-500 shadow-md shadow-blue-500/20 shrink-0"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2244%22 height=%2244%22%3E%3Crect fill=%22%230f172a%22 width=%2244%22 height=%2244%22 rx=%2222%22/%3E%3Ctext x=%2222%22 y=%2227%22 text-anchor=middle fill=white font-size=14 font-weight=bold%3EMLSS%3C/text%3E%3C/svg%3E';
            }}
          />
          <div>
            <h1 className="text-sm md:text-base font-extrabold tracking-tight text-slate-900 dark:text-white uppercase">
              MUBENDE LIGHT SENIOR SECONDARY SCHOOL
            </h1>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium italic">
              &ldquo;Education is Light.&rdquo;
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 md:py-16 max-w-6xl mx-auto w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <img
              src={SCHOOL_LOGO_URL}
              alt="Mubende Light SSS Emblem"
              className="w-24 h-24 rounded-full object-cover border-4 border-blue-500 shadow-2xl shadow-blue-500/30"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2296%22 height=%2296%22%3E%3Crect fill=%22%230f172a%22 width=%2296%22 height=%2296%22 rx=%2248%22/%3E%3Ctext x=%2248%22 y=%2255%22 text-anchor=middle fill=white font-size=24 font-weight=bold%3EMLSS%3C/text%3E%3C/svg%3E';
              }}
            />
            <div className="absolute -bottom-1 -right-1 p-1.5 bg-blue-600 rounded-full text-white shadow-md">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight max-w-3xl mb-3 leading-tight text-slate-900 dark:text-white">
          MUBENDE LIGHT S.S.S
        </h2>
        <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 italic mb-4">
          &ldquo;Education is Light.&rdquo;
        </p>
        <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-2xl mb-12">
          Select your institutional portal to authenticate and enter your workspace.
        </p>

        {/* Role Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl text-left">
          {/* Admin Role */}
          <div
            onClick={() => onSelectRole('admin')}
            className="group relative cursor-pointer p-6 rounded-2xl border transition-all duration-300 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-500/60 hover:shadow-xl hover:shadow-amber-500/10 hover:-translate-y-1 shadow-xs"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4 border border-amber-500/20 group-hover:scale-110 transition-transform">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-1 text-slate-900 dark:text-white flex items-center justify-between">
              Administrator
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Admin access control, student admissions, staff directory, fees ledger, and payment approvals.
            </p>
          </div>

          {/* Teacher Role */}
          <div
            onClick={() => onSelectRole('teacher')}
            className="group relative cursor-pointer p-6 rounded-2xl border transition-all duration-300 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-500/60 hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1 shadow-xs"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 border border-emerald-500/20 group-hover:scale-110 transition-transform">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-1 text-slate-900 dark:text-white flex items-center justify-between">
              Faculty Teacher
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Lesson registers, weekly teaching timetable, student marks entry, and continuous assessment.
            </p>
          </div>

          {/* Parent Role */}
          <div
            onClick={() => onSelectRole('parent')}
            className="group relative cursor-pointer p-6 rounded-2xl border transition-all duration-300 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-500/60 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 shadow-xs"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 border border-blue-500/20 group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold mb-1 text-slate-900 dark:text-white flex items-center justify-between">
              Parent / Guardian
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Check linked student performance, attendance, report cards, and settle school fees via Sure Pay.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-500 border-t border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950 flex flex-col items-center justify-center gap-1">
        <div>&copy; {new Date().getFullYear()} Mubende Light Senior Secondary School</div>
        <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium italic">&ldquo;Education is Light.&rdquo;</div>
      </footer>
    </div>
  );
};
