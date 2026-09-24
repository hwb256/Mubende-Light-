import React, { useState } from 'react';
import {
  collection,
  doc,
  writeBatch,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Check,
  X,
  Eye,
  AlertCircle,
  FileCheck,
  CheckCircle2,
  Clock,
  Award,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { db } from '../../firebase';
import { useSchoolSettings } from '../../context/SchoolSettingsContext';
import { useAuth } from '../../context/AuthContext';
import { TeacherSubmission, TeacherSubmissionItem, ResultRecord } from '../../types';
import { getSubjectDisplayName } from '../../utils/subjectUtils';

interface AdminTeacherSubmissionsProps {
  submissions: TeacherSubmission[];
  results: ResultRecord[];
  onRefreshData: () => Promise<void>;
  notifyAudit: (action: string, targetType: string, targetId: string) => Promise<void>;
}

export const AdminTeacherSubmissions: React.FC<AdminTeacherSubmissionsProps> = ({
  submissions,
  onRefreshData,
  notifyAudit,
}) => {
  const { currentTerm, currentYear } = useSchoolSettings();
  const { currentUser, userProfile } = useAuth();
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selectedSub, setSelectedSub] = useState<TeacherSubmission | null>(null);
  const [rejectionModalSub, setRejectionModalSub] = useState<TeacherSubmission | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Collapsible state for items: collapsed by default
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const filtered = submissions.filter(s => {
    if (filterStatus === 'all') return true;
    return s.status === filterStatus;
  });

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAll = () => {
    const allExpanded = filtered.every(s => expandedIds[s.id]);
    const next: Record<string, boolean> = {};
    filtered.forEach(s => {
      next[s.id] = !allExpanded;
    });
    setExpandedIds(next);
  };

  const handleApprove = async (sub: TeacherSubmission) => {
    const items: TeacherSubmissionItem[] = (sub.items || sub.marks || (sub.studentMarks ? Object.entries(sub.studentMarks).map(([sid, m]) => ({
      studentId: sid,
      studentName: sid,
      score: m.marks,
      grade: m.grade,
      remarks: m.comment,
      marks: m.marks,
    })) : [])) as TeacherSubmissionItem[];

    if (!items || items.length === 0) {
      setActionError('This submission contains no student score items to publish.');
      return;
    }

    setProcessing(true);
    setActionSuccess(null);
    setActionError(null);

    try {
      const batch = writeBatch(db);

      // Copy each score into live 'results' collection
      items.forEach(item => {
        const safeSubject = encodeURIComponent(sub.subject || sub.subjectId || 'Subject');
        const safeExamType = encodeURIComponent(sub.examType || 'Exam');
        const docId = `${item.studentId}_${safeSubject}_${sub.className}_${sub.term}_${sub.year}_${safeExamType}`;
        const resultRef = doc(db, 'results', docId);

        batch.set(resultRef, {
          studentId: item.studentId,
          className: sub.className,
          classId: sub.className,
          subjectId: sub.subject || sub.subjectId,
          term: sub.term,
          year: sub.year,
          examType: sub.examType || 'Continuous Assessment',
          marks: Number(item.score ?? item.marks ?? 0),
          grade: item.grade || 'C',
          comment: item.remarks || 'Standard performance',
          teacherId: sub.teacherId,
          publishedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      });

      // Mark submission as approved
      const subRef = doc(db, 'teacherSubmissions', sub.id);
      batch.update(subRef, {
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: userProfile?.fullName || currentUser?.displayName || currentUser?.email || 'Administrator',
        rejectionReason: null,
      });

      await batch.commit();
      await notifyAudit('APPROVE_TEACHER_SUBMISSION', 'teacherSubmissions', sub.id);
      setActionSuccess(`Successfully approved marks for ${sub.subject || sub.subjectId} (${sub.className})! Published to live student report cards.`);
      setSelectedSub(null);
      await onRefreshData();
    } catch (err: any) {
      console.error("Approval error:", err);
      setActionError(`[${err.code || 'APPROVE_ERROR'}] ${err.message || 'Failed to approve marks submission.'}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectionModalSub || !rejectionReason.trim()) return;
    setProcessing(true);
    setActionSuccess(null);
    setActionError(null);
    try {
      await updateDoc(doc(db, 'teacherSubmissions', rejectionModalSub.id), {
        status: 'rejected',
        rejectionReason: rejectionReason.trim(),
        rejectedAt: serverTimestamp(),
        rejectedBy: userProfile?.fullName || currentUser?.displayName || currentUser?.email || 'Administrator',
      });
      await notifyAudit('REJECT_TEACHER_SUBMISSION', 'teacherSubmissions', rejectionModalSub.id);
      setActionSuccess(`Submission returned to faculty instructor with revision feedback.`);
      setRejectionModalSub(null);
      setRejectionReason('');
      setSelectedSub(null);
      await onRefreshData();
    } catch (err: any) {
      console.error("Rejection error:", err);
      setActionError(`[${err.code || 'REJECT_ERROR'}] ${err.message || 'Failed to reject submission.'}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Faculty Marks Submissions &amp; Academic Verification
          </h2>
          <p className="text-[11px] text-slate-500">
            Review teacher continuous assessment scores before publishing to live results and terminal report cards.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {filtered.length > 0 && (
            <button
              onClick={toggleAll}
              className="px-3 py-1 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Toggle Expand All
            </button>
          )}
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
            {(['pending', 'approved', 'rejected', 'all'] as const).map(st => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1 rounded-lg font-semibold capitalize transition-all cursor-pointer ${
                  filterStatus === st
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Collapsible Submissions List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
            No teacher marks submissions found matching filter: <strong>{filterStatus}</strong>.
          </div>
        ) : (
          filtered.map(sub => {
            const isExpanded = !!expandedIds[sub.id];
            const candidateCount = sub.studentCount || sub.items?.length || (sub.studentMarks ? Object.keys(sub.studentMarks).length : 0);

            return (
              <div
                key={sub.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-colors"
              >
                {/* Header: Clickable to expand/collapse */}
                <div
                  onClick={() => toggleExpand(sub.id)}
                  className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300">
                      {sub.className}
                    </span>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        {getSubjectDisplayName(sub.subjectName || sub.subject || sub.subjectId)}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {sub.examType || 'Assessment'} &bull; {sub.teacherName} &bull; <strong>{candidateCount} candidates</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                        sub.status === 'approved'
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          : sub.status === 'rejected'
                          ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                      }`}
                    >
                      {sub.status}
                    </span>

                    <button
                      onClick={() => setSelectedSub(sub)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                      title="Inspect Student Scores"
                    >
                      <Eye className="w-3.5 h-3.5" /> Inspect ({candidateCount})
                    </button>

                    {sub.status === 'pending' && (
                      <div className="flex items-center gap-1.5 ml-1">
                        <button
                          disabled={processing}
                          onClick={() => handleApprove(sub)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1 shadow-xs"
                          title="Approve & Publish to Report Cards"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          disabled={processing}
                          onClick={() => {
                            setRejectionModalSub(sub);
                            setRejectionReason('');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1 shadow-xs"
                          title="Reject & Request Revision"
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => toggleExpand(sub.id)}
                      className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 cursor-pointer ml-1"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Body: Collapsible by default */}
                {isExpanded && (
                  <div className="p-4 pt-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/20 space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <span className="text-slate-400 font-medium block">Assessment Type:</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100 block mt-0.5">{sub.examType || 'Continuous Assessment'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium block">Academic Session:</span>
                        <span className="text-slate-900 dark:text-slate-100 block mt-0.5">
                          {sub.term} &bull; {sub.year}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium block">Faculty Instructor:</span>
                        <span className="text-slate-900 dark:text-slate-100 block mt-0.5">{sub.teacherName || 'Faculty Teacher'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium block">Evaluated Class:</span>
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400 block mt-0.5">
                          {candidateCount} Candidates
                        </span>
                      </div>
                    </div>

                    {sub.rejectionReason && (
                      <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-400">
                        <span className="font-bold">Rejection Feedback:</span> {sub.rejectionReason}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* View Scores Modal */}
      {selectedSub && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-blue-500" />
                  {getSubjectDisplayName(selectedSub.subjectName || selectedSub.subject || selectedSub.subjectId)} &bull; {selectedSub.className}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {selectedSub.examType} &bull; {selectedSub.term} ({selectedSub.year}) &bull; Instructor: {selectedSub.teacherName}
                </p>
              </div>
              <button
                onClick={() => setSelectedSub(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedSub.rejectionReason && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs">
                <strong>Previous Feedback:</strong> {selectedSub.rejectionReason}
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-2 p-1">
              {(() => {
                const items: TeacherSubmissionItem[] = (selectedSub.items || selectedSub.marks || (selectedSub.studentMarks ? Object.entries(selectedSub.studentMarks).map(([sid, m]) => ({
                  studentId: sid,
                  studentName: sid,
                  score: m.marks,
                  grade: m.grade,
                  remarks: m.comment,
                  marks: m.marks,
                })) : [])) as TeacherSubmissionItem[];

                return items.map((item, idx) => (
                  <div
                    key={item.studentId || idx}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-200/60 dark:border-slate-700/50">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">{item.studentName}</div>
                        <div className="font-mono text-[10px] text-slate-400">{item.admissionNumber || item.studentId}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                        Grade {item.grade}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] mb-1">
                      <div>
                        <span className="text-slate-400 block">Assessment Score:</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">{item.score ?? item.marks}%</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Assigned Grade:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{item.grade}</span>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 italic pt-1 border-t border-slate-200/40 dark:border-slate-700/30">
                      "{item.remarks || 'No qualitative remarks provided.'}"
                    </div>
                  </div>
                ));
              })()}
            </div>

            <div className="pt-2 flex justify-between items-center gap-2">
              <span className="text-xs text-slate-500">
                Total candidates: <strong>{selectedSub.studentCount || selectedSub.items?.length || 0}</strong>
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedSub(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 cursor-pointer"
                >
                  Close
                </button>
                {selectedSub.status === 'pending' && (
                  <>
                    <button
                      onClick={() => {
                        setRejectionModalSub(selectedSub);
                        setRejectionReason('');
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                    >
                      Reject Submission
                    </button>
                    <button
                      onClick={() => handleApprove(selectedSub)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                    >
                      Approve &amp; Publish
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectionModalSub && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500" />
              Return Marks to Teacher with Feedback
            </h3>
            <p className="text-xs text-slate-500">
              Provide constructive reasons why this mark submission for <strong>{rejectionModalSub.subject || rejectionModalSub.subjectId} ({rejectionModalSub.className})</strong> cannot be approved yet.
            </p>
            <textarea
              rows={3}
              required
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Please verify Mid-Term exam scores for candidate #4 and resubmit..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setRejectionModalSub(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectionReason.trim() || processing}
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
