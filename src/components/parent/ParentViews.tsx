import React, { useState, useEffect } from 'react';
import {
  collection,
  doc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Users,
  GraduationCap,
  CreditCard,
  FileText,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  X,
  Phone,
  Building,
  ChevronDown,
  ChevronUp,
  Award,
  Send,
  HelpCircle,
  PhoneCall,
  Mail,
  MessageCircle,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  DollarSign,
  ClipboardCheck,
  Megaphone,
} from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useSchoolSettings } from '../../context/SchoolSettingsContext';
import { SCHOOL_LOGO_URL } from '../../constants/school';
import { getSubjectDisplayName } from '../../utils/subjectUtils';
import { formatAnnouncementDate } from '../../utils/dateUtils';
import {
  Student,
  Parent,
  FeeRecord,
  PaymentRecord,
  ParentPaymentApproval,
  ResultRecord,
  ReportCard,
  AttendanceRecord,
  Announcement,
} from '../../types';

interface ParentViewsProps {
  section: string;
  parentProfile: Parent | null;
  students: Student[];
  fees: FeeRecord[];
  payments: PaymentRecord[];
  paymentApprovals: ParentPaymentApproval[];
  results: ResultRecord[];
  reports: ReportCard[];
  attendance: AttendanceRecord[];
  announcements: Announcement[];
  onRefreshData: () => Promise<void>;
}

export const ParentViews: React.FC<ParentViewsProps> = ({
  section,
  parentProfile,
  students,
  fees,
  payments,
  paymentApprovals,
  results,
  reports,
  attendance,
  announcements,
  onRefreshData,
}) => {
  const { currentUser, userProfile } = useAuth();
  const { settings, currentTerm, currentYear } = useSchoolSettings();

  // Determine students linked to this parent
  const userEmail = (currentUser?.email || '').trim().toLowerCase();
  const parentId = parentProfile?.id || currentUser?.uid || '';
  const allChildIds = Array.from(
    new Set([
      ...(parentProfile?.childIds || []),
      ...((userProfile as any)?.childIds || []),
    ])
  );

  const matchedStudents = students.filter(s => {
    const inChildIds = allChildIds.includes(s.id);
    const inParentIds = parentId ? (s.parentIds || []).includes(parentId) : false;
    const inParentEmails = userEmail
      ? (s.parentEmails || []).some(e => (e || '').trim().toLowerCase() === userEmail)
      : false;
    return inChildIds || inParentIds || inParentEmails;
  });

  // Matched students for this parent only - strictly scoped without exposing other students
  const effectiveStudents: Student[] = matchedStudents;

  // Multi-child dropdown selector: Placed at the very top of the page
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    effectiveStudents[0]?.id || ''
  );

  useEffect(() => {
    if (
      (!selectedStudentId || !effectiveStudents.some(s => s.id === selectedStudentId)) &&
      effectiveStudents.length > 0
    ) {
      setSelectedStudentId(effectiveStudents[0].id);
    }
  }, [effectiveStudents, selectedStudentId]);

  const activeStudent: Student | undefined =
    effectiveStudents.find(s => s.id === selectedStudentId) || effectiveStudents[0];

  // Collapsible cards state: collapsed by default
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const toggleExpand = (id: string) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Payment Form Modal & Submission State (Strictly NO screenshot upload)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payAmount, setPayAmount] = useState('500000');
  const [payMethod, setPayMethod] = useState<'mtn' | 'airtel' | 'bank' | 'cash'>('mtn');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [submittingPay, setSubmittingPay] = useState(false);
  const [paySuccess, setPaySuccess] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  // Selected Report Card for View/Print Modal
  const [selectedReport, setSelectedReport] = useState<ReportCard | null>(null);

  const fmtUGX = (val: number) => {
    return (val || 0).toLocaleString() + ' ' + (settings.currency || 'UGX');
  };

  const handleCreatePaymentApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStudent) {
      setPayError('Please select a student ward first.');
      return;
    }
    if (!payRef.trim()) {
      setPayError('Please provide a valid Transaction Reference or Deposit Slip Number.');
      return;
    }

    const numericAmount = Number(payAmount);
    if (isNaN(numericAmount) || !isFinite(numericAmount) || numericAmount <= 0) {
      setPayError('Please enter a valid positive payment amount (e.g. 500,000 UGX).');
      return;
    }

    setSubmittingPay(true);
    setPaySuccess(null);
    setPayError(null);

    try {
      await addDoc(collection(db, 'parentPaymentApprovals'), {
        parentId: parentProfile?.id || currentUser?.uid,
        parentName:
          parentProfile?.fullName ||
          currentUser?.displayName ||
          userProfile?.fullName ||
          'Parent Guardian',
        parentPhone: parentProfile?.phone || '',
        studentId: activeStudent.id,
        studentName: activeStudent.fullName,
        studentAdmissionNumber: activeStudent.admissionNumber,
        admissionNumber: activeStudent.admissionNumber,
        className: activeStudent.className,
        amount: Number(payAmount),
        paymentMethod: payMethod,
        channel: payMethod,
        referenceNumber: payRef.trim(),
        transactionRef: payRef.trim(),
        notes: payNotes,
        status: 'pending',
        term: currentTerm,
        academicYear: currentYear,
        submittedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      setPaySuccess(
        `Payment voucher for ${fmtUGX(Number(payAmount))} submitted for Bursary clearance! Status: Pending Approval.`
      );
      setPayRef('');
      setPayNotes('');
      setShowPaymentModal(false);
      if (onRefreshData) await onRefreshData();
    } catch (err: any) {
      setPayError(err.message || 'Failed to submit payment voucher.');
    } finally {
      setSubmittingPay(false);
    }
  };

  // Associated records for active student
  const studentFee = fees.find(
    f =>
      f.studentId === activeStudent?.id &&
      f.term === currentTerm &&
      (f.year === currentYear || f.academicYear === currentYear)
  );

  const studentPayments = payments.filter(p => p.studentId === activeStudent?.id);
  const studentApprovals = paymentApprovals.filter(p => p.studentId === activeStudent?.id);
  const studentReports = reports.filter(r => r.studentId === activeStudent?.id);
  const studentResults = results.filter(r => r.studentId === activeStudent?.id);
  const studentAttendance = attendance.filter(a => a.studentId === activeStudent?.id);

  // Financial calculations
  const totalBilled = studentFee?.totalFees || studentFee?.amount || 850000;
  const totalPaid = studentFee?.paidAmount || 0;
  const balanceRemaining = Math.max(0, totalBilled - totalPaid);
  const isCleared = balanceRemaining === 0 && totalPaid > 0;

  // Attendance stats
  const presentDays = studentAttendance.filter(a => a.status === 'present').length;
  const absentDays = studentAttendance.filter(a => a.status === 'absent').length;
  const lateDays = studentAttendance.filter(a => a.status === 'late').length;
  const totalDays = studentAttendance.length;
  const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

  // Multi-child selection bar at the very top of the page
  const childSelectorHeader = (
    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Active Student Ward
            </div>
            <div className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <span>{activeStudent?.fullName || 'Selected Student'}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                {activeStudent?.className}
              </span>
              <span className="text-xs text-slate-400 font-mono font-normal">
                ({activeStudent?.admissionNumber})
              </span>
            </div>
          </div>
        </div>

        {effectiveStudents.length > 1 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">
              Select Child:
            </label>
            <select
              value={activeStudent?.id}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-blue-500/40 bg-blue-50/50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {effectiveStudents.map(s => (
                <option key={s.id} value={s.id}>
                  {s.fullName} &bull; {s.className} ({s.admissionNumber})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );

  // ====================================================
  // EMERGENCY CONTACTS COMPONENT (Mailto, WhatsApp, Tel)
  // Direct Support for School Administration
  // ====================================================
  const renderEmergencyContacts = () => (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-gradient-to-r from-red-600/10 via-amber-500/10 to-blue-600/10 border border-red-500/30 dark:border-red-500/20 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-md">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              Official School Administration Support &amp; Emergency Directory
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Immediate communication channels for parents and guardians. Tap any phone number to dial directly, tap WhatsApp to start an instant message, or tap email to write directly to the administration.
            </p>
          </div>
        </div>
      </div>

      {/* Directory Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Headteacher's Office */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
                Executive Leadership
              </span>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Headteacher &bull; Administration
              </h3>
            </div>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            For institutional matters, student discipline, official transfers, and general school administration.
          </p>
          <div className="pt-2 space-y-2 text-xs">
            <a
              href="tel:+256772123456"
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors"
            >
              <span className="flex items-center gap-2 font-semibold">
                <PhoneCall className="w-3.5 h-3.5 text-blue-600" /> +256 772 123 456
              </span>
              <span className="text-[10px] font-bold text-blue-600 uppercase">Direct Call</span>
            </a>
            <a
              href="https://wa.me/256772123456?text=Hello%20Headteacher%20Mubende%20Light%20SSS,%20I%20am%20contacting%20you%20regarding%20my%20child"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 transition-colors"
            >
              <span className="flex items-center gap-2 font-semibold">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp Chat
              </span>
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Instant</span>
            </a>
            <a
              href="mailto:headteacher@mubendelight.sc.ug?subject=Parent%20Inquiry%20-%20Mubende%20Light%20SSS"
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <span className="flex items-center gap-2 font-semibold">
                <Mail className="w-3.5 h-3.5 text-slate-500" /> headteacher@mubendelight.sc.ug
              </span>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Email</span>
            </a>
          </div>
        </div>

        {/* Bursar's Office / Fees & Accounts */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                Finances &amp; Accounts
              </span>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                School Bursar &bull; Accounts Desk
              </h3>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            For school fees clearance, payment verification, deposit slips reconciliation, and receipts.
          </p>
          <div className="pt-2 space-y-2 text-xs">
            <a
              href="tel:+256701987654"
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-700 dark:text-slate-300 hover:text-amber-600 transition-colors"
            >
              <span className="flex items-center gap-2 font-semibold">
                <PhoneCall className="w-3.5 h-3.5 text-amber-600" /> +256 701 987 654
              </span>
              <span className="text-[10px] font-bold text-amber-600 uppercase">Direct Call</span>
            </a>
            <a
              href="https://wa.me/256701987654?text=Hello%20Bursar%20Mubende%20Light%20SSS,%20I%20am%20inquiry%20about%20fees%20clearance%20for%20my%20ward"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 transition-colors"
            >
              <span className="flex items-center gap-2 font-semibold">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp Bursary
              </span>
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Instant</span>
            </a>
            <a
              href="mailto:bursar@mubendelight.sc.ug?subject=School%20Fees%20Inquiry%20-%20Mubende%20Light%20SSS"
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <span className="flex items-center gap-2 font-semibold">
                <Mail className="w-3.5 h-3.5 text-slate-500" /> bursar@mubendelight.sc.ug
              </span>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Email</span>
            </a>
          </div>
        </div>

        {/* Director of Studies (DOS) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                Academics &amp; Curriculum
              </span>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Director of Studies (DOS)
              </h3>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            For academic performance, assessment results, report cards, and subject combinations.
          </p>
          <div className="pt-2 space-y-2 text-xs">
            <a
              href="tel:+256782554433"
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 hover:text-emerald-600 transition-colors"
            >
              <span className="flex items-center gap-2 font-semibold">
                <PhoneCall className="w-3.5 h-3.5 text-emerald-600" /> +256 782 554 433
              </span>
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Direct Call</span>
            </a>
            <a
              href="https://wa.me/256782554433?text=Hello%20DOS%20Mubende%20Light%20SSS,%20I%20have%20an%20academic%20question%20regarding%20my%20child"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 transition-colors"
            >
              <span className="flex items-center gap-2 font-semibold">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp DOS
              </span>
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Instant</span>
            </a>
            <a
              href="mailto:academics@mubendelight.sc.ug?subject=Academic%20Inquiry%20-%20Mubende%20Light%20SSS"
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <span className="flex items-center gap-2 font-semibold">
                <Mail className="w-3.5 h-3.5 text-slate-500" /> academics@mubendelight.sc.ug
              </span>
              <span className="text-[10px] font-bold text-slate-500 uppercase">Email</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );

  // ====================================================
  // 1. HOME & OVERVIEW SECTION
  // ====================================================
  if (effectiveStudents.length === 0 && section !== 'contacts') {
    return (
      <div className="space-y-6">
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center max-w-xl mx-auto my-8 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-2">
            No Student Ward Linked to Your Account
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
            Your parent portal account is authenticated, but has not yet been linked to an enrolled student admission number. To access report cards, fee statements, and attendance records, please contact the school administration office to verify and link your student ward.
          </p>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left text-xs space-y-2">
            <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Building className="w-4 h-4 text-blue-500" /> School Administration Desk:
            </div>
            <div className="text-slate-600 dark:text-slate-400 pl-5 leading-relaxed">
              Email: <span className="font-semibold text-blue-600">admin@mubendelight.sc.ug</span><br />
              Hotlines: <span className="font-semibold">+256 700 001 122</span> / <span className="font-semibold">+256 772 123 456</span><br />
              Registered Parent Email: <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">{userEmail || 'Parent Account'}</span>
            </div>
          </div>
        </div>
        {renderEmergencyContacts()}
      </div>
    );
  }

  if (section === 'home' || section === 'dashboard') {
    return (
      <div className="space-y-6">
        {childSelectorHeader}

        {/* Emergency Quick Action Strip */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <PhoneCall className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm">Need Direct School Support?</h3>
              <p className="text-xs text-blue-100">
                Direct phone, WhatsApp, and email lines to Administration and Bursary.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              href="tel:+256772123456"
              className="flex-1 sm:flex-none text-center px-3.5 py-1.5 rounded-xl bg-white text-blue-700 text-xs font-bold hover:bg-blue-50 transition-colors shadow-xs"
            >
              Call Administration
            </a>
            <a
              href="https://wa.me/256701987654?text=Hello%20Mubende%20Light%20SSS%20Administration"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-none text-center px-3.5 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-colors shadow-xs"
            >
              WhatsApp Bursar
            </a>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Fees Clearance Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                School Fees Status
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                  isCleared
                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                }`}
              >
                {isCleared ? 'Cleared' : 'Outstanding'}
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {fmtUGX(balanceRemaining)}
            </div>
            <div className="text-xs text-slate-400">
              Paid: {fmtUGX(totalPaid)} of {fmtUGX(totalBilled)}
            </div>
            <div className="pt-2">
              <button
                onClick={() => setShowPaymentModal(true)}
                className="w-full py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
              >
                <CreditCard className="w-3.5 h-3.5" /> Submit Payment Voucher
              </button>
            </div>
          </div>

          {/* Academic Standing Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Academic Performance
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-500/10 text-blue-600">
                {currentTerm} {currentYear}
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {studentReports[0]?.average ? `${studentReports[0].average}%` : 'Evaluating'}
            </div>
            <div className="text-xs text-slate-400">
              {studentResults.length} Assessment Subject Marks Logged
            </div>
            <div className="pt-2">
              {studentReports.length > 0 ? (
                <button
                  onClick={() => setSelectedReport(studentReports[0])}
                  className="w-full py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-500" /> View Official Report Card
                </button>
              ) : (
                <div className="text-[11px] text-slate-400 italic py-1.5 text-center">
                  Terminal ranking in compilation
                </div>
              )}
            </div>
          </div>

          {/* Roll Call Attendance Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Roll Call Attendance
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600">
                {attendanceRate}% Present
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {presentDays} / {totalDays || 0} Days
            </div>
            <div className="text-xs text-slate-400">
              Absent: {absentDays} &bull; Late: {lateDays}
            </div>
            <div className="pt-2">
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${attendanceRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Latest Announcements Banner */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-blue-500" />
              School Circulars &amp; Announcements for Parents
            </h3>
            <span className="text-xs text-slate-400">{announcements.length} Notices</span>
          </div>

          {announcements.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No announcements published at this time.</p>
          ) : (
            <div className="space-y-2">
              {announcements.slice(0, 2).map(a => (
                <div
                  key={a.id}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">{a.title}</span>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {a.priority || 'General'}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{a.message}</p>
                  {formatAnnouncementDate(a.createdAt) && (
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium pt-1">
                      {formatAnnouncementDate(a.createdAt)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Report Card Modal if open */}
        {selectedReport && renderReportModal()}

        {/* Payment Modal if open */}
        {renderPaymentModal()}
      </div>
    );
  }

  // ====================================================
  // 2. ACADEMIC PERFORMANCE VIEW (Child / Reports)
  // Strictly human-readable names, never Firebase subject IDs
  // Continuous assessment: BOT, MOT, EOT, Activity of Integration
  // ====================================================
  if (section === 'child' || section === 'reports' || section === 'academics') {
    return (
      <div className="space-y-6">
        {childSelectorHeader}

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Academic Performance &amp; Evaluation &bull; {activeStudent?.fullName}
            </h2>
            <p className="text-[11px] text-slate-500">
              Official subject marks, continuous assessment tests, and terminal progress reports.
            </p>
          </div>
        </div>

        {/* Terminal Report Cards */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Official Terminal Report Cards
          </h3>

          {studentReports.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 italic">
              No compiled terminal report cards published for {activeStudent?.fullName} yet.
            </div>
          ) : (
            studentReports.map(r => {
              const isCardExpanded = !!expandedCards[r.id];
              return (
                <div
                  key={r.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden"
                >
                  <div
                    onClick={() => toggleExpand(r.id)}
                    className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                          Terminal Report Card &bull; {r.term} ({r.year})
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Class: {r.className} &bull; Stream Position: <strong>#{r.position}</strong> of{' '}
                          {r.totalStudents} Candidates
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedReport(r)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                      >
                        <Printer className="w-3.5 h-3.5" /> View / Print
                      </button>
                      <button
                        onClick={() => toggleExpand(r.id)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
                      >
                        {isCardExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isCardExpanded && (
                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-3 text-xs">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div>
                          <span className="text-slate-400 block">Class Standing:</span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            Rank #{r.position} of {r.totalStudents}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Terminal Average:</span>
                          <span className="font-bold text-blue-600">{r.average}%</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Conduct / Discipline:</span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {r.conduct || 'Exemplary'}
                          </span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800">
                        <span className="text-slate-400 font-medium">Headteacher Remark: </span>
                        <span className="italic text-slate-700 dark:text-slate-300">
                          &ldquo;{r.adminComment || r.teacherComment || 'Satisfactory progress'}&rdquo;
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Continuous Assessment Breakdown */}
        <div className="space-y-3 pt-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-amber-500" /> Continuous Assessment &amp; Examination
            Scores
          </h3>

          {studentResults.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 italic">
              No continuous assessment scores logged for {activeStudent?.fullName} yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {studentResults.map((r, i) => (
                <div
                  key={r.id || `${r.studentId}_${i}`}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {getSubjectDisplayName(r.subjectName || r.subjectId)}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      Grade {r.grade}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500 font-medium">{r.examType}</span>
                    <span className="font-extrabold text-blue-600 dark:text-blue-400 text-sm">
                      {r.marks}%
                    </span>
                  </div>
                  {r.comment && (
                    <p className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-100 dark:border-slate-800">
                      &ldquo;{r.comment}&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal if selected */}
        {selectedReport && renderReportModal()}
        {renderPaymentModal()}
      </div>
    );
  }

  // ====================================================
  // 3. ATTENDANCE VIEW
  // ====================================================
  if (section === 'attendance') {
    return (
      <div className="space-y-6">
        {childSelectorHeader}

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Student Attendance Log &bull; {activeStudent?.fullName}
          </h2>
          <span className="text-xs text-slate-500">{studentAttendance.length} Days Logged</span>
        </div>

        {/* Attendance Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Rate</span>
            <div className="text-xl font-black text-slate-900 dark:text-white">
              {attendanceRate}%
            </div>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20 text-center">
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">
              Present
            </span>
            <div className="text-xl font-black text-emerald-700 dark:text-emerald-300">
              {presentDays}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-500/20 text-center">
            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase">
              Absent
            </span>
            <div className="text-xl font-black text-rose-700 dark:text-rose-300">{absentDays}</div>
          </div>
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-500/20 text-center">
            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase">
              Late
            </span>
            <div className="text-xl font-black text-amber-700 dark:text-amber-300">{lateDays}</div>
          </div>
        </div>

        {/* Attendance Records */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {studentAttendance.length === 0 ? (
            <div className="col-span-full p-8 text-center text-slate-400 text-xs bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 italic">
              No roll call attendance records logged for {activeStudent?.fullName} yet.
            </div>
          ) : (
            studentAttendance.map(a => (
              <div
                key={a.id || a.date}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs text-xs flex justify-between items-center"
              >
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">{a.date}</span>
                  <div className="text-[10px] text-slate-400 font-mono">Stream: {a.className}</div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    a.status === 'present'
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : a.status === 'absent'
                      ? 'bg-rose-500/10 text-rose-600'
                      : 'bg-amber-500/10 text-amber-600'
                  }`}
                >
                  {a.status}
                </span>
              </div>
            ))
          )}
        </div>

        {renderPaymentModal()}
      </div>
    );
  }

  // ====================================================
  // 4. FEES & PAYMENTS VIEW
  // Exactly matching original format, strictly eliminating screenshot upload
  // ====================================================
  if (section === 'fees' || section === 'payments') {
    return (
      <div className="space-y-6">
        {childSelectorHeader}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              School Fees Ledger &amp; Payment History
            </h2>
            <p className="text-[11px] text-slate-500">
              Current term charges, submitted payment vouchers, and official receipts.
            </p>
          </div>
          <button
            onClick={() => setShowPaymentModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shadow-xs"
          >
            <CreditCard className="w-4 h-4" /> Submit Payment Voucher
          </button>
        </div>

        {paySuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{paySuccess}</span>
          </div>
        )}

        {/* Institutional Payment Guidance Card */}
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-slate-800 dark:text-slate-200 text-xs space-y-3">
          <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400">
            <HelpCircle className="w-4 h-4" />
            Official School Payment Channels &amp; Guidance
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-500/20">
              <span className="font-bold text-amber-600 block mb-1">1. MTN MoMo Pay</span>
              <div>
                Merchant Code: <strong>554433</strong>
              </div>
              <div>
                Recipient: <strong>Mubende Light SSS</strong>
              </div>
              <div className="text-slate-400 mt-1 font-mono">
                Reference: {activeStudent?.admissionNumber}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-500/20">
              <span className="font-bold text-rose-600 block mb-1">2. Airtel Money</span>
              <div>
                Merchant Code: <strong>998877</strong>
              </div>
              <div>
                Recipient: <strong>Mubende Light SSS</strong>
              </div>
              <div className="text-slate-400 mt-1 font-mono">
                Reference: {activeStudent?.admissionNumber}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-500/20">
              <span className="font-bold text-blue-600 block mb-1">3. Bank Transfer</span>
              <div>
                Bank: <strong>Centenary Bank</strong>
              </div>
              <div>
                A/C: <strong>3100012345</strong>
              </div>
              <div className="text-slate-400 mt-1 font-mono">
                Reference: {activeStudent?.admissionNumber}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 italic">
            * Note: Always include the Student Code (
            <strong>{activeStudent?.admissionNumber}</strong>) as your payment reference to
            guarantee automatic reconciliation.
          </p>
        </div>

        {/* Current Fee Assessment Card */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Billing Cycle
              </span>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                {currentTerm} ({currentYear}) &bull; {activeStudent?.className}
              </h3>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                isCleared
                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
              }`}
            >
              {isCleared ? 'Account Cleared' : 'Outstanding Balance'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5">Total Term Bill</span>
              <span className="text-lg font-bold text-slate-900 dark:text-white">
                {fmtUGX(totalBilled)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Total Cleared</span>
              <span className="text-lg font-bold text-emerald-600">{fmtUGX(totalPaid)}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Balance Remaining</span>
              <span className="text-lg font-black text-rose-600 dark:text-rose-400">
                {fmtUGX(balanceRemaining)}
              </span>
            </div>
          </div>
        </div>

        {/* Submitted Payment Approvals Stream */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Submitted Payment Vouchers ({studentApprovals.length})
          </h3>

          {studentApprovals.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 italic">
              No submitted payment vouchers for {activeStudent?.fullName}. Click "Submit Payment
              Voucher" above after making an MTN, Airtel, or Bank transfer.
            </div>
          ) : (
            studentApprovals.map(app => (
              <div
                key={app.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    {fmtUGX(app.amount)} &bull;{' '}
                    <span className="uppercase text-slate-500 font-mono">
                      {app.paymentMethod || app.channel}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Ref: {app.referenceNumber || app.transactionRef}
                  </div>
                  {app.notes && (
                    <div className="text-[10px] text-slate-500 mt-1 italic">&ldquo;{app.notes}&rdquo;</div>
                  )}
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    app.status === 'approved'
                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      : app.status === 'rejected'
                      ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                      : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                  }`}
                >
                  {app.status === 'approved' ? 'Approved & Credited' : app.status}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Cleared Receipts Ledger */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Official Receipts Stream ({studentPayments.length})
          </h3>

          {studentPayments.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 italic">
              No cleared receipt entries on record for {activeStudent?.fullName}.
            </div>
          ) : (
            studentPayments.map(p => (
              <div
                key={p.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    {fmtUGX(p.amount)} &bull; Receipt #{p.receiptNumber || p.id?.slice(0, 8)}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Date: {p.date || 'Audited'} &bull; Method: {p.paymentMethod || 'Sure Pay'}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                  Receipt Issued
                </span>
              </div>
            ))
          )}
        </div>

        {renderPaymentModal()}
      </div>
    );
  }

  // ====================================================
  // 5. EMERGENCY CONTACTS DIRECTORY
  // ====================================================
  if (section === 'contacts' || section === 'support') {
    return (
      <div className="space-y-6">
        {childSelectorHeader}
        {renderEmergencyContacts()}
        {renderPaymentModal()}
      </div>
    );
  }

  // ====================================================
  // 6. ANNOUNCEMENTS VIEW
  // ====================================================
  if (section === 'announcements') {
    return (
      <div className="space-y-6">
        {childSelectorHeader}

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            School Announcements &amp; Circulars
          </h2>
          <span className="text-xs text-slate-500">{announcements.length} Published</span>
        </div>

        <div className="space-y-3">
          {announcements.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 italic">
              No circulars published at this time.
            </div>
          ) : (
            announcements.map(a => (
              <div
                key={a.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white">{a.title}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      a.priority === 'high'
                        ? 'bg-rose-500/10 text-rose-600'
                        : 'bg-blue-500/10 text-blue-600'
                    }`}
                  >
                    {a.priority || 'Normal'}
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                  {a.message}
                </p>
                {formatAnnouncementDate(a.createdAt) && (
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium pt-1">
                    {formatAnnouncementDate(a.createdAt)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {renderPaymentModal()}
      </div>
    );
  }

  // Fallback if section wasn't matched above
  return (
    <div className="space-y-6">
      {childSelectorHeader}
      {renderEmergencyContacts()}
      {renderPaymentModal()}
    </div>
  );

  // ====================================================
  // HELPER MODALS: Official Report Card & Payment Voucher
  // ====================================================
  function renderReportModal() {
    if (!selectedReport) return null;
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <img
                src={SCHOOL_LOGO_URL}
                alt="Mubende Light SSS"
                className="w-12 h-12 rounded-full object-cover border-2 border-blue-500"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22%3E%3Crect fill=%22%230f172a%22 width=%2248%22 height=%2248%22 rx=%2224%22/%3E%3Ctext x=%2224%22 y=%2229%22 text-anchor=middle fill=white font-size=12 font-weight=bold%3EMLSS%3C/text%3E%3C/svg%3E';
                }}
              />
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white uppercase">
                  {settings.schoolName}
                </h2>
                <p className="text-[11px] text-blue-500 font-semibold italic">
                  &ldquo;{settings.motto}&rdquo;
                </p>
                <p className="text-[10px] text-slate-400">
                  Terminal Progress Report &bull; {selectedReport.term} ({selectedReport.year})
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedReport(null)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block">Student Ward</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {activeStudent?.fullName}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Admission Number</span>
              <span className="font-bold text-slate-900 dark:text-white font-mono">
                {activeStudent?.admissionNumber}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Academic Session</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {selectedReport.term} &bull; {selectedReport.year}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Position in Class</span>
              <span className="font-bold text-emerald-500">
                #{selectedReport.position} of {selectedReport.totalStudents}
              </span>
            </div>
          </div>

          {/* Subject Breakdown: Human readable names only */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Subject Performance Evaluations
            </span>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {results
                .filter(
                  r =>
                    r.studentId === activeStudent?.id &&
                    r.term === selectedReport.term &&
                    (r.year === selectedReport.year || !r.year)
                )
                .map(r => (
                  <div
                    key={r.id || r.subjectId}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-200/60 dark:border-slate-700/50">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {getSubjectDisplayName(r.subjectName || r.subjectId)}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                        Grade {r.grade}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] mb-1">
                      <div>
                        <span className="text-slate-400 block">Exam Marks:</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">{r.marks}%</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Assessment Type:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {r.examType}
                        </span>
                      </div>
                    </div>
                    {r.comment && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 italic pt-1 border-t border-slate-200/40 dark:border-slate-700/30">
                        &ldquo;{r.comment}&rdquo;
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-2 text-xs">
            <div>
              <span className="font-bold text-slate-700 dark:text-slate-300">Terminal Average:</span>{' '}
              <span className="font-extrabold text-blue-600">{selectedReport.average}%</span>
            </div>
            <div>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Headteacher Remarks:
              </span>{' '}
              <span className="italic text-slate-800 dark:text-slate-200">
                &ldquo;{selectedReport.adminComment || selectedReport.teacherComment}&rdquo;
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition-colors"
            >
              <Printer className="w-4 h-4" /> Print Report Card
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderPaymentModal() {
    if (!showPaymentModal) return null;
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-500" />
              Submit Payment Voucher
            </h3>
            <button
              onClick={() => setShowPaymentModal(false)}
              className="text-slate-500 p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {payError && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
              {payError}
            </div>
          )}

          <form onSubmit={handleCreatePaymentApproval} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Student Ward
              </label>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white flex justify-between">
                <span>
                  {activeStudent?.fullName} ({activeStudent?.className})
                </span>
                <span className="font-mono text-blue-600 dark:text-blue-400">
                  {activeStudent?.admissionNumber}
                </span>
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Payment Method / Channel
              </label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold"
              >
                <option value="mtn">MTN MoMo Pay (Merchant Code: 554433)</option>
                <option value="airtel">Airtel Money (Merchant Code: 998877)</option>
                <option value="bank">Centenary Bank Deposit Slip (A/C: 3100012345)</option>
                <option value="cash">Direct Cash at School Bursary</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Amount Paid (UGX)
              </label>
              <input
                type="number"
                required
                min={1000}
                step={5000}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Transaction Ref / Deposit Slip Number
              </label>
              <input
                type="text"
                required
                placeholder="e.g. MTN TID 123456789 or Bank Slip No."
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono uppercase"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Additional Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Paid via mother's phone number 077..."
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingPay}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-md disabled:opacity-50"
              >
                {submittingPay ? 'Submitting...' : 'Submit Voucher'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
};
