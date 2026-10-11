import React, { useState } from 'react';
import {
  collection,
  doc,
  writeBatch,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  FileText,
  Printer,
  X,
  Play,
  CheckCircle2,
  AlertCircle,
  Award,
  Users,
  ChevronDown,
  ChevronUp,
  Send,
  Save,
  Clock,
  Sparkles,
} from 'lucide-react';
import { db } from '../../firebase';
import { useSchoolSettings } from '../../context/SchoolSettingsContext';
import { useAuth } from '../../context/AuthContext';
import { ALL_CLASSES, SCHOOL_LOGO_URL } from '../../constants/school';
import {
  Student,
  ResultRecord,
  ReportCard,
} from '../../types';
import { getSubjectDisplayName } from '../../utils/subjectUtils';

interface AdminReportCardsProps {
  students: Student[];
  results: ResultRecord[];
  reports: ReportCard[];
  onRefreshData: () => Promise<void>;
  notifyAudit: (action: string, targetType: string, targetId: string) => Promise<void>;
}

export const AdminReportCards: React.FC<AdminReportCardsProps> = ({
  students,
  results,
  reports,
  onRefreshData,
  notifyAudit,
}) => {
  const { settings, currentTerm, currentYear } = useSchoolSettings();
  const { currentUser, userProfile } = useAuth();
  const [repClass, setRepClass] = useState('S.1T');
  const [repTerm, setRepTerm] = useState(currentTerm || 'Term 1');
  const [repYear, setRepYear] = useState<number>(currentYear || 2026);
  const [compiling, setCompiling] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [compileSuccess, setCompileSuccess] = useState<string | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportCard | null>(null);

  // Per-student editing state for comments & conduct
  const [editingComments, setEditingComments] = useState<Record<string, string>>({});
  const [editingConducts, setEditingConducts] = useState<Record<string, string>>({});
  const [savingCardId, setSavingCardId] = useState<string | null>(null);

  // Collapsible cards state: collapsed by default
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const currentAdminAttribution =
    userProfile?.fullName || currentUser?.displayName || currentUser?.email || 'Headteacher Administrator';

  // Strict year-scoped filter with NO fallback
  const classReports = reports.filter(
    r => (r.className === repClass || r.classId === repClass) && (r.term === repTerm) && (r.year === repYear)
  );

  const draftCount = classReports.filter(r => r.status === 'draft' || !r.status).length;
  const publishedCount = classReports.filter(r => r.status === 'published').length;

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAll = () => {
    const allExpanded = classReports.every(r => expandedIds[r.id]);
    const next: Record<string, boolean> = {};
    classReports.forEach(r => {
      next[r.id] = !allExpanded;
    });
    setExpandedIds(next);
  };

  const handleCompileClassReports = async () => {
    const classStudents = students.filter(s => s.className === repClass && s.status === 'active');
    if (classStudents.length === 0) {
      setCompileError(`No active students enrolled in ${repClass}.`);
      return;
    }

    setCompiling(true);
    setCompileSuccess(null);
    setCompileError(null);

    try {
      const studentAverages: Array<{
        studentId: string;
        studentName: string;
        average: number;
        subjectCount: number;
        subjectComments: Array<{ subjectId: string; subjectName: string; comment: string }>;
        existingConduct: string;
        existingAdminComment: string;
      }> = [];

      classStudents.forEach(stu => {
        // Strict year match without || !r.year
        const stuResults = results.filter(
          r => r.studentId === stu.id && r.term === repTerm && r.year === repYear
        );

        // Collect teacher subject comments
        const subjectComments = stuResults
          .filter(r => Boolean(r.comment && r.comment.trim()))
          .map(r => ({
            subjectId: r.subjectId,
            subjectName: getSubjectDisplayName(r.subjectName || r.subjectId),
            comment: r.comment!.trim(),
          }));

        // Preserve any previously edited admin comments or conduct
        const existingReport = reports.find(
          r => r.studentId === stu.id && r.term === repTerm && r.year === repYear
        );

        if (stuResults.length > 0) {
          const subjectMap = new Map<string, number[]>();
          stuResults.forEach(r => {
            const arr = subjectMap.get(r.subjectId) || [];
            arr.push(Number(r.marks || 0));
            subjectMap.set(r.subjectId, arr);
          });

          let sumSubjectAverages = 0;
          subjectMap.forEach((scores) => {
            const subjectAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
            sumSubjectAverages += subjectAvg;
          });

          const overallAvg = Math.round(sumSubjectAverages / subjectMap.size);
          studentAverages.push({
            studentId: stu.id,
            studentName: stu.fullName,
            average: overallAvg,
            subjectCount: subjectMap.size,
            subjectComments,
            existingConduct: existingReport?.conduct || '',
            existingAdminComment: existingReport?.adminComment || '',
          });
        } else {
          studentAverages.push({
            studentId: stu.id,
            studentName: stu.fullName,
            average: 0,
            subjectCount: 0,
            subjectComments: [],
            existingConduct: existingReport?.conduct || '',
            existingAdminComment: existingReport?.adminComment || '',
          });
        }
      });

      // Rank with ties
      studentAverages.sort((a, b) => b.average - a.average);
      const rankedStudents: Array<{
        studentId: string;
        studentName: string;
        average: number;
        position: number;
        subjectComments: Array<{ subjectId: string; subjectName: string; comment: string }>;
        existingConduct: string;
        existingAdminComment: string;
      }> = [];

      let currentRank = 1;
      for (let i = 0; i < studentAverages.length; i++) {
        if (i > 0 && studentAverages[i].average < studentAverages[i - 1].average) {
          currentRank = i + 1;
        }
        rankedStudents.push({
          studentId: studentAverages[i].studentId,
          studentName: studentAverages[i].studentName,
          average: studentAverages[i].average,
          position: currentRank,
          subjectComments: studentAverages[i].subjectComments,
          existingConduct: studentAverages[i].existingConduct,
          existingAdminComment: studentAverages[i].existingAdminComment,
        });
      }

      // Batch Writes in DRAFT status
      const batch = writeBatch(db);
      rankedStudents.forEach(item => {
        const docId = `${item.studentId}_${repTerm}_${repYear}`;
        const ref = doc(db, 'reportCards', docId);

        let performanceSummary = 'Excellent performance; keeps up the dedication.';
        if (item.average < 50) performanceSummary = 'Requires targeted remedial intervention in core subjects.';
        else if (item.average < 65) performanceSummary = 'Fair academic effort; has capability to improve higher.';
        else if (item.average < 75) performanceSummary = 'Good academic standing; steady intellectual growth.';

        batch.set(ref, {
          studentId: item.studentId,
          className: repClass,
          classId: repClass,
          term: repTerm,
          year: repYear,
          average: item.average,
          position: item.position,
          totalStudents: classStudents.length,
          performanceSummary,
          subjectComments: item.subjectComments,
          adminComment: item.existingAdminComment || '',
          conduct: item.existingConduct || '', // Neutral unset by default
          status: 'draft', // DRAFT before explicit publish
          compiledAt: serverTimestamp(),
          compiledBy: currentAdminAttribution,
          generatedAt: serverTimestamp(),
        }, { merge: true });
      });

      await batch.commit();
      await notifyAudit('COMPILE_CLASS_REPORTS_DRAFT', 'reportCards', `${repClass}_${repTerm}_${repYear}`);
      setCompileSuccess(
        `Successfully compiled ${rankedStudents.length} report cards as DRAFTS for ${repClass} (${repTerm} ${repYear})! Please review conduct, add admin comments, and click "Publish to Parents" when ready.`
      );
      await onRefreshData();
    } catch (err: any) {
      console.error("Compilation error:", err);
      setCompileError(`[${err.code || 'COMPILE_ERROR'}] ${err.message || 'Failed to compile report cards.'}`);
    } finally {
      setCompiling(false);
    }
  };

  const handlePublishAllToParents = async () => {
    if (classReports.length === 0) return;
    setPublishing(true);
    setCompileSuccess(null);
    setCompileError(null);
    try {
      const batch = writeBatch(db);
      classReports.forEach(r => {
        const ref = doc(db, 'reportCards', r.id);
        batch.update(ref, {
          status: 'published',
          publishedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      await notifyAudit('PUBLISH_CLASS_REPORTS', 'reportCards', `${repClass}_${repTerm}_${repYear}`);
      setCompileSuccess(
        `Published all ${classReports.length} report cards for ${repClass} (${repTerm} ${repYear}) to parents!`
      );
      await onRefreshData();
    } catch (err: any) {
      console.error("Publish all error:", err);
      setCompileError(`[${err.code || 'PUBLISH_ERROR'}] ${err.message || 'Failed to publish reports.'}`);
    } finally {
      setPublishing(false);
    }
  };

  const handleSaveStudentReview = async (reportId: string) => {
    setSavingCardId(reportId);
    try {
      const ref = doc(db, 'reportCards', reportId);
      const updates: any = {
        updatedAt: serverTimestamp(),
      };
      if (editingConducts[reportId] !== undefined) {
        updates.conduct = editingConducts[reportId];
      }
      if (editingComments[reportId] !== undefined) {
        updates.adminComment = editingComments[reportId];
      }
      await updateDoc(ref, updates);
      await onRefreshData();
    } catch (err: any) {
      console.error("Save student review error:", err);
    } finally {
      setSavingCardId(null);
    }
  };

  const handleToggleReportStatus = async (report: ReportCard) => {
    const nextStatus = report.status === 'published' ? 'draft' : 'published';
    try {
      const ref = doc(db, 'reportCards', report.id);
      await updateDoc(ref, {
        status: nextStatus,
        publishedAt: nextStatus === 'published' ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      });
      await onRefreshData();
    } catch (err: any) {
      console.error("Toggle report status error:", err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Terminal Report Cards &amp; Academic Ranking
          </h2>
          <p className="text-[11px] text-slate-500">
            Compile fair per-subject averages, preserve real teacher remarks, customize conduct, and review drafts before publishing to parents.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {classReports.length > 0 && (
            <button
              onClick={toggleAll}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Toggle Expand All
            </button>
          )}

          {draftCount > 0 && (
            <button
              onClick={handlePublishAllToParents}
              disabled={publishing || compiling}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
              title="Publish all compiled drafts to parent portals"
            >
              <Send className="w-3.5 h-3.5" />
              {publishing ? 'Publishing...' : `Publish to Parents (${draftCount} Drafts)`}
            </button>
          )}

          <button
            onClick={handleCompileClassReports}
            disabled={compiling || publishing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <Play className="w-4 h-4" /> {compiling ? 'Compiling Drafts...' : 'Compile Class Reports (Draft)'}
          </button>
        </div>
      </div>

      {/* Class Stream Selectors */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Class Stream</label>
            <select
              value={repClass}
              onChange={(e) => setRepClass(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold"
            >
              {ALL_CLASSES.map(c => (
                <option key={c.display} value={c.display}>{c.display}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Academic Term</label>
            <select
              value={repTerm}
              onChange={(e) => setRepTerm(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold"
            >
              <option value="Term 1">Term 1</option>
              <option value="Term 2">Term 2</option>
              <option value="Term 3">Term 3</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Academic Year</label>
            <input
              type="number"
              value={repYear}
              onChange={(e) => setRepYear(parseInt(e.target.value) || currentYear)}
              className="w-24 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-bold">
            Drafts: {draftCount}
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-bold">
            Published: {publishedCount}
          </div>
        </div>
      </div>

      {compileSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{compileSuccess}</span>
        </div>
      )}

      {compileError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{compileError}</span>
        </div>
      )}

      {/* Reports Collapsible Cards */}
      <div className="space-y-3">
        {classReports.length === 0 ? (
          <div className="p-8 text-center text-slate-500 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
            No compiled report cards found for {repClass} ({repTerm} {repYear}). Click <strong>&quot;Compile Class Reports (Draft)&quot;</strong> above to calculate rankings and review candidate drafts.
          </div>
        ) : (
          classReports
            .sort((a, b) => (a.position || 999) - (b.position || 999))
            .map(r => {
              const stu = students.find(s => s.id === r.studentId);
              const isExpanded = !!expandedIds[r.id];
              const isPublished = r.status === 'published';
              const currentConduct = editingConducts[r.id] !== undefined ? editingConducts[r.id] : (r.conduct || '');
              const currentAdminComment = editingComments[r.id] !== undefined ? editingComments[r.id] : (r.adminComment || '');
              const isSaving = savingCardId === r.id;

              return (
                <div
                  key={r.id}
                  className={`rounded-xl border transition-colors bg-white dark:bg-slate-900 shadow-xs overflow-hidden ${
                    isPublished
                      ? 'border-emerald-500/30 dark:border-emerald-500/20'
                      : 'border-amber-500/30 dark:border-amber-500/20'
                  }`}
                >
                  {/* Header: Clickable to expand/collapse */}
                  <div
                    onClick={() => toggleExpand(r.id)}
                    className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-extrabold text-sm flex items-center justify-center border border-blue-500/20 shrink-0">
                        #{r.position}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                            {stu?.fullName || 'Student Ward'}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isPublished
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {isPublished ? 'Published' : 'Draft'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          Adm: {stu?.admissionNumber || 'N/A'} &bull; Avg: <strong className="text-emerald-600 dark:text-emerald-400">{r.average}%</strong>
                          {r.conduct ? ` • Conduct: ${r.conduct}` : ' • Conduct: (Unset)'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleToggleReportStatus(r)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs ${
                          isPublished
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 border border-amber-300 dark:border-amber-800'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                        title={isPublished ? 'Revert to draft (hide from parents)' : 'Publish to parents'}
                      >
                        {isPublished ? 'Revert to Draft' : 'Publish to Parents'}
                      </button>

                      <button
                        onClick={() => setSelectedReport(r)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors shadow-xs"
                      >
                        <Printer className="w-3.5 h-3.5" /> View / Print
                      </button>

                      <button
                        onClick={() => toggleExpand(r.id)}
                        className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 cursor-pointer ml-1"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Body: Collapsible by default */}
                  {isExpanded && (
                    <div className="p-4 pt-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/20 space-y-4 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <span className="text-slate-400 font-medium block">Terminal Average:</span>
                          <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 block mt-0.5">
                            {r.average}%
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium block">Class Standing:</span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 block mt-0.5">
                            Ranked #{r.position} of {r.totalStudents} Candidates
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium block">Evaluation Status:</span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 block mt-0.5">
                            {isPublished ? 'Official & Published' : 'Draft (Internal Review)'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium block">Compiled By:</span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 block mt-0.5 truncate">
                            {r.compiledBy || currentAdminAttribution}
                          </span>
                        </div>
                      </div>

                      {/* Performance Band Summary */}
                      <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-500/20">
                        <span className="font-bold text-blue-700 dark:text-blue-300 block mb-0.5">
                          Calculated Performance Band Summary:
                        </span>
                        <p className="italic text-slate-700 dark:text-slate-300">
                          &quot;{r.performanceSummary || 'Calculated from overall average.'}&quot;
                        </p>
                      </div>

                      {/* Real Teacher Comments per Subject */}
                      <div className="space-y-1.5">
                        <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] block">
                          Real Teacher Remarks by Subject:
                        </span>
                        {(!r.subjectComments || r.subjectComments.length === 0) ? (
                          <p className="text-slate-400 italic">No subject-specific teacher remarks registered yet.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {r.subjectComments.map(sc => (
                              <div key={sc.subjectId} className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                                <span className="font-bold text-slate-900 dark:text-white block text-[11px]">
                                  {sc.subjectName}:
                                </span>
                                <span className="text-slate-600 dark:text-slate-400 italic text-xs">
                                  &quot;{sc.comment}&quot;
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Conduct & Admin Remarks Editor */}
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                        <div>
                          <label className="block text-slate-500 font-medium mb-1">
                            Conduct &amp; Moral Evaluation:
                          </label>
                          <select
                            value={currentConduct}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditingConducts(prev => ({ ...prev, [r.id]: val }));
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                          >
                            <option value="">-- Select Conduct (Unset) --</option>
                            <option value="Excellent">Excellent</option>
                            <option value="Good">Good</option>
                            <option value="Fair">Fair</option>
                            <option value="Needs Improvement">Needs Improvement</option>
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-slate-500 font-medium mb-1">
                            Headteacher Administrator Remark (Custom):
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={currentAdminComment}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditingComments(prev => ({ ...prev, [r.id]: val }));
                              }}
                              placeholder="Enter personalized administration comment for this candidate..."
                              className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                            />
                            <button
                              onClick={() => handleSaveStudentReview(r.id)}
                              disabled={isSaving}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <Save className="w-3.5 h-3.5" />
                              {isSaving ? 'Saving...' : 'Save Review'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
        )}
      </div>

      {/* Official Report Card Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <img
                  src={SCHOOL_LOGO_URL}
                  alt={settings.schoolName || 'Mubende Light SSS'}
                  className="w-12 h-12 rounded-full object-cover border-2 border-blue-500"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22%3E%3Crect fill=%22%230f172a%22 width=%2248%22 height=%2248%22 rx=%2224%22/%3E%3Ctext x=%2224%22 y=%2229%22 text-anchor=middle fill=white font-size=12 font-weight=bold%3EMLSS%3C/text%3E%3C/svg%3E';
                  }}
                />
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white uppercase">
                    {settings.schoolName || 'MUBENDE LIGHT SENIOR SECONDARY SCHOOL'}
                  </h2>
                  <p className="text-[11px] text-blue-500 font-semibold italic">&ldquo;{settings.motto || 'Strive for Academic and Moral Excellence'}&rdquo;</p>
                  <p className="text-[10px] text-slate-400">Terminal Progress Report &bull; {selectedReport.term} ({selectedReport.year})</p>
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
                  {students.find(s => s.id === selectedReport.studentId)?.fullName || 'Student'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Class Stream</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedReport.className}</span>
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

            {/* Subject Breakdown with Teacher Comments */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Subject Performance Evaluations &amp; Teacher Remarks
              </span>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {results
                  .filter(
                    r => r.studentId === selectedReport.studentId &&
                         r.term === selectedReport.term &&
                         r.year === selectedReport.year
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
                          <span className="text-slate-400 block">Grade Evaluation:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{r.grade}</span>
                        </div>
                      </div>
                      {r.comment && (
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 italic pt-1 border-t border-slate-200/40 dark:border-slate-700/30">
                          Teacher Remark: &ldquo;{r.comment}&rdquo;
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
                <span className="font-bold text-slate-700 dark:text-slate-300">Performance Summary:</span>{' '}
                <span className="italic text-slate-600 dark:text-slate-400">{selectedReport.performanceSummary || 'Standard progress.'}</span>
              </div>
              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300">Headteacher Remark:</span>{' '}
                <span className="italic text-slate-600 dark:text-slate-400">{selectedReport.adminComment || 'Pending administration review.'}</span>
              </div>
              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300">Conduct &amp; Discipline:</span>{' '}
                <span className="text-slate-600 dark:text-slate-400 font-semibold">{selectedReport.conduct || 'Not Set'}</span>
              </div>
              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300">Certified By:</span>{' '}
                <span className="text-slate-600 dark:text-slate-400">{selectedReport.compiledBy || currentAdminAttribution}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Printer className="w-4 h-4" /> Print Official Report Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

