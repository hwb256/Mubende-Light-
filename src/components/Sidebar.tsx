import React from 'react';
import {
  LayoutDashboard,
  CheckCheck,
  GraduationCap,
  Users,
  UserCheck,
  School,
  BookOpen,
  Calendar,
  ClipboardCheck,
  Coins,
  CreditCard,
  Award,
  FileText,
  Megaphone,
  MessageSquare,
  ArrowUpRight,
  Archive,
  Sliders,
  ShieldCheck,
  ClipboardList,
  PhoneCall,
  X,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { Role } from '../types';
import { useAuth } from '../context/AuthContext';
import { SCHOOL_LOGO_URL } from '../constants/school';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentSection: string;
  onSelectSection: (section: string) => void;
  pendingApprovalsCount?: number;
  pendingSubmissionsCount?: number;
}

interface SidebarSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  currentSection,
  onSelectSection,
  pendingApprovalsCount = 0,
  pendingSubmissionsCount = 0,
}) => {
  const { activeRole, userProfile, logout } = useAuth();

  const getAdminSections = (): SidebarSection[] => [
    { id: 'dashboard', title: 'Dashboard', icon: LayoutDashboard },
    { id: 'paymentapprovals', title: 'Payment Approvals', icon: CheckCheck, badge: pendingApprovalsCount },
    { id: 'submissions', title: 'Teacher Submissions', icon: ClipboardList, badge: pendingSubmissionsCount },
    { id: 'students', title: 'Students Registry', icon: GraduationCap },
    { id: 'teachers', title: 'Faculty Staff', icon: Users },
    { id: 'parents', title: 'Guardians & Parents', icon: UserCheck },
    { id: 'classes', title: 'Class Streams', icon: School },
    { id: 'subjects', title: 'Curriculum Subjects', icon: BookOpen },
    { id: 'timetable', title: 'Master Timetable', icon: Calendar },
    { id: 'attendance', title: 'Attendance Logs', icon: ClipboardCheck },
    { id: 'fees', title: 'Fee Accounts Ledger', icon: Coins },
    { id: 'payments', title: 'Payments Stream', icon: CreditCard },
    { id: 'results', title: 'Student Marks', icon: Award },
    { id: 'reports', title: 'Terminal Report Cards', icon: FileText },
    { id: 'announcements', title: 'Broadcast Notices', icon: Megaphone },
    { id: 'promotion', title: 'Student Promotion', icon: ArrowUpRight },
    { id: 'pastyears', title: 'Past Years Archive', icon: Archive },
    { id: 'audit', title: 'Audit Trail Ledger', icon: ShieldCheck },
    { id: 'settings', title: 'System Parameters', icon: Sliders },
  ];

  const getTeacherSections = (): SidebarSection[] => [
    { id: 'dashboard', title: 'Teacher Dashboard', icon: LayoutDashboard },
    { id: 'timetable', title: 'Teaching Timetable', icon: Calendar },
    { id: 'attendance', title: 'Lesson Register', icon: ClipboardCheck },
    { id: 'results', title: 'Marks & Assessment', icon: Award },
  ];

  const getParentSections = (): SidebarSection[] => [
    { id: 'home', title: 'Home & Overview', icon: LayoutDashboard },
    { id: 'child', title: 'Academic Performance', icon: GraduationCap },
    { id: 'attendance', title: 'Attendance Log', icon: ClipboardCheck },
    { id: 'fees', title: 'Fees & Clearance', icon: Coins },
    { id: 'contacts', title: 'Contact & Support', icon: PhoneCall },
  ];

  const sections =
    activeRole === 'admin'
      ? getAdminSections()
      : activeRole === 'teacher'
      ? getTeacherSections()
      : getParentSections();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/60 md:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out text-slate-200 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <img
              src={SCHOOL_LOGO_URL}
              alt="Mubende Light SSS Logo"
              className="w-8 h-8 rounded-full object-cover border border-blue-500 shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22%3E%3Crect fill=%22%230f172a%22 width=%2232%22 height=%2232%22 rx=%2216%22/%3E%3Ctext x=%2216%22 y=%2220%22 text-anchor=middle fill=white font-size=10 font-weight=bold%3EMLSS%3C/text%3E%3C/svg%3E';
              }}
            />
            <div>
              <div className="text-xs font-bold tracking-wide text-white uppercase truncate">
                {activeRole ? `${activeRole} Portal` : 'School Portal'}
              </div>
              <div className="text-[10px] text-slate-400">Mubende Light SSS</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="p-3 m-3 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-sm">
            {userProfile?.fullName?.charAt(0) || 'U'}
          </div>
          <div className="overflow-hidden flex-1">
            <div className="text-xs font-semibold text-white truncate">
              {userProfile?.fullName || 'Active Session'}
            </div>
            <div className="text-[10px] text-slate-400 capitalize">
              {userProfile?.role || activeRole}
            </div>
          </div>
        </div>

        {/* Navigation items list */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="px-2 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Navigation Menu
          </div>
          {sections.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectSection(item.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-xs shadow-blue-500/20'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{item.title}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white shrink-0 ml-1">
                    {item.badge}
                  </span>
                )}
                {isActive && <ChevronRight className="w-3.5 h-3.5 shrink-0 ml-1 text-white" />}
              </button>
            );
          })}
        </div>

        {/* Footer with logout */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>End Session (Log Out)</span>
          </button>
        </div>
      </aside>
    </>
  );
};
