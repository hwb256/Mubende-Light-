import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { SystemSettings } from '../types';
import { DEFAULT_SETTINGS } from '../constants/school';

interface SchoolSettingsContextType {
  settings: SystemSettings;
  currentTerm: string;
  currentYear: number;
  loading: boolean;
  updateSettings: (newValues: Partial<SystemSettings>) => Promise<void>;
}

const SchoolSettingsContext = createContext<SchoolSettingsContextType | undefined>(undefined);

export const SchoolSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const sanitizeSchoolData = (raw: any): { clean: SystemSettings; needsPersist: boolean } => {
    let name = (raw?.schoolName || DEFAULT_SETTINGS.schoolName).trim();
    let motto = (raw?.motto || DEFAULT_SETTINGS.motto).trim();
    let needsPersist = false;

    // Purge any legacy Kasenyi mentions from Firestore and enforce Mubende Light
    if (/kasenyi/i.test(name) || !name) {
      name = DEFAULT_SETTINGS.schoolName;
      needsPersist = true;
    }
    if (/kasenyi/i.test(motto) || !motto) {
      motto = DEFAULT_SETTINGS.motto;
      needsPersist = true;
    }
    if (!raw?.generalTermFee) {
      needsPersist = true;
    }

    const clean: SystemSettings = {
      ...DEFAULT_SETTINGS,
      ...raw,
      schoolName: name,
      motto: motto,
      generalTermFee: Number(raw?.generalTermFee || DEFAULT_SETTINGS.generalTermFee || 198000),
      currentTerm: raw?.currentTerm || raw?.term || DEFAULT_SETTINGS.currentTerm,
      currentYear: Number(raw?.currentYear || raw?.academicYear || DEFAULT_SETTINGS.currentYear),
      academicYear: Number(raw?.academicYear || raw?.currentYear || DEFAULT_SETTINGS.academicYear),
      headteacherPhone: raw?.headteacherPhone || DEFAULT_SETTINGS.headteacherPhone,
      headteacherEmail: raw?.headteacherEmail || DEFAULT_SETTINGS.headteacherEmail,
      headteacherWhatsapp: raw?.headteacherWhatsapp || DEFAULT_SETTINGS.headteacherWhatsapp,
      bursarPhone: raw?.bursarPhone || DEFAULT_SETTINGS.bursarPhone,
      bursarEmail: raw?.bursarEmail || DEFAULT_SETTINGS.bursarEmail,
      bursarWhatsapp: raw?.bursarWhatsapp || DEFAULT_SETTINGS.bursarWhatsapp,
      dosPhone: raw?.dosPhone || DEFAULT_SETTINGS.dosPhone,
      dosEmail: raw?.dosEmail || DEFAULT_SETTINGS.dosEmail,
      dosWhatsapp: raw?.dosWhatsapp || DEFAULT_SETTINGS.dosWhatsapp,
    };

    return { clean, needsPersist };
  };

  useEffect(() => {
    // Listen to settings/schoolSettings
    const settingsDocRef = doc(db, 'settings', 'schoolSettings');
    const unsubscribe = onSnapshot(settingsDocRef, async (snap) => {
      try {
        if (snap.exists()) {
          const rawData = snap.data();
          const { clean, needsPersist } = sanitizeSchoolData(rawData);
          setSettings(clean);
          setLoading(false);

          if (needsPersist) {
            setDoc(settingsDocRef, {
              ...clean,
              updatedAt: serverTimestamp(),
            }, { merge: true }).catch(() => {});
          }
        } else {
          // Check school_config as fallback
          let fallbackData = null;
          try {
            const fallbackRef = doc(db, 'settings', 'school_config');
            const fallbackSnap = await getDoc(fallbackRef);
            if (fallbackSnap.exists()) {
              fallbackData = fallbackSnap.data();
            }
          } catch (e) {
            // offline or fallback not found
          }

          if (fallbackData) {
            const { clean } = sanitizeSchoolData(fallbackData);
            setSettings(clean);
            setDoc(settingsDocRef, {
              ...clean,
              updatedAt: serverTimestamp(),
            }, { merge: true }).catch(() => {});
          } else {
            setDoc(settingsDocRef, {
              ...DEFAULT_SETTINGS,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }, { merge: true }).catch(() => {});
            setSettings(DEFAULT_SETTINGS);
          }
          setLoading(false);
        }
      } catch (err) {
        console.warn("Settings snap handling error:", err);
        setSettings(DEFAULT_SETTINGS);
        setLoading(false);
      }
    }, (err) => {
      console.warn("Settings onSnapshot offline/error:", err);
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateSettings = async (newValues: Partial<SystemSettings>) => {
    const settingsDocRef = doc(db, 'settings', 'schoolSettings');
    const updated = {
      ...settings,
      ...newValues,
      updatedAt: serverTimestamp(),
    };
    await setDoc(settingsDocRef, updated, { merge: true });
    setSettings(prev => ({ ...prev, ...newValues }));
  };

  return (
    <SchoolSettingsContext.Provider
      value={{
        settings,
        currentTerm: settings.currentTerm || 'Term 1',
        currentYear: Number(settings.currentYear || 2026),
        loading,
        updateSettings,
      }}
    >
      {children}
    </SchoolSettingsContext.Provider>
  );
};

export const useSchoolSettings = () => {
  const context = useContext(SchoolSettingsContext);
  if (!context) {
    throw new Error('useSchoolSettings must be used within a SchoolSettingsProvider');
  }
  return context;
};
