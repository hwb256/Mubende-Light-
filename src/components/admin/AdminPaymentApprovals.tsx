import React, { useState } from 'react';
import {
  collection,
  doc,
  runTransaction,
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
  CreditCard,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { db } from '../../firebase';
import { useSchoolSettings } from '../../context/SchoolSettingsContext';
import {
  ParentPaymentApproval,
  FeeRecord,
  Student,
} from '../../types';

interface AdminPaymentApprovalsProps {
  paymentApprovals: ParentPaymentApproval[];
  fees: FeeRecord[];
  students: Student[];
  onRefreshData: () => Promise<void>;
  notifyAudit: (action: string, targetType: string, targetId: string) => Promise<void>;
  onRequestConfirm?: (title: string, message: string, onConfirmAction: () => Promise<void>) => void;
}

export const AdminPaymentApprovals: React.FC<AdminPaymentApprovalsProps> = ({
  paymentApprovals,
  fees,
  students,
  onRefreshData,
  notifyAudit,
  onRequestConfirm,
}) => {
  const { settings, currentTerm, currentYear } = useSchoolSettings();
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Collapsible accordion state for items: collapsed by default
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  // Lightbox / Proof modal
  const [activeProof, setActiveProof] = useState<{ url: string; title: string; filename?: string } | null>(null);

  // Reconcile modal
  const [reconcileModal, setReconcileModal] = useState<{
    approval: ParentPaymentApproval;
    verifiedAmount: number;
    term: string;
    year: number;
  } | null>(null);

  const fmtUGX = (val: number) => {
    return (val || 0).toLocaleString() + ' ' + (settings.currency || 'UGX');
  };

  const filteredApprovals = paymentApprovals.filter(p => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'verified') return p.status === 'verified' || p.status === 'approved';
    return p.status === filterStatus;
  });

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAll = () => {
    const allExpanded = filteredApprovals.every(p => expandedIds[p.id]);
    const next: Record<string, boolean> = {};
    filteredApprovals.forEach(p => {
      next[p.id] = !allExpanded;
    });
    setExpandedIds(next);
  };

  const initiateApproval = (approval: ParentPaymentApproval) => {
    setReconcileModal({
      approval,
      verifiedAmount: approval.amount > 0 ? approval.amount : 0,
      term: approval.term || currentTerm,
      year: approval.year || currentYear,
    });
  };

  const handleConfirmVerification = async () => {
    if (!reconcileModal) return;
    const { approval, verifiedAmount, term, year } = reconcileModal;
    if (verifiedAmount <= 0) {
      setActionError('Verification requires an approved amount greater than 0 UGX.');
      return;
    }

    setProcessingId(approval.id);
    setActionSuccess(null);
    setActionError(null);

    try {
      await runTransaction(db, async (transaction) => {
        let approvalRef = doc(db, 'parentPaymentApprovals', approval.id);
        let approvalSnap = await transaction.get(approvalRef);
        if (!approvalSnap.exists()) {
          approvalRef = doc(db, 'parentPayments', approval.id);
          approvalSnap = await transaction.get(approvalRef);
          if (!approvalSnap.exists()) {
            throw new Error('Payment submission record no longer exists.');
          }
        }

        // 1. Update parentPayment approval record
        transaction.update(approvalRef, {
          status: 'verified',
          amount: verifiedAmount,
          term,
          year,
          verifiedAt: serverTimestamp(),
          verifiedBy: 'Bursar Administrator',
          reviewedAt: serverTimestamp(),
        });

        // 2. Locate or initialize fee record
        const feeDoc = fees.find(
          f => f.studentId === approval.studentId && f.term === term && f.year === year
        ) || fees.find(f => f.studentId === approval.studentId);

        if (feeDoc && feeDoc.id) {
          const feeRef = doc(db, 'fees', feeDoc.id);
          const currentPaid = Number(feeDoc.paidAmount || 0);
          const newPaid = currentPaid + verifiedAmount;
          const totalFee = Number(feeDoc.totalFee || 1200000);
          const newBalance = Math.max(0, totalFee - newPaid);
          const newStatus = newBalance <= 0 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';

          transaction.update(feeRef, {
            paidAmount: newPaid,
            balance: newBalance,
            status: newStatus,
            term,
            year,
            updatedAt: serverTimestamp(),
          });
        } else {
          const newFeeRef = doc(collection(db, 'fees'));
          const totalFee = 1200000;
          const newBalance = Math.max(0, totalFee - verifiedAmount);
          const newStatus = newBalance <= 0 ? 'paid' : 'partial';
          transaction.set(newFeeRef, {
            studentId: approval.studentId,
            className: approval.className || 'S.1T',
            term,
            year,
            totalFee,
            paidAmount: verifiedAmount,
            balance: newBalance,
            status: newStatus,
            updatedAt: serverTimestamp(),
          });
        }

        // 3. Create permanent receipt in payments ledger
        const paymentRef = doc(collection(db, 'payments'));
        const receiptNo = `RCT-${Date.now().toString().slice(-6)}`;
        transaction.set(paymentRef, {
          studentId: approval.studentId,
          amount: verifiedAmount,
          term,
          year,
          provider: approval.network || approval.provider || 'Sure Pay',
          channel: approval.network || approval.provider || 'Sure Pay (Parent)',
          transactionRef: approval.transactionId || receiptNo,
          receiptNumber: receiptNo,
          confirmedBy: 'Bursar Administrator',
          confirmedAt: serverTimestamp(),
          status: 'confirmed',
        });
      });

      await notifyAudit('VERIFY_PAYMENT', 'parentPayments', approval.id);
      setActionSuccess(`Successfully verified ${fmtUGX(verifiedAmount)} for student! Fees ledger reconciled.`);
      setReconcileModal(null);
      await onRefreshData();
    } catch (err: any) {
      console.error("Verification transaction error:", err);
      setActionError(`[${err.code || 'VERIFY_ERROR'}] ${err.message || 'Payment verification failed.'}`);
    } finally {
      setProcessingId(null);
    }
  };

  const executeReject = async (approvalId: string) => {
    setProcessingId(approvalId);
    setActionSuccess(null);
    setActionError(null);
    try {
      try {
        await updateDoc(doc(db, 'parentPaymentApprovals', approvalId), {
          status: 'rejected',
          rejectedAt: serverTimestamp(),
          rejectedBy: 'Bursar Administrator',
        });
      } catch (subErr) {
        await updateDoc(doc(db, 'parentPayments', approvalId), {
          status: 'rejected',
          rejectedAt: serverTimestamp(),
          rejectedBy: 'Bursar Administrator',
        });
      }
      await notifyAudit('REJECT_PAYMENT', 'parentPaymentApprovals', approvalId);
      setActionSuccess('Payment submission rejected and archived.');
      await onRefreshData();
    } catch (err: any) {
      console.error("Reject payment error:", err);
      setActionError(`[${err.code || 'REJECT_ERROR'}] ${err.message || 'Failed to reject payment.'}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (approvalId: string) => {
    if (onRequestConfirm) {
      onRequestConfirm('Reject Payment', 'Are you sure you want to reject this payment submission?', async () => {
        await executeReject(approvalId);
      });
    } else {
      await executeReject(approvalId);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Mobile Money &amp; Bank Payment Reconciliations
          </h2>
          <p className="text-[11px] text-slate-500">
            Verify submitted mobile money proofs and reconcile directly to student fee ledgers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {filteredApprovals.length > 0 && (
            <button
              onClick={toggleAll}
              className="px-3 py-1 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Toggle Expand All
            </button>
          )}
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
            {(['all', 'pending', 'verified', 'rejected'] as const).map(st => (
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

      {/* Collapsible Payment Approvals List */}
      <div className="space-y-3">
        {filteredApprovals.length === 0 ? (
          <div className="p-8 text-center text-slate-500 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
            No payment submissions found matching filter: <strong>{filterStatus}</strong>.
          </div>
        ) : (
          filteredApprovals.map(p => {
            const stu = students.find(s => s.id === p.studentId);
            const stuDisplay = p.studentName || stu?.fullName || 'Student Ward';
            const isExpanded = !!expandedIds[p.id];
            const isVerified = p.status === 'verified' || p.status === 'approved';

            return (
              <div
                key={p.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-colors"
              >
                {/* Header: Clickable to expand/collapse */}
                <div
                  onClick={() => toggleExpand(p.id)}
                  className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                        {p.transactionId || 'Payment Ref'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {stuDisplay} ({p.className || stu?.className || 'Class'}) &bull; <strong className="text-emerald-600 dark:text-emerald-400">{fmtUGX(p.amount)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                        isVerified
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          : p.status === 'rejected'
                          ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                      }`}
                    >
                      {p.status}
                    </span>

                    {p.status === 'pending' && (
                      <div className="flex items-center gap-1.5 ml-2">
                        <button
                          disabled={processingId === p.id}
                          onClick={() => initiateApproval(p)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1 shadow-xs"
                          title="Verify & Reconcile"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          disabled={processingId === p.id}
                          onClick={() => handleReject(p.id)}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1 shadow-xs"
                          title="Reject Submission"
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => toggleExpand(p.id)}
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
                        <span className="text-slate-400 font-medium block">Student Ward:</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100 block mt-0.5">{stuDisplay}</span>
                        <span className="text-[11px] text-slate-500 block">{p.className || stu?.className}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium block">Academic Session:</span>
                        <span className="text-slate-900 dark:text-slate-100 block mt-0.5">
                          {p.term || currentTerm} &bull; {p.year || currentYear}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium block">Amount Submitted:</span>
                        <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400 block mt-0.5">
                          {fmtUGX(p.amount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium block">Phone &amp; Channel:</span>
                        <span className="font-mono text-slate-900 dark:text-slate-100 block mt-0.5">{p.phone || 'N/A'}</span>
                        <span className="text-[11px] text-slate-500 block">{p.network || p.provider || 'Sure Pay'}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">Proof Attachment:</span>
                        {p.proofUrl || p.proof ? (
                          <button
                            onClick={() => setActiveProof({
                              url: (p.proofUrl || p.proof)!,
                              title: `Proof for ${p.transactionId}`,
                              filename: p.proofFileName,
                            })}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold cursor-pointer transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" /> View Uploaded Receipt / Screenshot
                          </button>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Network SMS Voucher</span>
                        )}
                      </div>

                      {((p as any).paymentDate || (p as any).paymentTime) && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          <strong>Reported Payment Time:</strong> {(p as any).paymentDate || ''} {(p as any).paymentTime || ''}
                        </div>
                      )}

                      {((p as any).smsMessage || p.messageBody) && (
                        <div className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-[11px] text-slate-800 dark:text-slate-200 font-mono whitespace-pre-wrap">
                          <strong className="text-blue-600 dark:text-blue-400 font-sans block mb-1">Full Provider SMS Message:</strong>
                          {(p as any).smsMessage || p.messageBody}
                        </div>
                      )}

                      {((p as any).notes) && (
                        <div className="w-full mt-1 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300">
                          <strong>Parent Notes:</strong> {(p as any).notes}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Proof Lightbox Modal */}
      {activeProof && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-blue-500" />
                {activeProof.title}
              </h3>
              <button
                onClick={() => setActiveProof(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto flex items-center justify-center rounded-xl bg-slate-950/20 p-2">
              <img
                src={activeProof.url}
                alt="Payment proof attachment"
                className="max-h-full max-w-full object-contain rounded-lg"
              />
            </div>
            {activeProof.filename && (
              <p className="text-[11px] text-slate-400 font-mono">Attachment: {activeProof.filename}</p>
            )}
            <div className="flex justify-end">
              <button
                onClick={() => setActiveProof(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reconciliation Verification Modal */}
      {reconcileModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-500" />
                Reconcile &amp; Approve Fee Payment
              </h3>
              <button
                onClick={() => setReconcileModal(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs space-y-1">
              <div><strong>Reference:</strong> <span className="font-mono">{reconcileModal.approval.transactionId}</span></div>
              <div><strong>Student:</strong> {reconcileModal.approval.studentName || 'Student Ward'}</div>
              <div><strong>Phone:</strong> {reconcileModal.approval.network} &bull; {reconcileModal.approval.phone}</div>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Reconciled Amount (UGX)</label>
                <input
                  type="number"
                  required
                  min={1000}
                  step={1000}
                  value={reconcileModal.verifiedAmount}
                  onChange={(e) => setReconcileModal({
                    ...reconcileModal,
                    verifiedAmount: parseFloat(e.target.value) || 0,
                  })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold text-emerald-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Academic Term</label>
                  <select
                    value={reconcileModal.term}
                    onChange={(e) => setReconcileModal({
                      ...reconcileModal,
                      term: e.target.value,
                    })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold"
                  >
                    <option value="Term 1">Term 1</option>
                    <option value="Term 2">Term 2</option>
                    <option value="Term 3">Term 3</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Academic Year</label>
                  <input
                    type="number"
                    value={reconcileModal.year}
                    onChange={(e) => setReconcileModal({
                      ...reconcileModal,
                      year: parseInt(e.target.value) || currentYear,
                    })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold"
                  />
                </div>
              </div>
            </div>
            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setReconcileModal(null)}
                className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVerification}
                disabled={reconcileModal.verifiedAmount <= 0 || processingId !== null}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-md"
              >
                {processingId ? 'Executing...' : 'Confirm & Reconcile'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
