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

  useEffect(() => {
    // Listen to settings/schoolSettings
    const settingsDocRef = doc(db, 'settings', 'schoolSettings');
    const unsubscribe = onSnapshot(settingsDocRef, async (snap) => {
      try {
        if (snap.exists()) {
          const data = snap.data();
          setSettings({
            ...DEFAULT_SETTINGS,
            ...data,
            currentTerm: data.currentTerm || data.term || DEFAULT_SETTINGS.currentTerm,
            currentYear: Number(data.currentYear || data.academicYear || DEFAULT_SETTINGS.currentYear),
          });
          setLoading(false);
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
            setSettings({
              ...DEFAULT_SETTINGS,
              ...fallbackData,
              currentTerm: fallbackData.currentTerm || fallbackData.term || DEFAULT_SETTINGS.currentTerm,
              currentYear: Number(fallbackData.currentYear || fallbackData.academicYear || DEFAULT_SETTINGS.currentYear),
            });
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
