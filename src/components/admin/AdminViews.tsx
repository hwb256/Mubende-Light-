import React, { useState } from 'react';
import {
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import {
  Users,
  GraduationCap,
  UserCheck,
  Coins,
  CheckCheck,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit,
  Check,
  X,
  Megaphone,
  School,
  Calendar,
  Award,
  AlertCircle,
  Clock,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Percent,
  TrendingUp,
  Eye,
  EyeOff,
  Copy,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { db, secondaryAuth } from '../../firebase';
import { useSchoolSettings } from '../../context/SchoolSettingsContext';
import {
  Student,
  Teacher,
  Parent,
  TimetableSlot,
  AttendanceRecord,
  FeeRecord,
  PaymentRecord,
  ParentPaymentApproval,
  ResultRecord,
  ReportCard,
  Announcement,
  Subject,
  AuditLog,
  SystemSettings,
  TeacherSubmission,
  EnrollmentHistory,
} from '../../types';
import { ALL_CLASSES, DEFAULT_SUBJECTS } from '../../constants/school';
import { getSubjectDisplayName } from '../../utils/subjectUtils';
import { CentralFeedbackModal, FeedbackState, ConfirmState } from '../common/CentralFeedbackModal';
import { formatAnnouncementDate } from '../../utils/dateUtils';

// Subcomponents
import { AdminPaymentApprovals } from './AdminPaymentApprovals';
import { AdminTeacherSubmissions } from './AdminTeacherSubmissions';
import { AdminReportCards } from './AdminReportCards';
import { AdminPromotion } from './AdminPromotion';
import { AdminSettings } from './AdminSettings';
import { AdminAcademicViews } from './AdminAcademicViews';

interface AdminViewsProps {
  section: string;
  students: Student[];
  teachers: Teacher[];
  parents: Parent[];
  timetable: TimetableSlot[];
  attendance: AttendanceRecord[];
  fees: FeeRecord[];
  payments: PaymentRecord[];
  paymentApprovals: ParentPaymentApproval[];
  teacherSubmissions?: TeacherSubmission[];
  enrollmentHistory?: EnrollmentHistory[];
  results: ResultRecord[];
  reports: ReportCard[];
  announcements: Announcement[];
  subjects: Subject[];
  auditLogs: AuditLog[];
  settings: SystemSettings;
  onNavigate: (sec: string) => void;
  onRefreshData: () => Promise<void>;
}

export const AdminViews: React.FC<AdminViewsProps> = ({
  section,
  students,
  teachers,
  parents,
  timetable,
  attendance,
  fees,
  payments,
  paymentApprovals,
  teacherSubmissions = [],
  enrollmentHistory = [],
  results,
  reports,
  announcements,
  subjects,
  auditLogs,
  settings: propSettings,
  onNavigate,
  onRefreshData,
}) => {
  const { settings, currentTerm, currentYear } = useSchoolSettings();

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');

  // Collapsible state: Collapsible by default
  const [expandedCohortGroups, setExpandedCohortGroups] = useState<Record<string, boolean>>({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  // Modals
  const [modalType, setModalType] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Central Screen Feedback & In-App Confirm Dialogs (reliable in iframe)
  const [feedback, setFeedback] = useState<FeedbackState>({ type: null });
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState | null>(null);
  const [expandedParentClasses, setExpandedParentClasses] = useState<Record<string, boolean>>({});

  const showCentralSuccess = (msg: string, title?: string) => {
    setActionSuccess(msg);
    setFeedback({
      type: 'success',
      title: title || 'Success',
      message: msg,
    });
    setTimeout(() => {
      setFeedback(prev => (prev.type === 'success' ? { type: null } : prev));
    }, 4000);
  };

  const showCentralError = (msg: string, title?: string) => {
    setActionError(msg);
    setFeedback({
      type: 'error',
      title: title || 'Action Error',
      message: msg,
    });
  };

  const requestConfirmDelete = (title: string, message: string, onConfirmAction: () => Promise<void>) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      confirmLabel: 'Yes, Delete Permanently',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        setFeedback({ type: 'loading', message: 'Deleting record from database... Please wait.' });
        try {
          await onConfirmAction();
          showCentralSuccess('Record deleted successfully from database!');
        } catch (err: any) {
          console.error("Delete failure:", err);
          showCentralError(err.message || 'Failed to delete record. Please check database connectivity.');
        }
      },
      onCancel: () => setConfirmDialog(null),
    });
  };

  // Form states
  // Student Form
  const [stuName, setStuName] = useState('');
  const [stuAdm, setStuAdm] = useState('');
  const [stuClass, setStuClass] = useState('S.1T');
  const [stuGender, setStuGender] = useState<'Male' | 'Female'>('Male');
  const [stuParentEmail, setStuParentEmail] = useState('');
  const [stuMedical, setStuMedical] = useState('');

  // Teacher Form
  const [teaName, setTeaName] = useState('');
  const [teaEmail, setTeaEmail] = useState('');
  const [teaPhone, setTeaPhone] = useState('');
  const [teaPass, setTeaPass] = useState('Teacher@123');
  const [teaSubjects, setTeaSubjects] = useState<string[]>(['Mathematics']);
  const [teaClasses, setTeaClasses] = useState<string[]>(['S.1T']);

  // Parent Form
  const [parName, setParName] = useState('');
  const [parEmail, setParEmail] = useState('');
  const [parPhone, setParPhone] = useState('');
  const [parPass, setParPass] = useState('Parent@123');
  const [parStudentIds, setParStudentIds] = useState<string[]>([]);
  const [parClassSelect, setParClassSelect] = useState<string>('');
  const [parStudentSelect, setParStudentSelect] = useState<string>('');

  // Password visibility & copying states for Admin
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedPasswordId, setCopiedPasswordId] = useState<string | null>(null);

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyPassword = async (id: string, pass: string) => {
    try {
      await navigator.clipboard.writeText(pass);
      setCopiedPasswordId(id);
      showCentralSuccess('Password copied to clipboard!');
      setTimeout(() => {
        setCopiedPasswordId(prev => (prev === id ? null : prev));
      }, 2500);
    } catch {
      showCentralError('Failed to copy password.');
    }
  };

  // Announcement Form
  const [annoTitle, setAnnoTitle] = useState('');
  const [annoMsg, setAnnoMsg] = useState('');
  const [annoAudience, setAnnoAudience] = useState<'all' | 'teachers' | 'parents' | 'students'>('all');
  const [annoPriority, setAnnoPriority] = useState<'low' | 'normal' | 'high'>('normal');

  const toggleCohortGroup = (groupName: string) => {
    setExpandedCohortGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  const toggleExpandAllCohorts = (cohortNames: string[]) => {
    const allExpanded = cohortNames.every(c => expandedCohortGroups[c]);
    const nextState: Record<string, boolean> = {};
    cohortNames.forEach(c => {
      nextState[c] = !allExpanded;
    });
    setExpandedCohortGroups(nextState);
  };

  const toggleItemExpand = (id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const notifyAudit = async (action: string, targetType: string, targetId: string) => {
    try {
      await addDoc(collection(db, 'auditLogs'), {
        action,
        actionType: action,
        targetType,
        targetId,
        performedBy: 'Headteacher Administrator',
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      console.error("Audit log error:", e);
    }
  };

  const fmtUGX = (val: number) => {
    return (val || 0).toLocaleString() + ' ' + (settings.currency || 'UGX');
  };

  // ====================================================
  // 1. ADD / EDIT STUDENT HANDLER
  // TWO-SIDED ARRAY SYNC:
  // - sets parentEmails + parentIds on student
  // - updates childIds on all matching parents (case-insensitive, trimmed email match)
  // ====================================================
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setSubmitting(true);
    setFeedback({ type: 'loading', message: 'Saving student record to database... Please wait.' });
    try {
      const cleanName = stuName.trim();
      const parentEmailsInput = stuParentEmail.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

      // Find matching parents by email (case-insensitive, trimmed)
      const matchingParentIds: string[] = [];
      parentEmailsInput.forEach(email => {
        const matched = parents.filter(p => (p.email || '').trim().toLowerCase() === email);
        matched.forEach(m => {
          const id = m.id || m.uid;
          if (id) matchingParentIds.push(id);
        });
      });
      const uniqueParentIds = Array.from(new Set(matchingParentIds));

      if (editingItem) {
        // Edit student
        const studentId = editingItem.id;
        const studentRef = doc(db, 'students', studentId);

        await setDoc(studentRef, {
          fullName: cleanName,
          admissionNumber: stuAdm.trim() || editingItem.admissionNumber,
          className: stuClass,
          gender: stuGender,
          parentEmails: parentEmailsInput,
          parentIds: uniqueParentIds,
          medicalNotes: stuMedical,
          status: 'active',
          updatedAt: serverTimestamp(),
        }, { merge: true });

        // Sync to parents: add studentId to childIds of each matching parent
        for (const pid of uniqueParentIds) {
          await setDoc(doc(db, 'parents', pid), {
            childIds: arrayUnion(studentId),
          }, { merge: true }).catch(() => {});
          await setDoc(doc(db, 'users', pid), {
            childIds: arrayUnion(studentId),
          }, { merge: true }).catch(() => {});
        }

        await notifyAudit('UPDATE_STUDENT', 'students', studentId);
        showCentralSuccess(`Student record for ${cleanName} updated successfully!`);
      } else {
        // New student
        const nextAdm = stuAdm.trim() || `MLS/${currentYear.toString().slice(-2)}/${(students.length + 101).toString()}`;
        const docRef = await addDoc(collection(db, 'students'), {
          fullName: cleanName,
          admissionNumber: nextAdm,
          className: stuClass,
          gender: stuGender,
          parentEmails: parentEmailsInput,
          parentIds: uniqueParentIds,
          medicalNotes: stuMedical,
          status: 'active',
          academicYear: currentYear,
          feeBalance: 0,
          attendanceRate: 100,
          enrolledAt: serverTimestamp(),
          registeredAt: serverTimestamp(),
        });

        const newStudentId = docRef.id;

        // Initialize fees for this term
        const feeDocId = `${newStudentId}_${currentTerm}_${currentYear}`;
        await setDoc(doc(db, 'fees', feeDocId), {
          studentId: newStudentId,
          className: stuClass,
          term: currentTerm,
          year: currentYear,
          totalFee: 1200000,
          paidAmount: 0,
          balance: 1200000,
          status: 'unpaid',
          updatedAt: serverTimestamp(),
        }, { merge: true });

        // Sync to matching parents: add studentId into matching parents' childIds
        for (const pid of uniqueParentIds) {
          await setDoc(doc(db, 'parents', pid), {
            childIds: arrayUnion(newStudentId),
          }, { merge: true }).catch(() => {});
          await setDoc(doc(db, 'users', pid), {
            childIds: arrayUnion(newStudentId),
          }, { merge: true }).catch(() => {});
        }

        await notifyAudit('CREATE_STUDENT', 'students', newStudentId);
        showCentralSuccess(`Student ${cleanName} registered successfully with ID ${nextAdm}!`);
      }

      setModalType(null);
      setEditingItem(null);
      setStuName('');
      setStuAdm('');
      setStuParentEmail('');
      setStuMedical('');
      await onRefreshData();
    } catch (err: any) {
      console.error("Save student error:", err);
      showCentralError(err.message || 'Failed to save student record.');
    } finally {
      setSubmitting(false);
    }
  };

  // ====================================================
  // 2. ADD TEACHER HANDLER (ISOLATED SECONDARY AUTH INSTANCE)
  // - calls createUserWithEmailAndPassword on secondaryAuth
  // - writes users/{uid} with full fields & lastLoginAt: null
  // - writes teachers/{uid} where doc ID = uid
  // - calls secondaryAuth.signOut() immediately after
  // ====================================================
  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    const cleanEmail = teaEmail.trim().toLowerCase();

    // Enforce password minimum 6 characters
    if (!editingItem) {
      if (!teaPass || teaPass.trim().length < 6) {
        setActionError('Password must be at least 6 characters long.');
        return;
      }
    } else {
      if (teaPass && teaPass.trim().length > 0 && teaPass.trim().length < 6) {
        setActionError('Updated password must be at least 6 characters long.');
        return;
      }
    }

    setSubmitting(true);
    setFeedback({ type: 'loading', message: 'Saving faculty teacher profile... Please wait.' });

    try {
      if (editingItem) {
        // Edit existing teacher
        const uid = editingItem.id || editingItem.uid;
        const updateData: any = {
          fullName: teaName.trim(),
          phone: teaPhone.trim(),
          subjects: teaSubjects,
          classAssignments: teaClasses,
          updatedAt: serverTimestamp(),
        };
        if (teaPass && teaPass.trim().length >= 6) {
          updateData.password = teaPass.trim();
        }

        await setDoc(doc(db, 'teachers', uid), updateData, { merge: true });
        await setDoc(doc(db, 'users', uid), updateData, { merge: true }).catch(() => {});

        await notifyAudit('UPDATE_TEACHER', 'teachers', uid);
        showCentralSuccess(`Faculty profile for ${teaName} updated successfully!`);
      } else {
        // Create teacher using isolated secondaryAuth instance
        let uid = '';
        try {
          const cred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, teaPass.trim());
          uid = cred.user.uid;
        } catch (authErr: any) {
          console.warn("Secondary auth fallback for teacher:", authErr.code, authErr.message);
          const existing = teachers.find(t => (t.email || '').toLowerCase() === cleanEmail);
          if (existing?.id || existing?.uid) {
            uid = existing.id || existing.uid!;
          } else {
            try {
              const qSnap = await getDocs(query(collection(db, 'users'), where('email', '==', cleanEmail)));
              if (!qSnap.empty) {
                uid = qSnap.docs[0].id;
              } else {
                uid = `teacher_${Date.now()}_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
              }
            } catch {
              uid = `teacher_${Date.now()}_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
            }
          }
        }

        // 1. Write users/{uid} with stored password
        await setDoc(doc(db, 'users', uid), {
          uid,
          fullName: teaName.trim(),
          email: cleanEmail,
          phone: teaPhone.trim(),
          password: teaPass.trim(),
          role: 'teacher',
          status: 'active',
          isActive: true,
          subjects: teaSubjects,
          classAssignments: teaClasses,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastLoginAt: null,
        }, { merge: true });

        // 2. Write teachers/{uid} with doc ID = uid and stored password
        await setDoc(doc(db, 'teachers', uid), {
          uid,
          teacherId: uid,
          fullName: teaName.trim(),
          email: cleanEmail,
          phone: teaPhone.trim(),
          password: teaPass.trim(),
          subjects: teaSubjects,
          classAssignments: teaClasses,
          status: 'active',
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });

        // 3. Immediately clean secondaryAuth
        try { await secondaryAuth.signOut(); } catch (_) {}

        await notifyAudit('CREATE_TEACHER', 'teachers', uid);
        showCentralSuccess(`Faculty teacher ${teaName} account provisioned! Login: ${cleanEmail}`);
      }

      setModalType(null);
      setEditingItem(null);
      setTeaName('');
      setTeaEmail('');
      setTeaPhone('');
      setTeaPass('Teacher@123');
      await onRefreshData();
    } catch (err: any) {
      console.error("Teacher creation error:", err);
      try { await secondaryAuth.signOut(); } catch (_) {}
      showCentralError(err.message || 'Failed to create faculty account.');
    } finally {
      setSubmitting(false);
    }
  };

  // ====================================================
  // 3. ADD PARENT HANDLER (ISOLATED SECONDARY AUTH + TWO-SIDED SYNC)
  // - calls createUserWithEmailAndPassword on secondaryAuth
  // - writes users/{uid} & parents/{uid} with doc ID = uid
  // - calls secondaryAuth.signOut()
  // - updates each selected student's parentIds and parentEmails via arrayUnion
  // ====================================================
  const handleAddParent = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    const cleanEmail = parEmail.trim().toLowerCase();

    // Enforce password minimum 6 characters
    if (!editingItem) {
      if (!parPass || parPass.trim().length < 6) {
        setActionError('Password must be at least 6 characters long.');
        return;
      }
    } else {
      if (parPass && parPass.trim().length > 0 && parPass.trim().length < 6) {
        setActionError('Updated password must be at least 6 characters long.');
        return;
      }
    }

    setSubmitting(true);
    setFeedback({ type: 'loading', message: 'Saving parent/guardian profile... Please wait.' });

    try {
      // Find any additional students who already have this parent's email listed
      const emailMatchedStudentIds = students
        .filter(s => (s.parentEmails || []).some(em => (em || '').trim().toLowerCase() === cleanEmail))
        .map(s => s.id);
      const finalStudentIds = Array.from(new Set([...parStudentIds, ...emailMatchedStudentIds]));

      if (editingItem) {
        // Edit existing parent
        const uid = editingItem.id || editingItem.uid;
        const updateData: any = {
          fullName: parName.trim(),
          phone: parPhone.trim(),
          childIds: finalStudentIds,
          updatedAt: serverTimestamp(),
        };
        if (parPass && parPass.trim().length >= 6) {
          updateData.password = parPass.trim();
        }

        await setDoc(doc(db, 'parents', uid), updateData, { merge: true });
        await setDoc(doc(db, 'users', uid), updateData, { merge: true }).catch(() => {});

        // Sync to students
        for (const sid of finalStudentIds) {
          await setDoc(doc(db, 'students', sid), {
            parentIds: arrayUnion(uid),
            parentEmails: arrayUnion(cleanEmail),
          }, { merge: true });
        }

        await notifyAudit('UPDATE_PARENT', 'parents', uid);
        showCentralSuccess(`Parent record for ${parName} updated and linked to students!`);
      } else {
        // Register parent using isolated secondaryAuth instance
        let uid = '';
        try {
          const cred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, parPass.trim());
          uid = cred.user.uid;
        } catch (authErr: any) {
          console.warn("Secondary auth fallback for parent:", authErr.code, authErr.message);
          const existing = parents.find(p => (p.email || '').toLowerCase() === cleanEmail);
          if (existing?.id || existing?.uid) {
            uid = existing.id || existing.uid!;
          } else {
            try {
              const qSnap = await getDocs(query(collection(db, 'users'), where('email', '==', cleanEmail)));
              if (!qSnap.empty) {
                uid = qSnap.docs[0].id;
              } else {
                uid = `parent_${Date.now()}_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
              }
            } catch {
              uid = `parent_${Date.now()}_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
            }
          }
        }

        // 1. Write users/{uid} with stored password
        await setDoc(doc(db, 'users', uid), {
          uid,
          fullName: parName.trim(),
          email: cleanEmail,
          phone: parPhone.trim(),
          password: parPass.trim(),
          role: 'parent',
          status: 'active',
          isActive: true,
          childIds: finalStudentIds,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastLoginAt: null,
        }, { merge: true });

        // 2. Write parents/{uid} with doc ID = uid and stored password
        await setDoc(doc(db, 'parents', uid), {
          uid,
          parentId: uid,
          fullName: parName.trim(),
          email: cleanEmail,
          phone: parPhone.trim(),
          password: parPass.trim(),
          childIds: finalStudentIds,
          status: 'active',
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });

        // 3. Immediately clean secondaryAuth
        try { await secondaryAuth.signOut(); } catch (_) {}

        // 4. Two-sided sync: add parent's UID and email to each selected student's arrays
        for (const sid of finalStudentIds) {
          await setDoc(doc(db, 'students', sid), {
            parentIds: arrayUnion(uid),
            parentEmails: arrayUnion(cleanEmail),
          }, { merge: true });
        }

        await notifyAudit('CREATE_PARENT', 'parents', uid);
        showCentralSuccess(`Parent guardian ${parName} account provisioned and linked to ${finalStudentIds.length} ward(s)!`);
      }

      setModalType(null);
      setEditingItem(null);
      setParName('');
      setParEmail('');
      setParPhone('');
      setParPass('Parent@123');
      setParStudentIds([]);
      setParClassSelect('');
      setParStudentSelect('');
      await onRefreshData();
    } catch (err: any) {
      console.error("Parent creation error:", err);
      try { await secondaryAuth.signOut(); } catch (_) {}
      showCentralError(err.message || 'Failed to create parent account.');
    } finally {
      setSubmitting(false);
    }
  };

  // ====================================================
  // 4. ADD ANNOUNCEMENT HANDLER
  // ====================================================
  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setSubmitting(true);
    setFeedback({ type: 'loading', message: 'Publishing broadcast announcement... Please wait.' });
    try {
      await addDoc(collection(db, 'announcements'), {
        title: annoTitle.trim(),
        message: annoMsg.trim(),
        audience: annoAudience,
        priority: annoPriority,
        author: 'Headteacher',
        status: 'active',
        createdAt: serverTimestamp(),
      });
      await notifyAudit('POST_ANNOUNCEMENT', 'announcements', annoTitle);
      showCentralSuccess('School broadcast announcement published!');
      setModalType(null);
      setAnnoTitle('');
      setAnnoMsg('');
      await onRefreshData();
    } catch (err: any) {
      console.error("Announcement error:", err);
      showCentralError(err.message || 'Failed to post announcement.');
    } finally {
      setSubmitting(false);
    }
  };

  // ====================================================
  // MODAL & FEEDBACK RENDER HELPERS
  // Scoped to render within active sections to prevent unreachable JSX
  // ====================================================
  const renderSharedModals = (extraModal?: React.ReactNode) => (
    <>
      {extraModal}
      <CentralFeedbackModal
        feedback={feedback}
        onDismissFeedback={() => setFeedback({ type: null })}
        confirmDialog={confirmDialog}
        onCloseConfirm={() => setConfirmDialog(null)}
      />
    </>
  );

  const renderStudentModal = () => {
    if (modalType !== 'addStudent') return null;
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-blue-500" />
              {editingItem ? 'Edit Student Record' : 'Enroll New Student'}
            </h3>
            <button type="button" onClick={() => setModalType(null)} className="text-slate-500 p-1 cursor-pointer"><X className="w-5 h-5" /></button>
          </div>

          {actionError && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
              {actionError}
            </div>
          )}

          <form onSubmit={handleSaveStudent} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold mb-1">Full Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Kato Jonathan"
                value={stuName}
                onChange={(e) => setStuName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Admission No.</label>
                <input
                  type="text"
                  placeholder="Auto-generated if blank"
                  value={stuAdm}
                  onChange={(e) => setStuAdm(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Gender</label>
                <select
                  value={stuGender}
                  onChange={(e) => setStuGender(e.target.value as 'Male' | 'Female')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium cursor-pointer"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">Class Stream</label>
              <select
                value={stuClass}
                onChange={(e) => setStuClass(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold cursor-pointer"
              >
                {ALL_CLASSES.map(c => <option key={c.display} value={c.display}>{c.display} ({c.type})</option>)}
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1">Parent Email(s) (comma separated)</label>
              <input
                type="text"
                placeholder="parent@mubendelight.sc.ug"
                value={stuParentEmail}
                onChange={(e) => setStuParentEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
              <small className="text-slate-400 text-[10px] mt-0.5 block">
                Automatically syncs bidirectional linkage with matching parent account.
              </small>
            </div>

            <div>
              <label className="block font-semibold mb-1">Medical / Guardian Notes (Optional)</label>
              <input
                type="text"
                placeholder="Optional medical notes..."
                value={stuMedical}
                onChange={(e) => setStuMedical(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-md disabled:opacity-50"
              >
                {submitting ? 'Saving...' : editingItem ? 'Update Student' : 'Enroll Student'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderTeacherModal = () => {
    if (modalType !== 'addTeacher') return null;
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-500" />
              {editingItem ? 'Edit Faculty Record' : 'Provision Faculty Staff'}
            </h3>
            <button type="button" onClick={() => setModalType(null)} className="text-slate-500 p-1 cursor-pointer"><X className="w-5 h-5" /></button>
          </div>

          {actionError && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
              {actionError}
            </div>
          )}

          <form onSubmit={handleAddTeacher} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold mb-1">Full Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Mr. Musisi Robert"
                value={teaName}
                onChange={(e) => setTeaName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Official Email</label>
              <input
                type="email"
                required
                disabled={!!editingItem}
                placeholder="teacher@mubendelight.sc.ug"
                value={teaEmail}
                onChange={(e) => setTeaEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs disabled:opacity-60"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Phone Contact</label>
                <input
                  type="tel"
                  placeholder="e.g. 0770000000"
                  value={teaPhone}
                  onChange={(e) => setTeaPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  {editingItem ? 'Password (leave blank to keep current)' : 'Password'}
                </label>
                <input
                  type="text"
                  required={!editingItem}
                  minLength={6}
                  placeholder={editingItem ? 'Enter new password (optional)' : 'Min 6 characters'}
                  value={teaPass}
                  onChange={(e) => setTeaPass(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Min 6 characters. Stored in database &amp; viewable by Admin.
                </span>
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">Specialized Subjects</label>
              <div className="space-y-2">
                <select
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val && !teaSubjects.includes(val)) {
                      setTeaSubjects(prev => [...prev, val]);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold cursor-pointer"
                >
                  <option value="">+ Select Subject from dropdown...</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.name} disabled={teaSubjects.includes(s.name)}>
                      {s.name} ({s.category}) {teaSubjects.includes(s.name) ? '— Already Added' : ''}
                    </option>
                  ))}
                </select>

                <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
                  {teaSubjects.length === 0 ? (
                    <span className="text-[11px] text-slate-400 italic">No subjects added yet. Choose from the dropdown above.</span>
                  ) : (
                    teaSubjects.map(sub => (
                      <span
                        key={sub}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                      >
                        {sub}
                        <button
                          type="button"
                          onClick={() => setTeaSubjects(teaSubjects.filter(s => s !== sub))}
                          className="hover:text-rose-500 text-slate-400 font-bold ml-1 cursor-pointer"
                          title="Remove subject"
                        >
                          &times;
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">Teaching Classes</label>
              <div className="space-y-2">
                <select
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val && !teaClasses.includes(val)) {
                      setTeaClasses(prev => [...prev, val]);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold cursor-pointer"
                >
                  <option value="">+ Select Class Stream from dropdown...</option>
                  {ALL_CLASSES.map(c => (
                    <option key={c.display} value={c.display} disabled={teaClasses.includes(c.display)}>
                      {c.display} ({c.type}) {teaClasses.includes(c.display) ? '— Already Added' : ''}
                    </option>
                  ))}
                </select>

                <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
                  {teaClasses.length === 0 ? (
                    <span className="text-[11px] text-slate-400 italic">No classes assigned yet. Choose from the dropdown above.</span>
                  ) : (
                    teaClasses.map(cls => (
                      <span
                        key={cls}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20"
                      >
                        {cls}
                        <button
                          type="button"
                          onClick={() => setTeaClasses(teaClasses.filter(c => c !== cls))}
                          className="hover:text-rose-500 text-slate-400 font-bold ml-1 cursor-pointer"
                          title="Remove class"
                        >
                          &times;
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-md disabled:opacity-50"
              >
                {submitting ? 'Saving...' : editingItem ? 'Update Faculty' : 'Provision Staff'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderParentModal = () => {
    if (modalType !== 'addParent') return null;
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-amber-500" />
              {editingItem ? 'Edit Parent Record' : 'Provision Parent Account'}
            </h3>
            <button type="button" onClick={() => setModalType(null)} className="text-slate-500 p-1 cursor-pointer"><X className="w-5 h-5" /></button>
          </div>

          {actionError && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
              {actionError}
            </div>
          )}

          <form onSubmit={handleAddParent} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold mb-1">Parent / Guardian Full Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Mrs. Nalubega Sarah"
                value={parName}
                onChange={(e) => setParName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Login Email Address</label>
              <input
                type="email"
                required
                disabled={!!editingItem}
                placeholder="parent@mubendelight.sc.ug"
                value={parEmail}
                onChange={(e) => setParEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs disabled:opacity-60"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. 0770000000"
                  value={parPhone}
                  onChange={(e) => setParPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  {editingItem ? 'Password (leave blank to keep current)' : 'Password'}
                </label>
                <input
                  type="text"
                  required={!editingItem}
                  minLength={6}
                  placeholder={editingItem ? 'Enter new password (optional)' : 'Min 6 characters'}
                  value={parPass}
                  onChange={(e) => setParPass(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Min 6 characters. Stored in database &amp; viewable by Admin.
                </span>
              </div>
            </div>

            {/* Enrolled Students Selection Flow */}
            <div className="space-y-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
              <label className="block font-semibold text-slate-900 dark:text-white">
                Link Enrolled Student Wards
              </label>

              {/* Class Dropdown */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  1. Select Class Stream
                </label>
                <select
                  value={parClassSelect}
                  onChange={(e) => {
                    setParClassSelect(e.target.value);
                    setParStudentSelect('');
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold cursor-pointer"
                >
                  <option value="">-- Choose Class Stream --</option>
                  {ALL_CLASSES.map(c => (
                    <option key={c.display} value={c.display}>
                      {c.display} ({c.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Students in Selected Class Dropdown */}
              {parClassSelect && (
                <div className="space-y-1 pt-1">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    2. Select Enrolled Student in {parClassSelect}
                  </label>
                  <select
                    value={parStudentSelect}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setParStudentSelect(selectedId);
                      if (selectedId && !parStudentIds.includes(selectedId)) {
                        setParStudentIds(prev => [...prev, selectedId]);
                      }
                      setParStudentSelect('');
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium cursor-pointer"
                  >
                    <option value="">-- Choose student to link --</option>
                    {students
                      .filter(s => s.className === parClassSelect && s.status === 'active')
                      .map(s => (
                        <option
                          key={s.id}
                          value={s.id}
                          disabled={parStudentIds.includes(s.id)}
                        >
                          {s.fullName} ({s.admissionNumber}) {parStudentIds.includes(s.id) ? '— Already Added' : ''}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Linked Wards List with Remove button and Option to Add More */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    Linked Wards ({parStudentIds.length}):
                  </span>
                  {parStudentIds.length > 0 && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                      Select another class above to add more
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {parStudentIds.length === 0 ? (
                    <div className="text-[11px] text-slate-400 italic p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                      No student wards linked yet. Select a class stream above to pick a student.
                    </div>
                  ) : (
                    parStudentIds.map(sid => {
                      const st = students.find(s => s.id === sid);
                      return (
                        <div
                          key={sid}
                          className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {st?.fullName || 'Student'}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {st?.className || '—'} &bull; {st?.admissionNumber || '—'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setParStudentIds(parStudentIds.filter(id => id !== sid))}
                            className="px-2 py-0.5 rounded text-[11px] font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            title="Remove student ward"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-md disabled:opacity-50"
              >
                {submitting ? 'Saving...' : editingItem ? 'Update Parent' : 'Provision Parent Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderAnnouncementModal = () => {
    if (modalType !== 'addAnnouncement') return null;
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-amber-500" />
              Create Broadcast Announcement
            </h3>
            <button type="button" onClick={() => setModalType(null)} className="text-slate-500 p-1 cursor-pointer"><X className="w-5 h-5" /></button>
          </div>

          {actionError && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
              {actionError}
            </div>
          )}

          <form onSubmit={handleAddAnnouncement} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold mb-1">Circular Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Term 1 Mid-Term Evaluations Notice"
                value={annoTitle}
                onChange={(e) => setAnnoTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Broadcast Message</label>
              <textarea
                rows={4}
                required
                placeholder="Enter notice details for parents, teachers, and school community..."
                value={annoMsg}
                onChange={(e) => setAnnoMsg(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Target Audience</label>
                <select
                  value={annoAudience}
                  onChange={(e) => setAnnoAudience(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                >
                  <option value="all">Entire School</option>
                  <option value="parents">Parents Only</option>
                  <option value="teachers">Teachers Only</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Priority</label>
                <select
                  value={annoPriority}
                  onChange={(e) => setAnnoPriority(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-md disabled:opacity-50"
              >
                {submitting ? 'Publishing...' : 'Publish Broadcast'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // ====================================================
  // DELEGATE TO SPECIALIZED VIEWS
  // ====================================================
  if (section === 'paymentapprovals' || section === 'approvals') {
    return (
      <AdminPaymentApprovals
        paymentApprovals={paymentApprovals}
        fees={fees}
        students={students}
        onRefreshData={onRefreshData}
        notifyAudit={notifyAudit}
        onRequestConfirm={requestConfirmDelete}
      />
    );
  }

  if (section === 'submissions') {
    return (
      <AdminTeacherSubmissions
        submissions={teacherSubmissions}
        results={results}
        onRefreshData={onRefreshData}
        notifyAudit={notifyAudit}
      />
    );
  }

  if (section === 'reports') {
    return (
      <AdminReportCards
        students={students}
        results={results}
        reports={reports}
        onRefreshData={onRefreshData}
        notifyAudit={notifyAudit}
      />
    );
  }

  if (section === 'promotion' || section === 'pastyears') {
    return (
      <AdminPromotion
        section={section as any}
        students={students}
        enrollmentHistory={enrollmentHistory}
        reports={reports}
        fees={fees}
        onRefreshData={onRefreshData}
        notifyAudit={notifyAudit}
      />
    );
  }

  if (section === 'settings') {
    return <AdminSettings notifyAudit={notifyAudit} />;
  }

  if (
    section === 'classes' ||
    section === 'subjects' ||
    section === 'timetable' ||
    section === 'attendance' ||
    section === 'results' ||
    section === 'payments'
  ) {
    return (
      <AdminAcademicViews
        section={section as any}
        students={students}
        teachers={teachers}
        subjects={subjects}
        timetable={timetable}
        attendance={attendance}
        results={results}
        payments={payments}
        onNavigate={onNavigate}
        onRefreshData={onRefreshData}
        onRequestConfirm={requestConfirmDelete}
        onShowFeedback={showCentralSuccess}
      />
    );
  }

  // ====================================================
  // 5. RESTORED ORIGINAL DASHBOARD VIEW
  // As requested:
  // - 6 key stats: Total Students, Active Teachers, Linked Parents,
  //   Outstanding Arrears Rate (%), Collected Fees (UGX), Pending Payment Approvals
  // - 2 charts: Fee Collection Status (Doughnut: Collected vs Arrears),
  //   Attendance Trends (Bar: Present, Absent, Late)
  // - Recent School Broadcasts card with Manage All
  // - Audit logs removed from default dashboard!
  // ====================================================
  if (section === 'dashboard') {
    let totalBilled = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    fees.forEach(f => {
      totalBilled += Number(f.totalFee || 0);
      totalPaid += Number(f.paidAmount || 0);
      totalOutstanding += Number(f.balance || (Number(f.totalFee || 0) - Number(f.paidAmount || 0)));
    });

    const arrearsRate = totalBilled > 0 ? Math.round((totalOutstanding / totalBilled) * 100) : 0;
    const activeStudentsCount = students.filter(s => s.status === 'active').length;
    const activeTeachersCount = teachers.filter(t => t.status === 'active').length;
    const activeParentsCount = parents.filter(p => p.status === 'active' || p.isActive !== false).length;
    const pendingApprovalsCount = paymentApprovals.filter(p => p.status === 'pending').length;

    // Fee Chart Data
    const feeChartData = [
      { name: 'Collected', value: totalPaid > 0 ? totalPaid : 1, color: '#10b981' },
      { name: 'Arrears', value: totalOutstanding > 0 ? totalOutstanding : 0, color: '#ef4444' },
    ];

    // Attendance Trends Data
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    attendance.forEach(a => {
      if (a.status === 'present') presentCount++;
      else if (a.status === 'absent') absentCount++;
      else if (a.status === 'late') lateCount++;
    });

    const attTrendsData = [
      { name: 'Present', count: presentCount, fill: '#10b981' },
      { name: 'Absent', count: absentCount, fill: '#ef4444' },
      { name: 'Late', count: lateCount, fill: '#f59e0b' },
    ];

    return (
      <div className="space-y-6">
        {/* System Analytics Dashboard Header */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  System Analytics Dashboard
                </h2>
                <p className="text-[11px] text-slate-500">
                  Real-time synchronization across Mubende Light SSS
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setEditingItem(null);
                  setModalType('addStudent');
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> + Add Student
              </button>
              <button
                onClick={() => onNavigate('paymentapprovals')}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5" /> Approvals ({pendingApprovalsCount})
              </button>
            </div>
          </div>

          {/* 6 Metric Stat Cards Matching Original File */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {/* 1. Total Students */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex justify-between items-center hover:border-blue-500/50 transition-colors">
              <div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">{activeStudentsCount}</div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5">
                  Total Students
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
                <GraduationCap className="w-6 h-6" />
              </div>
            </div>

            {/* 2. Active Teachers */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex justify-between items-center hover:border-emerald-500/50 transition-colors">
              <div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">{activeTeachersCount}</div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5">
                  Active Teachers
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
                <Users className="w-6 h-6" />
              </div>
            </div>

            {/* 3. Linked Parents */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex justify-between items-center hover:border-blue-500/50 transition-colors">
              <div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">{activeParentsCount}</div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5">
                  Linked Parents
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
                <UserCheck className="w-6 h-6" />
              </div>
            </div>

            {/* 4. Outstanding Arrears Rate */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex justify-between items-center hover:border-rose-500/50 transition-colors">
              <div>
                <div className="text-2xl font-black text-rose-500">{arrearsRate}%</div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5">
                  Outstanding Arrears Rate
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500">
                <Percent className="w-6 h-6" />
              </div>
            </div>

            {/* 5. Collected Fees (UGX) */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex justify-between items-center hover:border-emerald-500/50 transition-colors">
              <div>
                <div className="text-xl font-black text-emerald-500 truncate">{fmtUGX(totalPaid)}</div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5">
                  Collected Fees (UGX)
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
                <Coins className="w-6 h-6" />
              </div>
            </div>

            {/* 6. Pending Payment Approvals */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex justify-between items-center hover:border-amber-500/50 transition-colors">
              <div>
                <div className="text-2xl font-black text-amber-500">{pendingApprovalsCount}</div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5">
                  Pending Payment Approvals
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
                <Clock className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>

        {/* 2 Graphs as in the Original File */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fee Collection Status */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-500" />
              Fee Collection Status
            </h3>
            <p className="text-[11px] text-slate-400 mb-3">Total Target: {fmtUGX(totalBilled)}</p>
            <div className="h-60 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={feeChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {feeChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => fmtUGX(Number(value))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Attendance Trends */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              Attendance Trends
            </h3>
            <p className="text-[11px] text-slate-400 mb-3">Overall recorded lesson attendance incidences</p>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attTrendsData}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {attTrendsData.map((entry, index) => (
                      <Cell key={`cell-bar-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent School Broadcasts with Manage All button */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-amber-500" />
              Recent School Broadcasts
            </h3>
            <button
              onClick={() => onNavigate('announcements')}
              className="px-3 py-1 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer"
            >
              Manage All
            </button>
          </div>

          <div className="space-y-2.5">
            {announcements.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4 italic">No broadcasts published yet.</p>
            ) : (
              announcements.slice(0, 3).map(a => (
                <div key={a.id} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 dark:text-white">{a.title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${a.priority === 'high' ? 'bg-rose-500/10 text-rose-600' : 'bg-blue-500/10 text-blue-600'}`}>
                      {a.priority || 'Normal'}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 line-clamp-2">{a.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
        {renderSharedModals()}
      </div>
    );
  }

  // ====================================================
  // 6. STUDENTS REGISTRY (Clean Table View)
  // ====================================================
  if (section === 'students') {
    const filteredStudents = students
      .filter(s => {
        const matchClass = classFilter === 'ALL' || s.className === classFilter;
        const matchSearch = searchTerm === '' ||
          s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase());
        return matchClass && matchSearch;
      })
      .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Student Information System &amp; Admissions
            </h2>
            <p className="text-[11px] text-slate-500">
              Total {students.length} registered students &bull; Showing {filteredStudents.length}
            </p>
          </div>
          <button
            onClick={() => {
              setEditingItem(null);
              setStuName('');
              setStuAdm('');
              setStuParentEmail('');
              setStuMedical('');
              setModalType('addStudent');
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" /> + Add New Student
          </button>
        </div>

        {actionSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {actionError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Filter Controls & Expand All */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap gap-3 items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by Name or Admission No..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-xs outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold cursor-pointer text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Streams</option>
              {ALL_CLASSES.map(c => <option key={c.display} value={c.display}>{c.display}</option>)}
            </select>
            {filteredStudents.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const allExpanded = filteredStudents.every(s => expandedItems[s.id]);
                  const next: Record<string, boolean> = {};
                  filteredStudents.forEach(s => { next[s.id] = !allExpanded; });
                  setExpandedItems(next);
                }}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                {filteredStudents.every(s => expandedItems[s.id]) ? 'Collapse All' : 'Expand All'}
              </button>
            )}
          </div>
        </div>

        {/* Vertical Foldable Students Cards */}
        <div className="space-y-3">
          {filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-slate-400 italic rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
              No students found matching your criteria.
            </div>
          ) : (
            filteredStudents.map(s => {
              const isExpanded = !!expandedItems[s.id];
              return (
                <div
                  key={s.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-colors"
                >
                  <div
                    onClick={() => toggleItemExpand(s.id)}
                    className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-xs shrink-0">
                        {s.fullName?.charAt(0) || 'S'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                            {s.fullName}
                          </h4>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            {s.className}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          Adm: {s.admissionNumber}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${s.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-500/10 text-slate-500'}`}>
                        {s.status}
                      </span>
                      <button
                        type="button"
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        title={isExpanded ? "Collapse" : "Expand"}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 text-xs space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 block">Student Full Name:</span>
                          <span className="font-bold text-slate-900 dark:text-white">{s.fullName}</span>
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 block">Admission Number:</span>
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{s.admissionNumber}</span>
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 block">Class Stream:</span>
                          <span className="font-semibold">{s.className}</span>
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 block">Gender:</span>
                          <span className="capitalize">{s.gender || 'Not recorded'}</span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-[11px] font-bold text-slate-400 block">Linked Parent Email(s):</span>
                          <span className="font-mono text-slate-600 dark:text-slate-300">
                            {s.parentEmails?.length ? s.parentEmails.join(', ') : 'No parent linked'}
                          </span>
                        </div>
                        {s.medicalNotes && (
                          <div className="sm:col-span-2">
                            <span className="text-[11px] font-bold text-slate-400 block">Medical / Health Notes:</span>
                            <span className="italic">{s.medicalNotes}</span>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingItem(s);
                            setStuName(s.fullName);
                            setStuAdm(s.admissionNumber);
                            setStuClass(s.className);
                            setStuGender(s.gender);
                            setStuParentEmail((s.parentEmails || []).join(', '));
                            setStuMedical(s.medicalNotes || '');
                            setModalType('addStudent');
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-semibold text-xs cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" /> Edit Record
                        </button>
                        <button
                          onClick={() => {
                            requestConfirmDelete(
                              'Delete Student Record',
                              `Are you sure you want to permanently delete student ${s.fullName} (${s.admissionNumber})? This will remove their profile and cannot be undone.`,
                              async () => {
                                await deleteDoc(doc(db, 'students', s.id));
                                await notifyAudit('DELETE_STUDENT', 'students', s.id);
                                await onRefreshData();
                              }
                            );
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors font-semibold text-xs cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        {renderSharedModals(renderStudentModal())}
      </div>
    );
  }

  // ====================================================
  // 7. TEACHERS REGISTRY (Restored Clean Table Layout)
  // ====================================================
  if (section === 'teachers') {
    const filteredTeachers = teachers
      .filter(t => {
        return searchTerm === '' ||
          t.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.email.toLowerCase().includes(searchTerm.toLowerCase());
      })
      .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Faculty &amp; Teaching Staff Directory
            </h2>
            <p className="text-[11px] text-slate-500">
              Total {teachers.length} faculty instructors &bull; Showing {filteredTeachers.length}
            </p>
          </div>
          <button
            onClick={() => {
              setEditingItem(null);
              setTeaName('');
              setTeaEmail('');
              setTeaPhone('');
              setTeaPass('Teacher@123');
              setModalType('addTeacher');
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" /> + Add New Teacher
          </button>
        </div>

        {actionSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {actionError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Search & Expand All */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap gap-3 items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search teacher by name, email, or specialization..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-xs outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>
          {filteredTeachers.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const allExpanded = filteredTeachers.every(t => expandedItems[t.id]);
                const next: Record<string, boolean> = {};
                filteredTeachers.forEach(t => { next[t.id] = !allExpanded; });
                setExpandedItems(next);
              }}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              {filteredTeachers.every(t => expandedItems[t.id]) ? 'Collapse All' : 'Expand All'}
            </button>
          )}
        </div>

        {/* Vertical Foldable Teachers Cards */}
        <div className="space-y-3">
          {filteredTeachers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 italic rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
              No faculty staff members found.
            </div>
          ) : (
            filteredTeachers.map(t => {
              const isExpanded = !!expandedItems[t.id];
              return (
                <div
                  key={t.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-colors"
                >
                  <div
                    onClick={() => toggleItemExpand(t.id)}
                    className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-xs shrink-0">
                        {t.fullName?.charAt(0) || 'T'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                          {t.fullName}
                        </h4>
                        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                          {t.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${t.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-500/10 text-slate-500'}`}>
                        {t.status}
                      </span>
                      <button
                        type="button"
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        title={isExpanded ? "Collapse" : "Expand"}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 text-xs space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 block">Staff Full Name:</span>
                          <span className="font-bold text-slate-900 dark:text-white">{t.fullName}</span>
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 block">Official Login Email:</span>
                          <span className="font-mono text-slate-700 dark:text-slate-200">{t.email}</span>
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 block">Phone Contact:</span>
                          <span>{t.phone || 'Not provided'}</span>
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 block">Account Status:</span>
                          <span className="capitalize">{t.status}</span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-[11px] font-bold text-slate-400 block mb-1">Faculty Password:</span>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                              {visiblePasswords[t.id] ? (t.password || 'Teacher@123') : '••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePasswordVisibility(t.id);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-medium cursor-pointer"
                              title={visiblePasswords[t.id] ? "Hide password" : "Show password"}
                            >
                              {visiblePasswords[t.id] ? (
                                <>
                                  <EyeOff className="w-3.5 h-3.5 text-slate-500" /> Hide
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3.5 h-3.5 text-slate-500" /> View
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyPassword(t.id, t.password || 'Teacher@123');
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 text-[11px] font-medium cursor-pointer"
                              title="Copy password to clipboard"
                            >
                              <Copy className="w-3.5 h-3.5" /> Copy Password
                            </button>
                            {copiedPasswordId === t.id && (
                              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold animate-pulse">
                                Copied to clipboard!
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-[11px] font-bold text-slate-400 block mb-1">Subjects Taught:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {t.subjects?.length ? (
                              t.subjects.map(s => (
                                <span key={s} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                                  {getSubjectDisplayName(s, subjects)}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 italic">None assigned</span>
                            )}
                          </div>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-[11px] font-bold text-slate-400 block mb-1">Assigned Classes / Streams:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {t.classAssignments?.length ? (
                              t.classAssignments.map(c => (
                                <span key={c} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                                  {c}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 italic">No classes assigned</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingItem(t);
                            setTeaName(t.fullName);
                            setTeaEmail(t.email);
                            setTeaPhone(t.phone || '');
                            setTeaPass(t.password || '');
                            setTeaSubjects((t.subjects || []).map(s => getSubjectDisplayName(s, subjects)));
                            setTeaClasses(t.classAssignments || []);
                            setModalType('addTeacher');
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-semibold text-xs cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" /> Edit Staff Member
                        </button>
                        <button
                          onClick={() => {
                            requestConfirmDelete(
                              'Delete Faculty Staff Member',
                              `Are you sure you want to delete instructor ${t.fullName}? This will remove their faculty credentials and cannot be undone.`,
                              async () => {
                                await deleteDoc(doc(db, 'teachers', t.id));
                                await notifyAudit('DELETE_TEACHER', 'teachers', t.id);
                                await onRefreshData();
                              }
                            );
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors font-semibold text-xs cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        {renderSharedModals(renderTeacherModal())}
      </div>
    );
  }

  // ====================================================
  // 8. PARENTS & GUARDIANS (Restored Clean Table Layout)
  // Two-Sided Array Sync
  // ====================================================
  if (section === 'parents') {
    const matchingParents = parents.filter(p => {
      return searchTerm === '' ||
        p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.phone || '').toLowerCase().includes(searchTerm.toLowerCase());
    });

    // Categorize parents by their children's classes
    const classToParentsMap: Record<string, Parent[]> = {};
    const unassignedParents: Parent[] = [];

    matchingParents.forEach(p => {
      const wards = students.filter(
        s => (p.childIds || []).includes(s.id) ||
             (s.parentIds || []).includes(p.id || p.uid!) ||
             (s.parentEmails || []).some(e => e.trim().toLowerCase() === (p.email || '').trim().toLowerCase())
      );

      if (wards.length === 0) {
        unassignedParents.push(p);
      } else {
        const classesForParent = Array.from(new Set(wards.map(w => w.className).filter(Boolean)));
        if (classesForParent.length === 0) {
          unassignedParents.push(p);
        } else {
          classesForParent.forEach(className => {
            if (!classToParentsMap[className]) {
              classToParentsMap[className] = [];
            }
            if (!classToParentsMap[className].some(existing => existing.id === p.id)) {
              classToParentsMap[className].push(p);
            }
          });
        }
      }
    });

    // Enforce alphabetical order inside each class cohort list
    Object.keys(classToParentsMap).forEach(cName => {
      classToParentsMap[cName].sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
    });
    unassignedParents.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));

    const activeClasses = ALL_CLASSES.filter(c => (classToParentsMap[c.display] || []).length > 0).map(c => c.display);
    const extraClasses = Object.keys(classToParentsMap)
      .filter(cName => !activeClasses.includes(cName) && (classToParentsMap[cName] || []).length > 0)
      .sort();
    const allClassesWithParents = [...activeClasses, ...extraClasses];

    const renderParentCard = (p: Parent) => {
      const isExpanded = !!expandedItems[p.id];
      const wards = students.filter(
        s => (p.childIds || []).includes(s.id) ||
             (s.parentIds || []).includes(p.id || p.uid!) ||
             (s.parentEmails || []).some(e => e.trim().toLowerCase() === (p.email || '').trim().toLowerCase())
      );

      return (
        <div
          key={p.id}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-colors"
        >
          <div
            onClick={() => toggleItemExpand(p.id)}
            className="p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center text-xs shrink-0">
                {p.fullName?.charAt(0) || 'P'}
              </div>
              <div className="min-w-0">
                <h4 className="font-extrabold text-xs md:text-sm text-slate-900 dark:text-white truncate">
                  {p.fullName}
                </h4>
                <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                  {p.email} &bull; {wards.length} Ward{wards.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${p.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-500/10 text-slate-500'}`}>
                {p.status || 'active'}
              </span>
              <button
                type="button"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {isExpanded && (
            <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 text-xs space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block">Guardian Full Name:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{p.fullName}</span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block">Login / Contact Email:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-200">{p.email}</span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block">Phone Number:</span>
                  <span>{p.phone || 'Not provided'}</span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block">Status:</span>
                  <span className="capitalize">{p.status || 'active'}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">Parent Password:</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                      {visiblePasswords[p.id] ? (p.password || 'Parent@123') : '••••••••'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePasswordVisibility(p.id);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-medium cursor-pointer"
                      title={visiblePasswords[p.id] ? "Hide password" : "Show password"}
                    >
                      {visiblePasswords[p.id] ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-slate-500" /> Hide
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5 text-slate-500" /> View
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyPassword(p.id, p.password || 'Parent@123');
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 text-[11px] font-medium cursor-pointer"
                      title="Copy password to clipboard"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy Password
                    </button>
                    {copiedPasswordId === p.id && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold animate-pulse">
                        Copied to clipboard!
                      </span>
                    )}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">Associated Wards:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {wards.length > 0 ? (
                      wards.map(w => (
                        <span key={w.id} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                          {w.fullName} &bull; Adm: {w.admissionNumber} ({w.className})
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic">No student ward linked yet</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setEditingItem(p);
                    setParName(p.fullName);
                    setParEmail(p.email);
                    setParPhone(p.phone || '');
                    setParPass(p.password || '');
                    setParStudentIds(p.childIds || []);
                    setParClassSelect('');
                    setParStudentSelect('');
                    setModalType('addParent');
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-semibold text-xs cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" /> Edit Guardian
                </button>
                <button
                  onClick={() => {
                    requestConfirmDelete(
                      'Delete Parent Guardian',
                      `Are you sure you want to permanently delete parent record for ${p.fullName}? This cannot be undone.`,
                      async () => {
                        await deleteDoc(doc(db, 'parents', p.id));
                        await notifyAudit('DELETE_PARENT', 'parents', p.id);
                        await onRefreshData();
                      }
                    );
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors font-semibold text-xs cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Parents &amp; Guardians Registry (Categorized by Class)
            </h2>
            <p className="text-[11px] text-slate-500">
              Total {parents.length} registered guardians &bull; Organized by child class stream in alphabetical order
            </p>
          </div>
          <button
            onClick={() => {
              setEditingItem(null);
              setParName('');
              setParEmail('');
              setParPhone('');
              setParPass('Parent@123');
              setParStudentIds([]);
              setModalType('addParent');
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-amber-600 hover:bg-amber-700 text-white transition-all cursor-pointer shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" /> + Add New Parent
          </button>
        </div>

        {actionSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {actionError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Search & Collapse All Controls */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap gap-3 items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search parent name, email, or ward..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-xs outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const nextState: Record<string, boolean> = {};
                const willExpand = !allClassesWithParents.every(c => expandedParentClasses[c]);
                allClassesWithParents.forEach(c => { nextState[c] = willExpand; });
                nextState['__unassigned__'] = willExpand;
                setExpandedParentClasses(nextState);
              }}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              {allClassesWithParents.every(c => expandedParentClasses[c]) ? 'Collapse All Classes' : 'Expand All Classes'}
            </button>
          </div>
        </div>

        {/* Categorized Class Lists */}
        {matchingParents.length === 0 ? (
          <div className="p-8 text-center text-slate-400 italic rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
            No parents or guardians matching search criteria.
          </div>
        ) : (
          <div className="space-y-4">
            {allClassesWithParents.map(className => {
              const list = classToParentsMap[className] || [];
              if (list.length === 0) return null;
              const isClassExpanded = expandedParentClasses[className] !== false; // expanded by default

              return (
                <div
                  key={className}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 shadow-xs overflow-hidden"
                >
                  <div
                    onClick={() => setExpandedParentClasses(prev => ({ ...prev, [className]: !isClassExpanded }))}
                    className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                          Class Stream: {className}
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          {list.length} Parent{list.length === 1 ? '' : 's'} registered for this stream &bull; Alphabetical order (A-Z)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        {list.length} Guardian{list.length === 1 ? '' : 's'}
                      </span>
                      {isClassExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>

                  {isClassExpanded && (
                    <div className="p-3 space-y-2.5">
                      {list.map(p => renderParentCard(p))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Unassigned or No Linked Class Section */}
            {unassignedParents.length > 0 && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 shadow-xs overflow-hidden">
                <div
                  onClick={() => setExpandedParentClasses(prev => ({ ...prev, '__unassigned__': !prev['__unassigned__'] }))}
                  className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                        Unassigned / General Guardians (No Linked Class)
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        {unassignedParents.length} Guardian{unassignedParents.length === 1 ? '' : 's'} &bull; Alphabetical order (A-Z)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      {unassignedParents.length}
                    </span>
                    {expandedParentClasses['__unassigned__'] !== false ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>

                {expandedParentClasses['__unassigned__'] !== false && (
                  <div className="p-3 space-y-2.5">
                    {unassignedParents.map(p => renderParentCard(p))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {renderSharedModals(renderParentModal())}
      </div>
    );
  }

  // ====================================================
  // 9. FEES LEDGER (Vertical Foldable Layout)
  // ====================================================
  if (section === 'fees') {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              School Fees Accounts &amp; Ledgers
            </h2>
            <p className="text-[11px] text-slate-500">
              Audit tuition billings, payments, and arrears balances across all students.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {fees.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const allExpanded = fees.every(f => expandedItems[f.id || f.studentId]);
                  const next: Record<string, boolean> = {};
                  fees.forEach(f => { next[f.id || f.studentId] = !allExpanded; });
                  setExpandedItems(next);
                }}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                {fees.every(f => expandedItems[f.id || f.studentId]) ? 'Collapse All' : 'Expand All'}
              </button>
            )}
            <button
              onClick={() => onNavigate('paymentapprovals')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-xs"
            >
              <CheckCheck className="w-4 h-4" /> Reconcile Payments
            </button>
          </div>
        </div>

        {/* Fees Foldable Cards */}
        <div className="space-y-3">
          {fees.length === 0 ? (
            <div className="p-8 text-center text-slate-400 italic rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
              No fee billing records available.
            </div>
          ) : (
            fees.map(f => {
              const stu = students.find(s => s.id === f.studentId);
              const feeId = f.id || f.studentId;
              const isExpanded = !!expandedItems[feeId];

              return (
                <div
                  key={feeId}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-colors"
                >
                  <div
                    onClick={() => toggleItemExpand(feeId)}
                    className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-xs shrink-0">
                        {stu?.fullName?.charAt(0) || 'F'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                            {stu?.fullName || 'Student'}
                          </h4>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            {f.className}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          Adm: {stu?.admissionNumber || '—'} &bull; Balance: {fmtUGX(f.balance)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${f.status === 'paid' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                        {f.status}
                      </span>
                      <button
                        type="button"
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        title={isExpanded ? "Collapse" : "Expand"}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 text-xs space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-slate-700 dark:text-slate-300">
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 block">Student Name:</span>
                          <span className="font-bold text-slate-900 dark:text-white">{stu?.fullName || '—'}</span>
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 block">Admission Number:</span>
                          <span className="font-mono text-slate-900 dark:text-white">{stu?.admissionNumber || '—'}</span>
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 block">Class Stream:</span>
                          <span className="font-semibold">{f.className}</span>
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 block">Total Tuition Invoiced:</span>
                          <span className="font-bold text-slate-900 dark:text-white">{fmtUGX(f.totalFee)}</span>
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 block">Amount Paid:</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">{fmtUGX(f.paidAmount)}</span>
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 block">Outstanding Arrears:</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400">{fmtUGX(f.balance)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        {renderSharedModals()}
      </div>
    );
  }

  // ====================================================
  // 10. ANNOUNCEMENTS BROADCASTS (Vertical Foldable Layout)
  // ====================================================
  if (section === 'announcements') {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              School Broadcast Notices &amp; Circulars
            </h2>
            <p className="text-[11px] text-slate-500">
              Publish circulars across the entire school, faculty, or parent portals.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {announcements.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const allExpanded = announcements.every(a => expandedItems[a.id]);
                  const next: Record<string, boolean> = {};
                  announcements.forEach(a => { next[a.id] = !allExpanded; });
                  setExpandedItems(next);
                }}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                {announcements.every(a => expandedItems[a.id]) ? 'Collapse All' : 'Expand All'}
              </button>
            )}
            <button
              onClick={() => {
                setAnnoTitle('');
                setAnnoMsg('');
                setModalType('addAnnouncement');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" /> + Create Broadcast
            </button>
          </div>
        </div>

        {actionSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Announcements Foldable Cards */}
        <div className="space-y-3">
          {announcements.length === 0 ? (
            <div className="p-8 text-center text-slate-400 italic rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
              No announcements published yet.
            </div>
          ) : (
            announcements.map(a => {
              const isExpanded = !!expandedItems[a.id];
              return (
                <div
                  key={a.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-colors"
                >
                  <div
                    onClick={() => toggleItemExpand(a.id)}
                    className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                          {a.title}
                        </h4>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 capitalize">
                          {a.audience}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${a.priority === 'high' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-slate-500/10 text-slate-500'}`}>
                          {a.priority || 'Normal'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-1">
                        {a.message}
                      </p>
                      {formatAnnouncementDate(a.createdAt) && (
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium pt-1">
                          {formatAnnouncementDate(a.createdAt)}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          requestConfirmDelete(
                            'Delete Circular Notice',
                            `Are you sure you want to permanently delete announcement "${a.title}"?`,
                            async () => {
                              await deleteDoc(doc(db, 'announcements', a.id));
                              await onRefreshData();
                            }
                          );
                        }}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Delete Notice"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        title={isExpanded ? "Collapse" : "Expand"}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 text-xs space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-700 dark:text-slate-300">
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 block">Notice Title:</span>
                          <span className="font-bold text-slate-900 dark:text-white">{a.title}</span>
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 block">Target Audience:</span>
                          <span className="capitalize">{a.audience}</span>
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 block">Date Published:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {formatAnnouncementDate(a.createdAt) || 'Recent'}
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 block mb-1">Full Circular Content:</span>
                        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {a.message}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        {renderSharedModals(renderAnnouncementModal())}
      </div>
    );
  }

  // ====================================================
  // 11. AUDIT LOGS VIEW
  // ====================================================
  if (section === 'audit') {
    return (
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          Administrative Audit Trail
        </h2>
        <div className="space-y-2">
          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
              No audit logs recorded yet.
            </div>
          ) : (
            auditLogs.map(l => (
              <div key={l.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs flex justify-between items-center">
                <div>
                  <span className="font-bold text-blue-600 dark:text-blue-400 mr-2">[{l.action || l.actionType}]</span>
                  <span className="text-slate-700 dark:text-slate-300">Target: {l.targetType} ({l.targetId})</span>
                </div>
                <span className="text-[10px] text-slate-400">{l.performedBy}</span>
              </div>
            ))
          )}
        </div>
        {renderSharedModals()}
      </div>
    );
  }

  return (
    <div>
      {renderSharedModals()}
    </div>
  );
};
