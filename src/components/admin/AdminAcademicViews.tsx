import React, { useState } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import {
  School,
  BookOpen,
  Calendar,
  UserCheck,
  Award,
  CreditCard,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Edit,
  X,
  Check,
} from 'lucide-react';
import { ALL_CLASSES } from '../../constants/school';
import { useSchoolSettings } from '../../context/SchoolSettingsContext';
import {
  Student,
  Teacher,
  TimetableSlot,
  AttendanceRecord,
  ResultRecord,
  PaymentRecord,
  Subject,
} from '../../types';
import { getSubjectDisplayName } from '../../utils/subjectUtils';

interface AdminAcademicViewsProps {
  section: 'classes' | 'subjects' | 'timetable' | 'attendance' | 'results' | 'payments';
  students: Student[];
  teachers: Teacher[];
  subjects: Subject[];
  timetable: TimetableSlot[];
  attendance: AttendanceRecord[];
  results: ResultRecord[];
  payments: PaymentRecord[];
  onNavigate: (sec: string) => void;
  onRefreshData?: () => Promise<void> | void;
  onRequestConfirm?: (title: string, message: string, onConfirmAction: () => Promise<void>) => void;
  onShowFeedback?: (type: 'loading' | 'success' | 'error', message: string, title?: string) => void;
}

export const AdminAcademicViews: React.FC<AdminAcademicViewsProps> = ({
  section,
  students,
  teachers,
  subjects,
  timetable,
  attendance,
  results,
  payments,
  onNavigate,
  onRefreshData,
  onRequestConfirm,
  onShowFeedback,
}) => {
  const { settings, currentTerm, currentYear } = useSchoolSettings();

  // Filters
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedSubject, setSelectedSubject] = useState('ALL');
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Collapsible state: ALL tabulated lists collapsible by default
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Modals & Action state for Timetable and Subjects
  const [modalType, setModalType] = useState<'addTimetable' | 'addSubject' | null>(null);
  const [editingTimetable, setEditingTimetable] = useState<TimetableSlot | null>(null);
  const [ttClass, setTtClass] = useState('S.1 North');
  const [ttDay, setTtDay] = useState('Monday');
  const [ttSubject, setTtSubject] = useState('');
  const [ttTeacher, setTtTeacher] = useState('');
  const [ttStart, setTtStart] = useState('08:00');
  const [ttEnd, setTtEnd] = useState('09:20');
  const [ttRoom, setTtRoom] = useState('Main Classroom');

  const [subName, setSubName] = useState('');
  const [subCode, setSubCode] = useState('');
  const [subDept, setSubDept] = useState('Sciences');
  const [subLevel, setSubLevel] = useState<'O-Level' | 'A-Level' | 'Both'>('Both');
  const [subCat, setSubCat] = useState<'Core' | 'Elective'>('Core');

  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [key]: prev[key] === undefined ? true : !prev[key], // starts collapsed by default if not set or false!
    }));
  };

  // If a group is not explicitly in collapsedGroups, default to collapsed (isExpanded = !!collapsedGroups[key])
  const isExpanded = (key: string) => !!collapsedGroups[key];

  const fmtUGX = (val: number) => {
    return (val || 0).toLocaleString() + ' ' + (settings.currency || 'UGX');
  };

  // Add / Edit Timetable Slot handler
  const handleSaveTimetable = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setSubmitting(true);
    try {
      if (!ttTeacher || !ttTeacher.trim()) {
        setActionError('Please select an assigned faculty teacher for this lesson slot.');
        setSubmitting(false);
        return;
      }

      const assignedTeacher = teachers.find(t => t.id === ttTeacher);
      if (!assignedTeacher) {
        setActionError('Selected teacher was not found in faculty staff list. Please choose a valid instructor.');
        setSubmitting(false);
        return;
      }

      // Check for scheduling conflicts (same teacher or same class at the same day/period)
      const hasOverlap = (startA: string, endA: string, startB: string, endB: string) => {
        return startA < endB && endA > startB;
      };

      const conflict = timetable.find(slot => {
        if (editingTimetable && slot.id === editingTimetable.id) return false;
        if (slot.dayOfWeek !== ttDay) return false;
        if (slot.term !== currentTerm || (slot.academicYear && slot.academicYear !== currentYear)) return false;

        const timeCollides = hasOverlap(ttStart, ttEnd, slot.startTime, slot.endTime);
        if (!timeCollides) return false;

        if (slot.className === ttClass) {
          return true; // class is already booked at this time!
        }
        if (slot.teacherId === ttTeacher) {
          return true; // teacher is already teaching another class at this time!
        }
        return false;
      });

      if (conflict) {
        if (conflict.className === ttClass) {
          setActionError(`Scheduling conflict: Class ${ttClass} already has a scheduled lesson (${conflict.subjectName || 'Lesson'} by ${conflict.teacherName}) on ${ttDay} between ${conflict.startTime} - ${conflict.endTime}.`);
        } else {
          setActionError(`Faculty conflict: Teacher ${assignedTeacher.fullName} is already assigned to teach ${conflict.className} (${conflict.subjectName || 'Lesson'}) on ${ttDay} between ${conflict.startTime} - ${conflict.endTime}.`);
        }
        setSubmitting(false);
        return;
      }

      const selectedSubObj = subjects.find(s => s.id === ttSubject || s.name.toLowerCase() === ttSubject.toLowerCase());
      const resolvedSubName = selectedSubObj ? selectedSubObj.name : ttSubject.trim();
      const resolvedSubId = selectedSubObj ? selectedSubObj.id : (ttSubject.trim() || 'General Studies');

      const timetableData = {
        className: ttClass,
        dayOfWeek: ttDay,
        subjectId: resolvedSubId,
        subjectName: resolvedSubName,
        teacherId: assignedTeacher.id,
        teacherName: assignedTeacher.fullName,
        teacherEmail: assignedTeacher.email || '',
        startTime: ttStart,
        endTime: ttEnd,
        room: ttRoom.trim() || 'Classroom',
        term: currentTerm,
        academicYear: currentYear,
        updatedAt: serverTimestamp(),
      };

      if (editingTimetable) {
        await updateDoc(doc(db, 'timetable', editingTimetable.id), timetableData);
        setActionSuccess(`Timetable lesson for ${ttClass} (${resolvedSubName}) updated successfully!`);
        if (onShowFeedback) onShowFeedback('success', `Timetable lesson for ${ttClass} (${resolvedSubName}) updated successfully!`);
      } else {
        await addDoc(collection(db, 'timetable'), {
          ...timetableData,
          createdAt: serverTimestamp(),
        });
        setActionSuccess(`Timetable lesson for ${ttClass} (${resolvedSubName}) scheduled successfully!`);
        if (onShowFeedback) onShowFeedback('success', `Timetable lesson for ${ttClass} (${resolvedSubName}) scheduled successfully!`);
      }

      setModalType(null);
      setEditingTimetable(null);
      if (onRefreshData) await onRefreshData();
    } catch (err: any) {
      console.error("Save timetable error:", err);
      setActionError(`[${err.code || 'TIMETABLE_ERROR'}] ${err.message || 'Failed to save timetable entry.'}`);
      if (onShowFeedback) onShowFeedback('error', err.message || 'Failed to save timetable entry.');
    } finally {
      setSubmitting(false);
    }
  };

  // Add Subject handler
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'subjects'), {
        name: subName.trim(),
        code: subCode.trim().toUpperCase() || subName.slice(0, 3).toUpperCase(),
        department: subDept,
        level: subLevel,
        category: subCat,
        createdAt: serverTimestamp(),
      });
      setActionSuccess(`Subject "${subName}" created successfully!`);
      if (onShowFeedback) onShowFeedback('success', `Subject "${subName}" created successfully!`);
      setModalType(null);
      setSubName('');
      setSubCode('');
      if (onRefreshData) await onRefreshData();
    } catch (err: any) {
      console.error("Add subject error:", err);
      setActionError(`[${err.code || 'SUBJECT_ERROR'}] ${err.message || 'Failed to create subject.'}`);
      if (onShowFeedback) onShowFeedback('error', err.message || 'Failed to create subject.');
    } finally {
      setSubmitting(false);
    }
  };

  // ====================================================
  // 1. CLASSES & STREAMS
  // ====================================================
  if (section === 'classes') {
    const oLevel = ALL_CLASSES.filter(c => c.type === 'O-Level');
    const aLevel = ALL_CLASSES.filter(c => c.type === 'A-Level');

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Class Streams &amp; Organization
          </h2>
          <span className="text-xs text-slate-500">{ALL_CLASSES.length} Configured Streams</span>
        </div>

        {/* Collapsible O-Level Section (Collapsed by default) */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
          <button
            onClick={() => toggleGroup('olevel')}
            className="w-full p-4 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <School className="w-4 h-4 text-blue-500" />
              <span className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white">
                O-Level Streams (S.1 &ndash; S.4) &bull; {oLevel.length} Streams
              </span>
            </div>
            {isExpanded('olevel') ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {isExpanded('olevel') && (
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 border-t border-slate-200 dark:border-slate-800">
              {oLevel.map(cls => {
                const classStudents = students.filter(s => s.className === cls.display);
                const activeCount = classStudents.filter(s => s.status === 'active').length;
                return (
                  <div key={cls.display} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">{cls.display}</h4>
                      <p className="text-[10px] text-slate-400">Stream {cls.stream}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600">
                      {activeCount} Active
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Collapsible A-Level Section (Collapsed by default) */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
          <button
            onClick={() => toggleGroup('alevel')}
            className="w-full p-4 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <School className="w-4 h-4 text-emerald-500" />
              <span className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white">
                A-Level Streams (S.5 &ndash; S.6) &bull; {aLevel.length} Streams
              </span>
            </div>
            {isExpanded('alevel') ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {isExpanded('alevel') && (
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 border-t border-slate-200 dark:border-slate-800">
              {aLevel.map(cls => {
                const classStudents = students.filter(s => s.className === cls.display);
                const activeCount = classStudents.filter(s => s.status === 'active').length;
                return (
                  <div key={cls.display} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">{cls.display}</h4>
                      <p className="text-[10px] text-slate-400">{cls.stream} Division</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600">
                      {activeCount} Active
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ====================================================
  // 2. CURRICULUM SUBJECTS (Collapsible by default)
  // ====================================================
  if (section === 'subjects') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Curriculum Subjects &amp; Departments
            </h2>
            <span className="text-xs text-slate-500">{subjects.length} Subjects Configured</span>
          </div>
          <button
            onClick={() => {
              setSubName('');
              setSubCode('');
              setModalType('addSubject');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" /> + Add Subject
          </button>
        </div>

        {actionSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{actionSuccess}</span>
          </div>
        )}

        <div className="space-y-3">
          {subjects.map(s => {
            const assignedTeachers = teachers.filter(t => t.subjects?.includes(s.name));
            const isItemExpanded = isExpanded(`sub_${s.id}`);

            return (
              <div
                key={s.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-colors"
              >
                <div
                  onClick={() => toggleGroup(`sub_${s.id}`)}
                  className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      {s.code || 'SUB'}
                    </span>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">{s.name}</h4>
                      <span className="text-[10px] text-slate-400">{s.level || s.classLevel || 'All Classes'} &bull; {assignedTeachers.length} Staff</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {s.category || 'Core'}
                    </span>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (onRequestConfirm) {
                          onRequestConfirm('Delete Subject', `Are you sure you want to delete subject "${s.name}"?`, async () => {
                            await deleteDoc(doc(db, 'subjects', s.id));
                            if (onRefreshData) await onRefreshData();
                          });
                        } else {
                          await deleteDoc(doc(db, 'subjects', s.id));
                          if (onRefreshData) await onRefreshData();
                        }
                      }}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Delete Subject"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {isItemExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>

                {isItemExpanded && (
                  <div className="p-4 pt-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/20 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 font-medium block">Department:</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 block mt-0.5">{s.department || 'General Academic'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">Level Qualification:</span>
                      <span className="text-slate-900 dark:text-slate-100 block mt-0.5">{s.level || s.classLevel || 'All Levels'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">Specialized Instructors:</span>
                      <span className="text-slate-900 dark:text-slate-100 block mt-0.5 font-medium">
                        {assignedTeachers.length > 0 ? assignedTeachers.map(t => t.fullName).join(', ') : 'Staff allocation pending'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ADD SUBJECT MODAL */}
        {modalType === 'addSubject' && (
          <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-500" />
                  Add Curriculum Subject
                </h3>
                <button onClick={() => setModalType(null)} className="text-slate-500 p-1 cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              {actionError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
                  {actionError}
                </div>
              )}

              <form onSubmit={handleAddSubject} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Subject Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Physics, History, Agriculture"
                    value={subName}
                    onChange={(e) => setSubName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Code</label>
                    <input
                      type="text"
                      placeholder="e.g. PHY, HIS"
                      value={subCode}
                      onChange={(e) => setSubCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Department</label>
                    <select
                      value={subDept}
                      onChange={(e) => setSubDept(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                    >
                      <option value="Sciences">Sciences</option>
                      <option value="Humanities">Humanities</option>
                      <option value="Languages">Languages</option>
                      <option value="Mathematics">Mathematics</option>
                      <option value="Vocational">Vocational</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Level Qualification</label>
                    <select
                      value={subLevel}
                      onChange={(e) => setSubLevel(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                    >
                      <option value="Both">Both (O &amp; A Level)</option>
                      <option value="O-Level">O-Level Only</option>
                      <option value="A-Level">A-Level Only</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Category</label>
                    <select
                      value={subCat}
                      onChange={(e) => setSubCat(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                    >
                      <option value="Core">Core</option>
                      <option value="Elective">Elective</option>
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
                    {submitting ? 'Saving...' : 'Save Subject'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ====================================================
  // 3. MASTER TIMETABLE (Collapsible by class stream, collapsed by default)
  // ====================================================
  if (section === 'timetable') {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Group timetable by class
    const classesToShow = selectedClass === 'ALL'
      ? ALL_CLASSES.map(c => c.display)
      : [selectedClass];

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Master Timetable Schedules
            </h2>
            <p className="text-[11px] text-slate-500">
              Weekly class schedules collapsible by class stream.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditingTimetable(null);
                setTtClass(selectedClass !== 'ALL' ? selectedClass : 'S.1 North');
                setTtDay('Monday');
                setTtSubject(subjects[0]?.name || 'Mathematics');
                setTtTeacher(teachers[0]?.id || '');
                setTtStart('08:00');
                setTtEnd('09:20');
                setTtRoom('Room 1');
                setModalType('addTimetable');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" /> + Add Lesson Slot
            </button>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold"
            >
              <option value="ALL">All Streams</option>
              {ALL_CLASSES.map(c => (
                <option key={c.display} value={c.display}>{c.display}</option>
              ))}
            </select>
          </div>
        </div>

        {actionSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Collapsible class timetable cohorts (collapsed by default) */}
        <div className="space-y-3">
          {classesToShow.map(clsName => {
            const slots = timetable.filter(t => t.className === clsName);
            const isClassExpanded = isExpanded(`tt_${clsName}`);

            return (
              <div
                key={clsName}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-colors"
              >
                <div
                  onClick={() => toggleGroup(`tt_${clsName}`)}
                  className="p-4 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    <span className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                      {clsName} Master Schedule
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600">
                      {slots.length} Lessons / Week
                    </span>
                  </div>
                  {isClassExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>

                {isClassExpanded && (
                  <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    {slots.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">No timetable entries set for {clsName}.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {slots
                          .sort((a, b) => a.startTime.localeCompare(b.startTime))
                          .map(slot => {
                            const teacherObj = teachers.find(t => t.id === slot.teacherId);
                            const teacherName = teacherObj?.fullName || slot.teacherName || 'Assigned Staff';
                            const subjectName = getSubjectDisplayName(slot.subjectName || slot.subjectId, subjects);

                            return (
                              <div key={slot.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 shadow-xs text-xs space-y-2">
                                <div className="flex justify-between items-start gap-2">
                                  <div>
                                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
                                      {subjectName}
                                    </h4>
                                    <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                      {slot.dayOfWeek}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingTimetable(slot);
                                        setTtClass(slot.className);
                                        setTtDay(slot.dayOfWeek);
                                        setTtSubject(slot.subjectName || getSubjectDisplayName(slot.subjectId, subjects));
                                        setTtTeacher(slot.teacherId || '');
                                        setTtStart(slot.startTime);
                                        setTtEnd(slot.endTime);
                                        setTtRoom(slot.room || 'Room 1');
                                        setModalType('addTimetable');
                                      }}
                                      className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                                      title="Edit Lesson Slot"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (onRequestConfirm) {
                                          onRequestConfirm('Delete Lesson Slot', `Are you sure you want to delete the timetable slot for ${subjectName}?`, async () => {
                                            await deleteDoc(doc(db, 'timetable', slot.id));
                                            if (onRefreshData) await onRefreshData();
                                          });
                                        } else {
                                          await deleteDoc(doc(db, 'timetable', slot.id));
                                          if (onRefreshData) await onRefreshData();
                                        }
                                      }}
                                      className="p-1.5 rounded-md text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                      title="Delete Lesson Slot"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] space-y-1 text-slate-600 dark:text-slate-400">
                                  <div className="flex justify-between">
                                    <span className="text-slate-400 font-medium">Time:</span>
                                    <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{slot.startTime} &ndash; {slot.endTime}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400 font-medium">Room:</span>
                                    <span className="font-medium text-slate-700 dark:text-slate-300">{slot.room || 'Classroom'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400 font-medium">Teacher:</span>
                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{teacherName}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ADD / EDIT TIMETABLE MODAL */}
        {modalType === 'addTimetable' && (
          <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  {editingTimetable ? 'Edit Timetable Lesson Slot' : 'Add Timetable Lesson Slot'}
                </h3>
                <button onClick={() => setModalType(null)} className="text-slate-500 p-1 cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              {actionError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
                  {actionError}
                </div>
              )}

              <form onSubmit={handleSaveTimetable} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Class Stream</label>
                    <select
                      value={ttClass}
                      onChange={(e) => setTtClass(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold"
                    >
                      {ALL_CLASSES.map(c => <option key={c.display} value={c.display}>{c.display}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Day of Week</label>
                    <select
                      value={ttDay}
                      onChange={(e) => setTtDay(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold"
                    >
                      {days.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Subject</label>
                    <select
                      value={ttSubject}
                      onChange={(e) => setTtSubject(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                      required
                    >
                      <option value="">-- Choose Subject --</option>
                      {subjects.map(s => <option key={s.id} value={s.name}>{s.name} ({s.code || s.name})</option>)}
                      <option value="Mathematics">Mathematics</option>
                      <option value="English">English</option>
                      <option value="Physics">Physics</option>
                      <option value="Chemistry">Chemistry</option>
                      <option value="Biology">Biology</option>
                      <option value="Geography">Geography</option>
                      <option value="History">History</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Assigned Teacher</label>
                    <select
                      value={ttTeacher}
                      onChange={(e) => setTtTeacher(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                      required
                    >
                      <option value="">-- Choose Faculty --</option>
                      {teachers.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-semibold mb-1">Start Time</label>
                    <input
                      type="time"
                      value={ttStart}
                      onChange={(e) => setTtStart(e.target.value)}
                      className="w-full px-2 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">End Time</label>
                    <input
                      type="time"
                      value={ttEnd}
                      onChange={(e) => setTtEnd(e.target.value)}
                      className="w-full px-2 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Room</label>
                    <input
                      type="text"
                      placeholder="e.g. Lab 1"
                      value={ttRoom}
                      onChange={(e) => setTtRoom(e.target.value)}
                      className="w-full px-2 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                    />
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
                    {submitting ? 'Saving...' : editingTimetable ? 'Update Lesson Slot' : 'Schedule Lesson Slot'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ====================================================
  // 4. ATTENDANCE (Collapsible by class stream, collapsed by default)
  // ====================================================
  if (section === 'attendance') {
    const classesToShow = selectedClass === 'ALL'
      ? ALL_CLASSES.map(c => c.display)
      : [selectedClass];

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Student Attendance Logs
            </h2>
            <p className="text-[11px] text-slate-500">
              Daily roll call logs collapsible by class stream.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold"
            >
              <option value="ALL">All Streams</option>
              {ALL_CLASSES.map(c => (
                <option key={c.display} value={c.display}>{c.display}</option>
              ))}
            </select>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold"
            />
          </div>
        </div>

        <div className="space-y-3">
          {classesToShow.map(clsName => {
            const records = attendance.filter(
              a => a.className === clsName && (selectedDate === '' || a.date === selectedDate)
            );
            const isClassExpanded = isExpanded(`att_${clsName}`);

            return (
              <div
                key={clsName}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-colors"
              >
                <div
                  onClick={() => toggleGroup(`att_${clsName}`)}
                  className="p-4 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-500" />
                    <span className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                      {clsName} Roll Call &bull; {selectedDate}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600">
                      {records.length} Recorded
                    </span>
                  </div>
                  {isClassExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>

                {isClassExpanded && (
                  <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    {records.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">No attendance records logged for {clsName} on {selectedDate}.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {records.map(a => {
                          const stu = students.find(s => s.id === a.studentId);
                          return (
                            <div key={a.id || `${a.studentId}_${a.date}`} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-xs flex justify-between items-center">
                              <div>
                                <h4 className="font-bold text-xs text-slate-900 dark:text-white">{stu?.fullName || 'Student Ward'}</h4>
                                <span className="text-[10px] text-slate-400 font-mono">{stu?.admissionNumber}</span>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                a.status === 'present'
                                  ? 'bg-emerald-500/10 text-emerald-600'
                                  : a.status === 'absent'
                                  ? 'bg-rose-500/10 text-rose-600'
                                  : 'bg-amber-500/10 text-amber-600'
                              }`}>
                                {a.status}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ====================================================
  // 5. RESULTS (Collapsible by class stream, collapsed by default)
  // ====================================================
  if (section === 'results') {
    const classesToShow = selectedClass === 'ALL'
      ? ALL_CLASSES.map(c => c.display)
      : [selectedClass];

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Official Assessment Results Dossier
            </h2>
            <p className="text-[11px] text-slate-500">
              Verified student scores grouped and collapsible by class stream.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold"
            >
              <option value="ALL">All Streams</option>
              {ALL_CLASSES.map(c => (
                <option key={c.display} value={c.display}>{c.display}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-3">
          {classesToShow.map(clsName => {
            const classResults = results.filter(r => r.className === clsName);
            const isClassExpanded = isExpanded(`res_${clsName}`);

            return (
              <div
                key={clsName}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-colors"
              >
                <div
                  onClick={() => toggleGroup(`res_${clsName}`)}
                  className="p-4 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-blue-500" />
                    <span className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                      {clsName} Assessment Results
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600">
                      {classResults.length} Marks Published
                    </span>
                  </div>
                  {isClassExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>

                {isClassExpanded && (
                  <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    {classResults.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">No results published for {clsName} yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {classResults.map(r => {
                          const stu = students.find(s => s.id === r.studentId);
                          return (
                            <div key={r.id || `${r.studentId}_${r.subjectId}`} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-xs">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-xs text-slate-900 dark:text-white">{stu?.fullName || 'Student'}</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                                  Grade {r.grade}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {getSubjectDisplayName(r.subjectName || r.subjectId, subjects)} &bull; <strong className="text-blue-600 dark:text-blue-400">{r.marks}%</strong> &bull; {r.examType}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ====================================================
  // 6. PAYMENTS (Collapsible by month/batch, collapsed by default)
  // ====================================================
  if (section === 'payments') {
    const isPaymentsExpanded = isExpanded('payments_stream');

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Cleared Payments &amp; Receipts Stream
          </h2>
          <span className="text-xs text-slate-500">{payments.length} Cleared Vouchers</span>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-colors">
          <div
            onClick={() => toggleGroup('payments_stream')}
            className="p-4 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-500" />
              <span className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                Audited Cleared Transactions Ledger ({payments.length})
              </span>
            </div>
            {isPaymentsExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>

          {isPaymentsExpanded && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              {payments.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No cleared payment vouchers in stream.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {payments.map(p => {
                    const stu = students.find(s => s.id === p.studentId);
                    return (
                      <div key={p.id} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-xs space-y-1">
                        <div className="flex justify-between items-center pb-1 border-b border-slate-200/60 dark:border-slate-800">
                          <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">{p.receiptNumber || p.transactionRef}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">Reconciled</span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span>{stu?.fullName || 'Student Ward'}</span>
                          <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{fmtUGX(p.amount)}</strong>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Channel: {p.provider || p.channel || 'Mobile Money'} &bull; Confirmed: {p.confirmedBy || 'Bursar'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};
