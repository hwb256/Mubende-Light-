import React from 'react';
import { CheckCircle2, AlertCircle, Loader2, Trash2, X } from 'lucide-react';

export interface FeedbackState {
  type: 'loading' | 'success' | 'error' | null;
  title?: string;
  message?: string;
}

export interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

interface CentralFeedbackModalProps {
  feedback: FeedbackState;
  onDismissFeedback: () => void;
  confirmDialog?: ConfirmState | null;
  onCloseConfirm?: () => void;
}

export const CentralFeedbackModal: React.FC<CentralFeedbackModalProps> = ({
  feedback,
  onDismissFeedback,
  confirmDialog,
  onCloseConfirm,
}) => {
  // If neither feedback nor confirm dialog is active, render nothing
  if (!feedback.type && (!confirmDialog || !confirmDialog.isOpen)) {
    return null;
  }

  // 1. Confirm Dialog Modal
  if (confirmDialog && confirmDialog.isOpen) {
    return (
      <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/70 animate-in fade-in duration-200">
        <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <Trash2 className="w-7 h-7" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {confirmDialog.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {confirmDialog.message}
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                if (confirmDialog.onCancel) confirmDialog.onCancel();
                if (onCloseConfirm) onCloseConfirm();
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (onCloseConfirm) onCloseConfirm();
                await confirmDialog.onConfirm();
              }}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer shadow-sm"
            >
              {confirmDialog.confirmLabel || 'Yes, Delete'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Central Feedback (Loading / Success / Error)
  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/50 animate-in fade-in duration-150"
      onClick={() => {
        if (feedback.type !== 'loading') onDismissFeedback();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border shadow-2xl p-6 text-center space-y-3 transition-all transform animate-in zoom-in-95 duration-200 ${
          feedback.type === 'success'
            ? 'border-emerald-500/30 dark:border-emerald-500/30'
            : feedback.type === 'error'
            ? 'border-rose-500/30 dark:border-rose-500/30'
            : 'border-blue-500/30 dark:border-blue-500/30'
        }`}
      >
        {/* Icon Header */}
        <div className="flex justify-center">
          {feedback.type === 'loading' && (
            <div className="w-14 h-14 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          )}
          {feedback.type === 'success' && (
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
          )}
          {feedback.type === 'error' && (
            <div className="w-14 h-14 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertCircle className="w-8 h-8" />
            </div>
          )}
        </div>

        {/* Text Content */}
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {feedback.title ||
              (feedback.type === 'loading'
                ? 'Saving to Database...'
                : feedback.type === 'success'
                ? 'Success!'
                : 'Action Failed')}
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed break-words whitespace-pre-wrap">
            {feedback.message}
          </p>
        </div>

        {/* Action Button (only for success and error) */}
        {feedback.type !== 'loading' && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onDismissFeedback}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-sm active:scale-98 ${
                feedback.type === 'success'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {feedback.type === 'success' ? 'Continue' : 'Dismiss'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
