import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  setDoc,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { ThemeProvider } from './context/ThemeContext';
import { SchoolSettingsProvider, useSchoolSettings } from './context/SchoolSettingsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import {
  Role,
  Student,
  Teacher,
  Parent,
  TimetableSlot,
  AttendanceRecord,
  FeeRecord,
  PaymentRecord,
  ParentPaymentApproval,
  TeacherSubmission,
  ResultRecord,
  ReportCard,
  Announcement,
  Subject,
  AuditLog,
  EnrollmentHistory,
} from './types';
import { DEFAULT_SUBJECTS } from './constants/school';

// Layout & Common Components
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { getAppPath, navigateTo, parseRoute } from './utils/navigation';

// Role Views
import { AdminViews } from './components/admin/AdminViews';
import { TeacherViews } from './components/teacher/TeacherViews';
import { ParentViews } from './components/parent/ParentViews';

const AppContent: React.FC = () => {
  const { currentUser, userProfile, activeRole, loading } = useAuth();
  const { settings, currentTerm, currentYear } = useSchoolSettings();

  // Initialize route from current browser URL
  const initialRoute = parseRoute(getAppPath());
  const [selectedRoleForLogin, setSelectedRoleForLogin] = useState<Role | null>(() => {
    return initialRoute.isLogin ? initialRoute.role : null;
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentSection, setCurrentSection] = useState<string>(() => {
    return initialRoute.section || (activeRole === 'parent' ? 'home' : 'dashboard');
  });

  // Listen to browser Back/Forward (popstate) & custom app navigation events
  useEffect(() => {
    const handleUrlChange = () => {
      const route = parseRoute(getAppPath());
      if (route.isLogin) {
        setSelectedRoleForLogin(route.role);
      } else if (!route.role) {
        setSelectedRoleForLogin(null);
      }
      if (route.section) {
        setCurrentSection(route.section);
      }
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('app:navigate', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('app:navigate', handleUrlChange);
    };
  }, []);

  // Synchronize URL and currentSection whenever role changes or login occurs
  useEffect(() => {
    if (!currentUser) {
      if (selectedRoleForLogin) {
        navigateTo(`/login/${selectedRoleForLogin}`, true);
      }
      return;
    }

    if (activeRole) {
      const route = parseRoute(getAppPath());
      if (route.role === activeRole && route.section && !route.isLogin) {
        setCurrentSection(route.section);
      } else {
        const defaultSec = activeRole === 'parent' ? 'home' : 'dashboard';
        const targetSec = currentSection || defaultSec;
        setCurrentSection(targetSec);
        navigateTo(`/${activeRole}/${targetSec}`, true);
      }
    }
  }, [currentUser, activeRole]);

  // Handler for navigation with unique URL updates
  const handleSelectSection = (sec: string) => {
    setCurrentSection(sec);
    setSidebarOpen(false);
    if (activeRole) {
      navigateTo(`/${activeRole}/${sec}`);
    }
  };

  // Real-time Firestore Data Stores
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [paymentApprovals, setPaymentApprovals] = useState<ParentPaymentApproval[]>([]);
  const [teacherSubmissions, setTeacherSubmissions] = useState<TeacherSubmission[]>([]);
  const [results, setResults] = useState<ResultRecord[]>([]);
  const [reports, setReports] = useState<ReportCard[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [enrollmentHistory, setEnrollmentHistory] = useState<EnrollmentHistory[]>([]);

  // Firestore Real-time listeners - only connect when user is authenticated
  useEffect(() => {
    if (!currentUser) return;

    // 1. Students
    const unsubStudents = onSnapshot(collection(db, 'students'), snap => {
      const list: Student[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      setStudents(list);
    }, err => console.warn("Students sync:", err.message));

    // 2. Teachers
    const unsubTeachers = onSnapshot(collection(db, 'teachers'), snap => {
      const list: Teacher[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Teacher));
      setTeachers(list);
    }, err => console.warn("Teachers sync:", err.message));

    // 3. Parents
    const unsubParents = onSnapshot(collection(db, 'parents'), snap => {
      const list: Parent[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Parent));
      setParents(list);
    }, err => console.warn("Parents sync:", err.message));

    // 4. Timetable
    const unsubTimetable = onSnapshot(collection(db, 'timetable'), snap => {
      const list: TimetableSlot[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as TimetableSlot));
      setTimetable(list);
    }, err => console.warn("Timetable sync:", err.message));

    // 5. Attendance
    const unsubAttendance = onSnapshot(collection(db, 'attendance'), snap => {
      const list: AttendanceRecord[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
      setAttendance(list);
    }, err => console.warn("Attendance sync:", err.message));

    // 6. Fees
    const unsubFees = onSnapshot(collection(db, 'fees'), snap => {
      const list: FeeRecord[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as FeeRecord));
      setFees(list);
    }, err => console.warn("Fees sync:", err.message));

    // 7. Payments
    const unsubPayments = onSnapshot(collection(db, 'payments'), snap => {
      const list: PaymentRecord[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentRecord));
      setPayments(list);
    }, err => console.warn("Payments sync:", err.message));

    // 8. Payment Approvals
    const unsubApprovals = onSnapshot(collection(db, 'parentPaymentApprovals'), snap => {
      const list: ParentPaymentApproval[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as ParentPaymentApproval));
      setPaymentApprovals(list);
    }, err => console.warn("Approvals sync:", err.message));

    // 9. Teacher Submissions
    const unsubSubmissions = onSnapshot(collection(db, 'teacherSubmissions'), snap => {
      const list: TeacherSubmission[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as TeacherSubmission));
      setTeacherSubmissions(list);
    }, err => console.warn("Submissions sync:", err.message));

    // 10. Assessment Results
    const unsubResults = onSnapshot(collection(db, 'results'), snap => {
      const list: ResultRecord[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as ResultRecord));
      setResults(list);
    }, err => console.warn("Results sync:", err.message));

    // 11. Report Cards
    const unsubReports = onSnapshot(collection(db, 'reportCards'), snap => {
      const list: ReportCard[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as ReportCard));
      setReports(list);
    }, err => console.warn("Reports sync:", err.message));

    // 12. Announcements
    const unsubAnnouncements = onSnapshot(collection(db, 'announcements'), snap => {
      const list: Announcement[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement));
      setAnnouncements(list);
    }, err => console.warn("Announcements sync:", err.message));

    // 13. Subjects
    const unsubSubjects = onSnapshot(collection(db, 'subjects'), snap => {
      const list: Subject[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Subject));
      setSubjects(list.length > 0 ? list : DEFAULT_SUBJECTS);
    }, err => console.warn("Subjects sync:", err.message));

    // 14. Audit Logs
    const unsubAudit = onSnapshot(
      query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc')),
      snap => {
        const list: AuditLog[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog));
        setAuditLogs(list);
      },
      err => console.warn("AuditLogs sync:", err.message)
    );

    // 15. Enrollment History
    const unsubHistory = onSnapshot(collection(db, 'enrollmentHistory'), snap => {
      const list: EnrollmentHistory[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as EnrollmentHistory));
      setEnrollmentHistory(list);
    }, err => console.warn("History sync:", err.message));

    return () => {
      unsubStudents();
      unsubTeachers();
      unsubParents();
      unsubTimetable();
      unsubAttendance();
      unsubFees();
      unsubPayments();
      unsubApprovals();
      unsubSubmissions();
      unsubResults();
      unsubReports();
      unsubAnnouncements();
      unsubSubjects();
      unsubAudit();
      unsubHistory();
    };
  }, [currentUser]);

  // Seed default data if database is fresh (only for authenticated admin)
  useEffect(() => {
    if (!currentUser || activeRole !== 'admin') return;

    const seedDefaults = async () => {
      try {
        const subSnap = await getDocs(collection(db, 'subjects'));
        if (subSnap.empty) {
          for (const s of DEFAULT_SUBJECTS) {
            await setDoc(doc(db, 'subjects', s.id), s);
          }
        }

        const annoSnap = await getDocs(collection(db, 'announcements'));
        if (annoSnap.empty) {
          await setDoc(doc(db, 'announcements', 'welcome_notice'), {
            title: 'Welcome to Term 1 2026 Academic Session',
            message: 'All teaching staff, students, and respected parents are welcomed to the new academic term. Please ensure school fee clearances are completed through the portal.',
            audience: 'all',
            priority: 'high',
            author: 'Headteacher Administrator',
            status: 'active',
            createdAt: serverTimestamp(),
          });
        }
      } catch (e) {
        console.warn("Default seed check:", e);
      }
    };
    seedDefaults();
  }, [currentUser, activeRole]);

  const handleRefreshData = async () => {
    // onSnapshot keeps data synchronized automatically
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-400">Loading Mubende Light SSS Portal...</p>
        </div>
      </div>
    );
  }

  // If not logged in, show Landing Page or Login Page
  if (!currentUser) {
    if (selectedRoleForLogin) {
      return (
        <LoginPage
          role={selectedRoleForLogin}
          onBack={() => {
            setSelectedRoleForLogin(null);
            navigateTo('/');
          }}
          onSuccess={() => {
            setSelectedRoleForLogin(null);
          }}
        />
      );
    }
    return (
      <LandingPage
        onSelectRole={(role) => {
          setSelectedRoleForLogin(role);
          navigateTo(`/login/${role}`);
        }}
      />
    );
  }

  // Active Teacher Profile (if teacher logged in)
  const activeTeacherProfile = teachers.find(
    t => t.id === currentUser.uid || t.uid === currentUser.uid || t.email === currentUser.email
  ) || (userProfile?.role === 'teacher' ? (userProfile as unknown as Teacher) : null);

  // Active Parent Profile (if parent logged in)
  const activeParentProfile = parents.find(
    p => p.id === currentUser.uid || p.uid === currentUser.uid || p.email === currentUser.email
  ) || (userProfile?.role === 'parent' ? (userProfile as unknown as Parent) : null);

  // Counters for badge notifications
  const pendingApprovalsCount = paymentApprovals.filter(p => p.status === 'pending').length;
  const pendingSubmissionsCount = teacherSubmissions.filter(s => s.status === 'pending').length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Navigation Bar */}
      <Navbar
        onToggleSidebar={() => setSidebarOpen(prev => !prev)}
        currentSectionTitle={
          activeRole === 'admin'
            ? 'Administrator Portal'
            : activeRole === 'teacher'
            ? 'Faculty Teacher Portal'
            : 'Parent & Guardian Portal'
        }
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Responsive Drawer Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          currentSection={currentSection}
          onSelectSection={handleSelectSection}
          pendingApprovalsCount={pendingApprovalsCount}
          pendingSubmissionsCount={pendingSubmissionsCount}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 md:ml-64 pb-24 md:pb-8">
          <div className="max-w-7xl mx-auto">
            {activeRole === 'admin' ? (
              <AdminViews
                section={currentSection}
                students={students}
                teachers={teachers}
                parents={parents}
                timetable={timetable}
                attendance={attendance}
                fees={fees}
                payments={payments}
                paymentApprovals={paymentApprovals}
                teacherSubmissions={teacherSubmissions}
                enrollmentHistory={enrollmentHistory}
                results={results}
                reports={reports}
                announcements={announcements}
                subjects={subjects}
                auditLogs={auditLogs}
                settings={settings}
                onNavigate={handleSelectSection}
                onRefreshData={handleRefreshData}
              />
            ) : activeRole === 'teacher' ? (
              <TeacherViews
                section={currentSection}
                teacherProfile={activeTeacherProfile}
                students={students}
                timetable={timetable}
                subjects={subjects}
                attendance={attendance}
                results={results}
                announcements={announcements}
                onRefreshData={handleRefreshData}
              />
            ) : (
              <ParentViews
                section={currentSection}
                parentProfile={activeParentProfile}
                students={students}
                fees={fees}
                payments={payments}
                paymentApprovals={paymentApprovals}
                results={results}
                reports={reports}
                attendance={attendance}
                announcements={announcements}
                onRefreshData={handleRefreshData}
              />
            )}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Quick Navigation */}
      {activeRole && (
        <BottomNav
          role={activeRole}
          currentSection={currentSection}
          onNavigate={handleSelectSection}
          pendingApprovalsCount={pendingApprovalsCount}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <SchoolSettingsProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </SchoolSettingsProvider>
    </ThemeProvider>
  );
}
