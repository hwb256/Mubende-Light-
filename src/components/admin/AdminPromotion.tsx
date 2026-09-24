import React, { useState } from 'react';
import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import {
  GraduationCap,
  ArrowRight,
  History,
  CheckCircle2,
  AlertCircle,
  Users,
  Search,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { db } from '../../firebase';
import { useSchoolSettings } from '../../context/SchoolSettingsContext';
import { useAuth } from '../../context/AuthContext';
import { ALL_CLASSES } from '../../constants/school';
import {
  Student,
  EnrollmentHistory,
  ReportCard,
  FeeRecord,
} from '../../types';

interface AdminPromotionProps {
  section: 'promotion' | 'pastyears';
  students: Student[];
  enrollmentHistory: EnrollmentHistory[];
  reports: ReportCard[];
  fees: FeeRecord[];
  onRefreshData: () => Promise<void>;
  notifyAudit: (action: string, targetType: string, targetId: string) => Promise<void>;
}

export const AdminPromotion: React.FC<AdminPromotionProps> = ({
  section,
  students,
  enrollmentHistory,
  reports,
  fees,
  onRefreshData,
  notifyAudit,
}) => {
  const { currentTerm, currentYear } = useSchoolSettings();
  const { currentUser, userProfile } = useAuth();

  // Promotion Form State
  const [sourceClass, setSourceClass] = useState('S.1T');
  const [targetClass, setTargetClass] = useState('S.2T');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [promoting, setPromoting] = useState(false);
  const [promoSuccess, setPromoSuccess] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Past Years State
  const [pastYear, setPastYear] = useState<number>(currentYear - 1 || 2025);
  const [pastSearch, setPastSearch] = useState('');

  // Collapsible cards state: collapsed by default
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const sourceStudents = students.filter(s => s.className === sourceClass && s.status === 'active');

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSelectAll = () => {
    if (selectedStudentIds.length === sourceStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(sourceStudents.map(s => s.id));
    }
  };

  const toggleSelectStudent = (id: string) => {
    if (selectedStudentIds.includes(id)) {
      setSelectedStudentIds(selectedStudentIds.filter(sid => sid !== id));
    } else {
      setSelectedStudentIds([...selectedStudentIds, id]);
    }
  };

  const handlePromoteStudents = async () => {
    if (selectedStudentIds.length === 0) {
      setPromoError('Please select at least one student candidate for promotion.');
      return;
    }
    if (sourceClass === targetClass) {
      setPromoError('Source class and destination class cannot be identical.');
      return;
    }

    setPromoting(true);
    setPromoSuccess(null);
    setPromoError(null);

    try {
      const batch = writeBatch(db);
      const candidates = students.filter(s => selectedStudentIds.includes(s.id));

      candidates.forEach(stu => {
        // 1. Snapshot record into 'enrollmentHistory'
        const historyRef = doc(collection(db, 'enrollmentHistory'));
        batch.set(historyRef, {
          studentId: stu.id,
          studentName: stu.fullName,
          admissionNumber: stu.admissionNumber,
          previousClass: sourceClass,
          nextClass: targetClass,
          fromClass: sourceClass,
          toClass: targetClass,
          academicYear: currentYear,
          year: currentYear,
          term: currentTerm,
          outcome: 'promoted',
          promotedAt: serverTimestamp(),
          promotedBy: userProfile?.fullName || currentUser?.displayName || currentUser?.email || 'Administrator',
        });

        // 2. Update student's class in 'students'
        const stuRef = doc(db, 'students', stu.id);
        batch.update(stuRef, {
          className: targetClass,
          updatedAt: serverTimestamp(),
        });

        // 3. Initialize fresh fee ledger for the new class
        const feeDocId = `${stu.id}_${currentTerm}_${currentYear}`;
        const feeRef = doc(db, 'fees', feeDocId);
        batch.set(feeRef, {
          studentId: stu.id,
          className: targetClass,
          term: currentTerm,
          year: currentYear,
          totalFee: 1200000,
          paidAmount: 0,
          balance: 1200000,
          status: 'unpaid',
          updatedAt: serverTimestamp(),
        }, { merge: true });
      });

      await batch.commit();
      await notifyAudit('PROMOTE_STUDENTS', 'students', `${sourceClass}_to_${targetClass}`);
      setPromoSuccess(
        `Successfully promoted ${candidates.length} students from ${sourceClass} to ${targetClass}!`
      );
      setSelectedStudentIds([]);
      await onRefreshData();
    } catch (err: any) {
      console.error("Promotion error:", err);
      setPromoError(`[${err.code || 'PROMO_ERROR'}] ${err.message || 'Failed to complete student promotion.'}`);
    } finally {
      setPromoting(false);
    }
  };

  // ====================================================
  // PAST YEARS ARCHIVE
  // ====================================================
  if (section === 'pastyears') {
    const historicalEnrollments = enrollmentHistory.filter(h => {
      const matchYear = h.academicYear === pastYear || h.year === pastYear;
      const matchSearch = pastSearch === '' ||
        (h.studentName || '').toLowerCase().includes(pastSearch.toLowerCase()) ||
        (h.admissionNumber || '').toLowerCase().includes(pastSearch.toLowerCase());
      return matchYear && matchSearch;
    });

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Historical Classes &amp; Past Years Archive
            </h2>
            <p className="text-[11px] text-slate-500">
              Audit past student class transitions, historical snapshots, and academic archives.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Academic Year:</span>
            <select
              value={pastYear}
              onChange={(e) => setPastYear(parseInt(e.target.value))}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold"
            >
              {[2026, 2025, 2024, 2023, 2022, 2021].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search archived students by name or admission number..."
            value={pastSearch}
            onChange={(e) => setPastSearch(e.target.value)}
            className="w-full bg-transparent text-xs outline-none"
          />
        </div>

        {/* Historical Enrollments List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Class Progression Archive &bull; Year {pastYear}
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              {historicalEnrollments.length} Records
            </span>
          </div>

          <div className="space-y-3">
            {historicalEnrollments.length === 0 ? (
              <div className="p-8 text-center text-slate-500 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
                No historical progression snapshots archived for year {pastYear}.
              </div>
            ) : (
              historicalEnrollments.map(h => {
                const isExpanded = !!expandedIds[h.id];
                return (
                  <div
                    key={h.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-colors"
                  >
                    <div
                      onClick={() => toggleExpand(h.id)}
                      className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <History className="w-4 h-4 text-blue-500" />
                        <div>
                          <h4 className="font-bold text-xs text-slate-900 dark:text-white">{h.studentName}</h4>
                          <div className="font-mono text-[10px] text-slate-400">{h.admissionNumber}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {h.previousClass || h.fromClass}
                          </span>
                          <span className="text-slate-400">&rarr;</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            {h.nextClass || h.toClass}
                          </span>
                        </div>
                        <button
                          onClick={() => toggleExpand(h.id)}
                          className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 cursor-pointer ml-1"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 pt-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/20 space-y-2 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <span className="text-slate-400 font-medium block">Source Stream:</span>
                            <span className="font-semibold text-slate-900 dark:text-slate-100 block mt-0.5">{h.previousClass || h.fromClass}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-medium block">Promoted Destination:</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">{h.nextClass || h.toClass}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-medium block">Academic Progression:</span>
                            <span className="text-slate-900 dark:text-slate-100 block mt-0.5">
                              {h.term} {h.academicYear || h.year}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-medium block">Authorized Registrar:</span>
                            <span className="text-slate-900 dark:text-slate-100 block mt-0.5">{h.promotedBy || 'Registrar Office'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  // ====================================================
  // STUDENT PROMOTION
  // ====================================================
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Academic Student Promotion &amp; Progression
          </h2>
          <p className="text-[11px] text-slate-500">
            Promote students to next class stream with automated enrollment snapshot logging.
          </p>
        </div>
        <button
          onClick={handlePromoteStudents}
          disabled={promoting || selectedStudentIds.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
        >
          <GraduationCap className="w-4 h-4" />
          {promoting ? 'Promoting Students...' : `Promote (${selectedStudentIds.length}) Selected Students`}
        </button>
      </div>

      {promoSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{promoSuccess}</span>
        </div>
      )}

      {promoError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{promoError}</span>
        </div>
      )}

      {/* Stream Selector */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-4">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Source Stream</label>
          <select
            value={sourceClass}
            onChange={(e) => {
              setSourceClass(e.target.value);
              setSelectedStudentIds([]);
            }}
            className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold"
          >
            {ALL_CLASSES.map(c => (
              <option key={c.display} value={c.display}>{c.display}</option>
            ))}
          </select>
        </div>
        <div className="pt-5 text-slate-400">
          <ArrowRight className="w-5 h-5" />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Destination Stream</label>
          <select
            value={targetClass}
            onChange={(e) => setTargetClass(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold text-emerald-600"
          >
            {ALL_CLASSES.map(c => (
              <option key={c.display} value={c.display}>{c.display}</option>
            ))}
          </select>
        </div>
        <div className="pt-5 text-xs text-slate-500">
          Session: <strong>{currentTerm} &bull; {currentYear}</strong>
        </div>
      </div>

      {/* Candidates Selection List (Collapsible cards) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={sourceStudents.length > 0 && selectedStudentIds.length === sourceStudents.length}
              onChange={toggleSelectAll}
              className="rounded cursor-pointer"
            />
            <span>Select All Candidates ({sourceStudents.length})</span>
          </label>
          <span className="text-xs text-blue-600 dark:text-blue-400 font-bold">
            {selectedStudentIds.length} Selected for Promotion
          </span>
        </div>

        <div className="space-y-3">
          {sourceStudents.length === 0 ? (
            <div className="p-8 text-center text-slate-500 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
              No active students enrolled in {sourceClass}.
            </div>
          ) : (
            sourceStudents.map(s => {
              const isSelected = selectedStudentIds.includes(s.id);
              const isExpanded = !!expandedIds[s.id];

              return (
                <div
                  key={s.id}
                  className={`rounded-xl border transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/20 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div
                    onClick={() => toggleSelectStudent(s.id)}
                    className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded cursor-pointer"
                      />
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white">{s.fullName}</h4>
                        <div className="font-mono text-[10px] text-slate-400">{s.admissionNumber}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        {s.status}
                      </span>
                      <button
                        onClick={() => toggleExpand(s.id)}
                        className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 cursor-pointer ml-1"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 pt-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/20 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 font-medium block">Current Stream:</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100 block mt-0.5">{s.className}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium block">Promoted Destination:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">{targetClass}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium block">Gender Profile:</span>
                        <span className="text-slate-900 dark:text-slate-100 block mt-0.5">{s.gender}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
