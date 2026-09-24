import React, { useState } from 'react';
import {
  collection,
  doc,
  setDoc,
  addDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Award,
  Users,
  Clock,
  Send,
  Save,
  Check,
  Megaphone,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useSchoolSettings } from '../../context/SchoolSettingsContext';
import {
  Student,
  Teacher,
  TimetableSlot,
  AttendanceRecord,
  ResultRecord,
  Announcement,
  TeacherSubmission,
  Subject,
} from '../../types';
import { ALL_CLASSES } from '../../constants/school';
import { getSubjectDisplayName } from '../../utils/subjectUtils';
import { formatAnnouncementDate } from '../../utils/dateUtils';

interface TeacherViewsProps {
  section: string;
  teacherProfile: Teacher | null;
  students: Student[];
  timetable: TimetableSlot[];
  subjects?: Subject[];
  attendance: AttendanceRecord[];
  results: ResultRecord[];
  announcements: Announcement[];
  onRefreshData: () => Promise<void>;
}

export const TeacherViews: React.FC<TeacherViewsProps> = ({
  section,
  teacherProfile,
  students,
  timetable,
  subjects = [],
  attendance,
  results,
  announcements,
  onRefreshData,
}) => {
  const { currentUser } = useAuth();
  const { currentTerm, currentYear } = useSchoolSettings();

  // Teacher assigned classes & subjects
  const assignedClasses = teacherProfile?.classAssignments && teacherProfile.classAssignments.length > 0
    ? teacherProfile.classAssignments
    : ['S.1T', 'S.2T', 'S.3T', 'S.4T'];

  const assignedSubjectOptions = React.useMemo(() => {
    const rawList = (teacherProfile?.subjects && teacherProfile.subjects.length > 0)
      ? teacherProfile.subjects
      : (subjects && subjects.length > 0)
      ? subjects.map(s => s.name || s.id)
      : ['Mathematics', 'English Language', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography'];

    const resolved = rawList.map(s => getSubjectDisplayName(s, subjects)).filter(Boolean);
    const unique = Array.from(new Set(resolved));
    return unique.length > 0 ? unique : ['Mathematics'];
  }, [teacherProfile?.subjects, subjects]);

  // Attendance State
  const [attClass, setAttClass] = useState(assignedClasses[0] || 'S.1T');
  const [attDate, setAttDate] = useState(new Date().toISOString().split('T')[0]);
  const [attStatusMap, setAttStatusMap] = useState<Record<string, 'present' | 'absent' | 'late'>>({});
  const [savingAtt, setSavingAtt] = useState(false);
  const [attSuccess, setAttSuccess] = useState<string | null>(null);
  const [attError, setAttError] = useState<string | null>(null);

  // Marks Entry State
  const [markClass, setMarkClass] = useState(assignedClasses[0] || 'S.1T');
  const [markSubject, setMarkSubject] = useState(assignedSubjectOptions[0] || 'Mathematics');
  const [examType, setExamType] = useState('BOT (Beginning of Term)');
  const [integrationType, setIntegrationType] = useState('Activity 1');
  const [scoresMap, setScoresMap] = useState<Record<string, { marks: number; comment: string }>>({});
  const [savingMarks, setSavingMarks] = useState(false);
  const [markSuccess, setMarkSuccess] = useState<string | null>(null);
  const [markError, setMarkError] = useState<string | null>(null);

  // Collapsible cards state
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Populate attendance status map for selected class
  const classStudentsForAtt = students.filter(s => s.className === attClass && s.status === 'active');
  const classStudentsForMarks = students.filter(s => s.className === markClass && s.status === 'active');

  const calculateGrade = (marks: number): string => {
    if (marks >= 80) return 'D1';
    if (marks >= 75) return 'D2';
    if (marks >= 66) return 'C3';
    if (marks >= 60) return 'C4';
    if (marks >= 55) return 'C5';
    if (marks >= 50) return 'C6';
    if (marks >= 45) return 'P7';
    if (marks >= 35) return 'P8';
    return 'F9';
  };

  // ====================================================
  // SAVE ATTENDANCE
  // ====================================================
  const handleSaveAttendance = async () => {
    setSavingAtt(true);
    setAttSuccess(null);
    setAttError(null);
    try {
      const batch = writeBatch(db);
      classStudentsForAtt.forEach(stu => {
        const docId = `${stu.id}_${attDate}`;
        const ref = doc(db, 'attendance', docId);
        const status = attStatusMap[stu.id] || 'present';

        batch.set(ref, {
          studentId: stu.id,
          studentName: stu.fullName,
          className: attClass,
          date: attDate,
          status,
          term: currentTerm,
          year: currentYear,
          recordedBy: teacherProfile?.fullName || currentUser?.displayName || 'Faculty Teacher',
          teacherId: teacherProfile?.id || currentUser?.uid,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      });

      await batch.commit();
      setAttSuccess(`Roll call saved for ${classStudentsForAtt.length} students on ${attDate}!`);
      await onRefreshData();
    } catch (err: any) {
      console.error("Attendance save error:", err);
      setAttError(`[${err.code || 'ATT_ERROR'}] ${err.message || 'Failed to save attendance records.'}`);
    } finally {
      setSavingAtt(false);
    }
  };

  // ====================================================
  // SUBMIT MARKS TO ADMIN FOR VERIFICATION & PUBLISHING
  // ====================================================
  const handleSubmitMarks = async (mode: 'draft' | 'submitted') => {
    setSavingMarks(true);
    setMarkSuccess(null);
    setMarkError(null);
    try {
      if (mode === 'submitted') {
        const missing = classStudentsForMarks.filter(stu => {
          const item = scoresMap[stu.id];
          return !item || item.marks === undefined || item.marks === null || isNaN(Number(item.marks));
        });
        if (missing.length > 0) {
          setMarkError(`Explicit marks are required for all students before submission. Please enter marks for: ${missing.slice(0, 3).map(s => s.fullName).join(', ')}${missing.length > 3 ? ` and ${missing.length - 3} others.` : '.'}`);
          setSavingMarks(false);
          return;
        }
      }

      const studentRecords = classStudentsForMarks.map(stu => {
        const item = scoresMap[stu.id] || { marks: 0, comment: 'Standard evaluation.' };
        const numericMark = Number(item.marks || 0);
        const grade = calculateGrade(numericMark);
        return {
          studentId: stu.id,
          studentName: stu.fullName,
          admissionNumber: stu.admissionNumber,
          marks: numericMark,
          score: numericMark,
          grade,
          comment: item.comment || 'Continuous assessment',
          remarks: item.comment || 'Continuous assessment',
        };
      });

      const effectiveExamType =
        examType === 'Activity Of Integration'
          ? `Activity Of Integration (${integrationType})`
          : examType;

      const displayName = getSubjectDisplayName(markSubject, subjects);
      const matchedSubjectObj = subjects.find(
        s => s.name?.toLowerCase() === displayName.toLowerCase() || s.id === markSubject
      );
      const subjectDocId = matchedSubjectObj ? matchedSubjectObj.id : markSubject;

      // Write to teacherSubmissions collection only
      const submissionRef = doc(collection(db, 'teacherSubmissions'));
      await setDoc(submissionRef, {
        teacherId: teacherProfile?.id || currentUser?.uid,
        teacherName: teacherProfile?.fullName || currentUser?.displayName || 'Faculty Teacher',
        subjectName: displayName,
        subjectId: subjectDocId,
        subject: displayName,
        className: markClass,
        examType: effectiveExamType,
        term: currentTerm,
        academicYear: currentYear,
        year: currentYear,
        status: mode,
        studentCount: studentRecords.length,
        studentRecords,
        items: studentRecords,
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setMarkSuccess(
        mode === 'submitted'
          ? `Marks submission for ${markClass} - ${displayName} (${studentRecords.length} students) sent to administration for verification and approval!`
          : `Draft saved successfully for ${markClass} - ${displayName}.`
      );
      await onRefreshData();
    } catch (err: any) {
      console.error("Marks submission error:", err);
      setMarkError(`[${err.code || 'MARKS_ERROR'}] ${err.message || 'Failed to submit marks.'}`);
    } finally {
      setSavingMarks(false);
    }
  };

  // ====================================================
  // 1. DASHBOARD
  // ====================================================
  if (section === 'dashboard') {
    const myLessons = timetable.filter(t => {
      const matchId = t.teacherId && (t.teacherId === teacherProfile?.id || t.teacherId === currentUser?.uid);
      const matchEmail = teacherProfile?.email && (t as any).teacherEmail && (t as any).teacherEmail.toLowerCase() === teacherProfile.email.toLowerCase();
      const matchName = (t as any).teacherName && teacherProfile?.fullName && (t as any).teacherName.toLowerCase() === teacherProfile.fullName.toLowerCase();
      return matchId || matchEmail || matchName;
    });

    return (
      <div className="space-y-6">
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Faculty Instructor Portal &bull; {teacherProfile?.fullName || currentUser?.displayName || 'Faculty Staff'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Term: <strong>{currentTerm} ({currentYear})</strong> &bull; Assigned Streams: {assignedClasses.join(', ')}
              </p>
            </div>
            <div className="flex gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                Active Faculty Member
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
              <div className="text-2xl font-black text-blue-600">{assignedClasses.length}</div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">
                Assigned Streams
              </div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
              <div className="text-2xl font-black text-emerald-600">{assignedSubjectOptions.length}</div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">
                Subjects Taught
              </div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
              <div className="text-2xl font-black text-amber-600">{myLessons.length}</div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">
                Scheduled Lessons / Week
              </div>
            </div>
          </div>
        </div>

        {/* Assigned Classes Quick Summary */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            My Class Enrolments
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {assignedClasses.map(cls => {
              const count = students.filter(s => s.className === cls && s.status === 'active').length;
              return (
                <div key={cls} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">{cls}</h4>
                    <span className="text-[10px] text-slate-400">Class Stream</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600">
                    {count} Students
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ====================================================
  // 2. ATTENDANCE ROLL CALL
  // ====================================================
  if (section === 'attendance') {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Class Attendance &amp; Daily Roll Call
            </h2>
            <p className="text-[11px] text-slate-500">
              Record daily attendance for your assigned streams.
            </p>
          </div>
          <button
            onClick={handleSaveAttendance}
            disabled={savingAtt}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {savingAtt ? 'Saving...' : 'Save Roll Call'}
          </button>
        </div>

        {attSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{attSuccess}</span>
          </div>
        )}

        {attError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{attError}</span>
          </div>
        )}

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Class Stream</label>
            <select
              value={attClass}
              onChange={(e) => setAttClass(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold"
            >
              {assignedClasses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Roll Call Date</label>
            <input
              type="date"
              value={attDate}
              onChange={(e) => setAttDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold"
            />
          </div>
          <div className="pt-4 text-xs text-slate-500">
            Total Students: <strong>{classStudentsForAtt.length}</strong>
          </div>
        </div>

        {/* Student Roll Call List (Collapsible cards) */}
        <div className="space-y-2.5">
          {classStudentsForAtt.map(s => {
            const currentStatus = attStatusMap[s.id] || 'present';
            return (
              <div
                key={s.id}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 shadow-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                    {s.admissionNumber}
                  </span>
                  <span className="font-bold text-xs text-slate-900 dark:text-white">{s.fullName}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {(['present', 'absent', 'late'] as const).map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setAttStatusMap(prev => ({ ...prev, [s.id]: st }))}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize cursor-pointer transition-all ${
                        currentStatus === st
                          ? st === 'present'
                            ? 'bg-emerald-600 text-white font-bold shadow-xs'
                            : st === 'absent'
                            ? 'bg-rose-600 text-white font-bold shadow-xs'
                            : 'bg-amber-600 text-white font-bold shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ====================================================
  // 3. CONTINUOUS MARKS ENTRY
  // ====================================================
  if (section === 'results' || section === 'marks') {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Continuous Assessment &amp; Marks Entry
            </h2>
            <p className="text-[11px] text-slate-500">
              Enter exam marks, grades, and remarks for your assigned subjects.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSubmitMarks('draft')}
              disabled={savingMarks}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 transition-colors cursor-pointer disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              onClick={() => handleSubmitMarks('submitted')}
              disabled={savingMarks}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {savingMarks ? 'Publishing...' : 'Submit &amp; Publish'}
            </button>
          </div>
        </div>

        {markSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{markSuccess}</span>
          </div>
        )}

        {markError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{markError}</span>
          </div>
        )}

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-4 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Class Stream</label>
            <select
              value={markClass}
              onChange={(e) => setMarkClass(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold"
            >
              {assignedClasses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Curriculum Subject</label>
            <select
              value={markSubject}
              onChange={(e) => setMarkSubject(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold text-slate-900 dark:text-white"
            >
              {assignedSubjectOptions.map(s => {
                const displayName = getSubjectDisplayName(s, subjects);
                return (
                  <option key={s} value={displayName}>
                    {displayName}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Assessment Type</label>
            <select
              value={examType}
              onChange={(e) => setExamType(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold"
            >
              <option value="Beginning of Term (BOT)">Beginning of Term (BOT)</option>
              <option value="Mid-Term Assessment (MOT)">Mid-Term Assessment (MOT)</option>
              <option value="End of Term Examination (EOT)">End of Term Examination (EOT)</option>
              <option value="Activity Of Integration">Activity Of Integration</option>
            </select>
          </div>

          {examType === 'Activity Of Integration' && (
            <div>
              <label className="block text-[11px] font-semibold text-blue-600 dark:text-blue-400 mb-1">Activity of Integration (1 to 10)</label>
              <select
                value={integrationType}
                onChange={(e) => setIntegrationType(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-blue-500/50 dark:border-blue-400/50 bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold"
              >
                <option value="Activity 1">Activity 1</option>
                <option value="Activity 2">Activity 2</option>
                <option value="Activity 3">Activity 3</option>
                <option value="Activity 4">Activity 4</option>
                <option value="Activity 5">Activity 5</option>
                <option value="Activity 6">Activity 6</option>
                <option value="Activity 7">Activity 7</option>
                <option value="Activity 8">Activity 8</option>
                <option value="Activity 9">Activity 9</option>
                <option value="Activity 10">Activity 10</option>
              </select>
            </div>
          )}
        </div>

        {/* Scores Entry Table (Collapsible cards) */}
        <div className="space-y-3">
          {classStudentsForMarks.map(s => {
            const currentScore = scoresMap[s.id]?.marks ?? 65;
            const currentComment = scoresMap[s.id]?.comment ?? 'Satisfactory effort; continue improving.';
            const grade = calculateGrade(currentScore);

            return (
              <div
                key={s.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                      {s.admissionNumber}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white text-xs">{s.fullName}</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    Grade {grade}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1 font-semibold">Marks (0-100)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={currentScore}
                      onChange={(e) => {
                        const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                        setScoresMap(prev => ({
                          ...prev,
                          [s.id]: { marks: val, comment: currentComment },
                        }));
                      }}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] text-slate-400 mb-1 font-semibold">Teacher Remark / Comment</label>
                    <input
                      type="text"
                      value={currentComment}
                      onChange={(e) => {
                        const txt = e.target.value;
                        setScoresMap(prev => ({
                          ...prev,
                          [s.id]: { marks: currentScore, comment: txt },
                        }));
                      }}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ====================================================
  // 4. TIMETABLE
  // ====================================================
  if (section === 'timetable') {
    const myLessons = timetable.filter(t => {
      const matchId = t.teacherId && (t.teacherId === teacherProfile?.id || t.teacherId === currentUser?.uid);
      const matchEmail = teacherProfile?.email && (t as any).teacherEmail && (t as any).teacherEmail.toLowerCase() === teacherProfile.email.toLowerCase();
      const matchName = (t as any).teacherName && teacherProfile?.fullName && (t as any).teacherName.toLowerCase() === teacherProfile.fullName.toLowerCase();
      return matchId || matchEmail || matchName;
    });

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              My Teaching Schedule &bull; Allocated Lessons ({myLessons.length})
            </h2>
            <p className="text-[11px] text-slate-500">
              Assigned classes, timings, and rooms for {teacherProfile?.fullName || 'Faculty'}.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 w-fit">
            Academic Year {currentYear} &bull; {currentTerm}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {myLessons.length === 0 ? (
            <div className="col-span-full p-8 text-center text-slate-400 text-xs bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 italic">
              No timetable lessons assigned to your profile yet. Lessons scheduled by administrator will appear here automatically.
            </div>
          ) : (
            myLessons
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
              .map(l => {
                const subName = getSubjectDisplayName(l.subjectName || l.subjectId, subjects);
                return (
                  <div key={l.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs text-xs space-y-2.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
                          {subName}
                        </h4>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          {l.dayOfWeek}
                        </span>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        {l.className}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Allocated Time:</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{l.startTime} &ndash; {l.endTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Allocated Stream:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{l.className}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Classroom:</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{l.room || 'Main Classroom'}</span>
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>
    );
  }

  // ====================================================
  // 5. ANNOUNCEMENTS
  // ====================================================
  if (section === 'announcements') {
    return (
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          School Announcements &amp; Circulars
        </h2>

        <div className="space-y-3">
          {announcements.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 italic">
              No circulars published at this time.
            </div>
          ) : (
            announcements.map(a => (
              <div key={a.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white">{a.title}</span>
                  <span className="text-[10px] text-slate-400">{a.audience}</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{a.message}</p>
                {formatAnnouncementDate(a.createdAt) && (
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium pt-1">
                    {formatAnnouncementDate(a.createdAt)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return null;
};
