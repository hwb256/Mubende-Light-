import React, { useState } from 'react';
import {
  Save,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Calendar,
} from 'lucide-react';
import { useSchoolSettings } from '../../context/SchoolSettingsContext';
import { SystemSettings } from '../../types';

interface AdminSettingsProps {
  notifyAudit: (action: string, targetType: string, targetId: string) => Promise<void>;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({ notifyAudit }) => {
  const { settings, updateSettings } = useSchoolSettings();
  const [form, setForm] = useState<SystemSettings>({ ...settings });
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    setForm({ ...settings });
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await updateSettings(form);
      await notifyAudit('UPDATE_SYSTEM_SETTINGS', 'schoolSettings', form.currentTerm);
      setSuccessMsg(
        `Institutional parameters updated successfully! Current session is now ${form.currentTerm} (${form.academicYear || form.currentYear}).`
      );
    } catch (err: any) {
      console.error("Save settings error:", err);
      setErrorMsg(`[${err.code || 'SETTINGS_ERROR'}] ${err.message || 'Failed to update system settings.'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-500" />
          System Parameters &amp; Academic Session
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          These settings serve as the single source of truth across all modules (Admin, Teacher, and Parent portals).
        </p>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs max-w-2xl space-y-4 text-xs">
        <div>
          <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
            Institution Name
          </label>
          <input
            type="text"
            required
            value={form.schoolName}
            onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-semibold"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
            School Motto
          </label>
          <input
            type="text"
            value={form.motto}
            onChange={(e) => setForm({ ...form, motto: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 italic"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              Current Academic Term
            </label>
            <select
              value={form.currentTerm}
              onChange={(e) => setForm({ ...form, currentTerm: e.target.value as any })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold"
            >
              <option value="Term 1">Term 1</option>
              <option value="Term 2">Term 2</option>
              <option value="Term 3">Term 3</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
              Active Academic Year
            </label>
            <input
              type="number"
              required
              min={2020}
              max={2035}
              value={form.academicYear || form.currentYear || 2026}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 2026;
                setForm({ ...form, academicYear: val, currentYear: val });
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
              Billing Currency Code
            </label>
            <input
              type="text"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 uppercase font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
              Official Contact Phone
            </label>
            <input
              type="tel"
              value={form.contactPhone || form.phone || ''}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value, phone: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
            Official Contact Email
          </label>
          <input
            type="email"
            value={form.contactEmail || form.email || ''}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value, email: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
            Campus Physical Address
          </label>
          <input
            type="text"
            value={form.address || ''}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-md"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving Changes...' : 'Save Parameters'}
          </button>
        </div>
      </form>
    </div>
  );
};
