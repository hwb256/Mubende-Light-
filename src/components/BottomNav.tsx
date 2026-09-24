import React from 'react';
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  UserCheck,
  CheckCheck,
  Calendar,
  ClipboardCheck,
  Award,
  CreditCard,
  BookOpen,
  PhoneCall,
} from 'lucide-react';
import { Role } from '../types';

interface BottomNavProps {
  role: Role;
  currentSection: string;
  onNavigate: (section: string) => void;
  pendingApprovalsCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  role,
  currentSection,
  onNavigate,
  pendingApprovalsCount = 0,
}) => {
  const getShortcuts = () => {
    switch (role) {
      case 'admin':
        return [
          { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
          { id: 'students', label: 'Students', icon: GraduationCap },
          { id: 'teachers', label: 'Teachers', icon: Users },
          { id: 'parents', label: 'Parents', icon: UserCheck },
          {
            id: 'paymentapprovals',
            label: 'Approvals',
            icon: CheckCheck,
            badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
          },
        ];
      case 'teacher':
        return [
          { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
          { id: 'timetable', label: 'Timetable', icon: Calendar },
          { id: 'attendance', label: 'Attendance', icon: ClipboardCheck },
          { id: 'results', label: 'Grades', icon: Award },
        ];
      case 'parent':
        return [
          { id: 'home', label: 'Home', icon: LayoutDashboard },
          { id: 'child', label: 'Academics', icon: GraduationCap },
          { id: 'attendance', label: 'Attendance', icon: ClipboardCheck },
          { id: 'fees', label: 'Finances', icon: CreditCard },
          { id: 'contacts', label: 'Contact & Support', icon: PhoneCall },
        ];
      default:
        return [];
    }
  };

  const shortcuts = getShortcuts();
  if (!shortcuts.length) return null;

  return (
    <nav
      aria-label="Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 h-16 border-t transition-colors bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-800 backdrop-blur-md px-2 flex items-center justify-around shadow-lg md:hidden"
    >
      {shortcuts.map((item) => {
        const Icon = item.icon;
        const isActive = currentSection === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`relative flex flex-col items-center justify-center flex-1 h-full py-1 px-1 transition-all rounded-lg cursor-pointer ${
              isActive
                ? 'text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
              {item.badge !== undefined && (
                <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow-xs">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-1 truncate max-w-[64px] leading-tight">
              {item.label}
            </span>
            {isActive && (
              <span className="absolute bottom-1 w-6 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
            )}
          </button>
        );
      })}
    </nav>
  );
};
