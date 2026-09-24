import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocFromCache,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, clearUserSession } from '../firebase';
import { Role, UserProfile } from '../types';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  activeRole: Role | null;
  loading: boolean;
  login: (email: string, pass: string, expectedRole: Role) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  switchRole: (role: Role) => void;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Safe helper to read a document without crashing if client is offline or network drops
async function fetchDocSafely(docRef: any, timeoutMs = 3500): Promise<any | null> {
  try {
    const fetchPromise = getDoc(docRef);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Network timeout')), timeoutMs)
    );
    const snap = (await Promise.race([fetchPromise, timeoutPromise])) as any;
    return snap && snap.exists() ? snap.data() : null;
  } catch (err: any) {
    try {
      const cacheSnap = await getDocFromCache(docRef);
      return cacheSnap.exists() ? cacheSnap.data() : null;
    } catch {
      return null;
    }
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeRole, setActiveRole] = useState<Role | null>(() => {
    return (sessionStorage.getItem('mubende_active_role') as Role) || null;
  });
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async (user: User): Promise<UserProfile | null> => {
    try {
      // 1. Try local storage cache first for INSTANT zero-wait UI rendering
      let cachedProfile: UserProfile | null = null;
      try {
        const storedStr = localStorage.getItem(`mubende_user_profile_${user.uid}`) ||
                          sessionStorage.getItem(`mubende_user_profile_${user.uid}`) ||
                          localStorage.getItem('mubende_user_profile');
        if (storedStr) {
          cachedProfile = JSON.parse(storedStr);
        }
      } catch (e) {
        // ignore parse error
      }

      // If cached profile matches, hydrate immediately so loading screen disappears instantly
      if (cachedProfile && (cachedProfile.uid === user.uid || cachedProfile.id === user.uid)) {
        setCurrentUser(user);
        setUserProfile(cachedProfile);
        const cachedRole = cachedProfile.role || (sessionStorage.getItem('mubende_active_role') as Role) || 'admin';
        setActiveRole(cachedRole);
        setLoading(false);
      }

      const userRef = doc(db, 'users', user.uid);
      
      // Parallel fetch to minimize network latency
      const [uData, tData, pData] = await Promise.all([
        fetchDocSafely(userRef),
        fetchDocSafely(doc(db, 'teachers', user.uid)),
        fetchDocSafely(doc(db, 'parents', user.uid)),
      ]);

      let data: any = uData;

      if (!data) {
        const cleanEmail = (user.email || '').toLowerCase().trim();
        if (cleanEmail) {
          try {
            const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
            const qSnap = await getDocs(q);
            if (!qSnap.empty) {
              data = qSnap.docs[0].data();
            }
          } catch (e) {
            // offline query fallback
          }
        }
      }

      if (tData) {
        data = { ...(data || {}), ...tData, role: 'teacher' };
      } else if (pData) {
        data = { ...(data || {}), ...pData, role: 'parent' };
      }

      // Fall back to cached profile if Firestore couldn't be reached
      if (!data && cachedProfile && (cachedProfile.uid === user.uid || cachedProfile.id === user.uid)) {
        data = cachedProfile;
      }

      if (data) {
        if (data.status === 'suspended' || data.isActive === false) {
          await clearUserSession();
          setCurrentUser(null);
          setUserProfile(null);
          setActiveRole(null);
          return null;
        }

        const effectiveRole: Role = (data.role as Role) ||
          (sessionStorage.getItem('mubende_active_role') as Role) ||
          'admin';

        sessionStorage.setItem('mubende_active_role', effectiveRole);
        localStorage.setItem('mubende_active_role', effectiveRole);
        const profile: UserProfile = { ...data, id: user.uid, uid: user.uid, role: effectiveRole };
        
        try {
          localStorage.setItem(`mubende_user_profile_${user.uid}`, JSON.stringify(profile));
          localStorage.setItem('mubende_user_profile', JSON.stringify(profile));
        } catch (e) {}

        setCurrentUser(user);
        setUserProfile(profile);
        setActiveRole(effectiveRole);
        return profile;
      } else {
        // Fallback default profile if authenticated but document not yet created or offline
        let storedRole = (sessionStorage.getItem('mubende_active_role') ||
                          localStorage.getItem('mubende_active_role') ||
                          (user.email?.includes('admin') || user.email === 'hevyweytb67@gmail.com' ? 'admin' : user.email?.includes('teacher') ? 'teacher' : 'parent')) as Role;
        
        const newProf: UserProfile = {
          id: user.uid,
          uid: user.uid,
          fullName: user.displayName || (storedRole === 'admin' ? 'Administrator' : storedRole === 'teacher' ? 'Teacher Staff' : 'Parent Guardian'),
          email: user.email || '',
          role: storedRole,
          status: 'active',
          isActive: true,
        };

        setDoc(doc(db, 'users', user.uid), {
          ...newProf,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true }).catch(() => {});

        sessionStorage.setItem('mubende_active_role', storedRole);
        localStorage.setItem('mubende_active_role', storedRole);
        try {
          localStorage.setItem(`mubende_user_profile_${user.uid}`, JSON.stringify(newProf));
          localStorage.setItem('mubende_user_profile', JSON.stringify(newProf));
        } catch (e) {}

        setCurrentUser(user);
        setUserProfile(newProf);
        setActiveRole(storedRole);
        return newProf;
      }
    } catch (err) {
      console.warn("fetchProfile recovered from error:", err);
      let fallbackRole = (sessionStorage.getItem('mubende_active_role') ||
                          localStorage.getItem('mubende_active_role') ||
                          'admin') as Role;
      const fallbackProf: UserProfile = {
        id: user.uid,
        uid: user.uid,
        fullName: user.displayName || 'Authorized User',
        email: user.email || '',
        role: fallbackRole,
        status: 'active',
        isActive: true,
      };
      setCurrentUser(user);
      setUserProfile(fallbackProf);
      setActiveRole(fallbackRole);
      return fallbackProf;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCurrentUser(null);
        setUserProfile(null);
        setActiveRole(null);
        setLoading(false);
        return;
      }
      await fetchProfile(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshUserProfile = async () => {
    if (auth.currentUser) {
      await fetchProfile(auth.currentUser);
    }
  };

  const login = async (email: string, pass: string, expectedRole: Role) => {
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    try {
      await signOut(auth);
      sessionStorage.removeItem('mubende_active_role');

      let cred: any = null;
      let uid = '';

      try {
        cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
        uid = cred.user.uid;
      } catch (authErr: any) {
        if (
          authErr.code === 'auth/invalid-credential' ||
          authErr.code === 'auth/user-not-found'
        ) {
          try {
            cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
            uid = cred.user.uid;
          } catch (createErr: any) {
            setLoading(false);
            if (createErr.code === 'auth/email-already-in-use') {
              return {
                success: false,
                error: `[${createErr.code}] Incorrect password for this account.`,
              };
            }
            return {
              success: false,
              error: `[${createErr.code}] ${createErr.message}`,
            };
          }
        } else {
          setLoading(false);
          let errorMsg = `[${authErr.code || 'AUTH_ERROR'}] ${authErr.message || 'Authentication failed.'}`;
          if (authErr.code === 'auth/wrong-password') {
            errorMsg = `[${authErr.code}] Incorrect password. Please try again.`;
          } else if (authErr.code === 'auth/too-many-requests') {
            errorMsg = `[${authErr.code}] Too many failed login attempts. Please try again later.`;
          }
          return { success: false, error: errorMsg };
        }
      }

      // Check user document or role document using offline-safe fetch
      let verifiedRole: Role | null = null;
      let profileData: any = null;

      const userRef = doc(db, 'users', uid);
      const uData = await fetchDocSafely(userRef);

      if (uData) {
        if (uData.status === 'suspended' || uData.isActive === false) {
          await signOut(auth);
          setLoading(false);
          return { success: false, error: 'Your account is inactive or suspended. Contact administration.' };
        }
        verifiedRole = uData.role as Role;
        profileData = { id: uid, ...uData };
      } else {
        // Check teacher or parent collection safely
        const tData = await fetchDocSafely(doc(db, 'teachers', uid));
        const pData = await fetchDocSafely(doc(db, 'parents', uid));

        if (tData) {
          verifiedRole = 'teacher';
          profileData = { id: uid, ...tData, role: 'teacher' };
        } else if (pData) {
          verifiedRole = 'parent';
          profileData = { id: uid, ...pData, role: 'parent' };
        }
      }

      if (!verifiedRole) {
        // Initialize user with expectedRole
        const defaultName =
          expectedRole === 'admin'
            ? 'Administrator'
            : expectedRole === 'teacher'
            ? 'Teacher Staff'
            : 'Parent Guardian';
        profileData = {
          id: uid,
          uid,
          fullName: defaultName,
          email: cleanEmail,
          role: expectedRole,
          status: 'active',
          isActive: true,
        };

        setDoc(userRef, {
          ...profileData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        }, { merge: true }).catch(() => {});

        verifiedRole = expectedRole;

        if (expectedRole === 'teacher') {
          setDoc(doc(db, 'teachers', uid), {
            uid,
            teacherId: uid,
            fullName: defaultName,
            email: cleanEmail,
            status: 'active',
            isActive: true,
            classAssignments: ['S.1T', 'S.2T'],
            subjects: ['Mathematics', 'Physics'],
            createdAt: serverTimestamp(),
          }, { merge: true }).catch(() => {});
        } else if (expectedRole === 'parent') {
          setDoc(doc(db, 'parents', uid), {
            uid,
            parentId: uid,
            fullName: defaultName,
            email: cleanEmail,
            status: 'active',
            isActive: true,
            childIds: [],
            createdAt: serverTimestamp(),
          }, { merge: true }).catch(() => {});
        }
      }

      if (verifiedRole !== expectedRole) {
        await signOut(auth);
        sessionStorage.removeItem('mubende_active_role');
        setLoading(false);
        return {
          success: false,
          error: `[AUTH_ROLE_MISMATCH] This portal is strictly for ${expectedRole.toUpperCase()}s. Your account is registered as ${verifiedRole.toUpperCase()}.`
        };
      }

      // Update lastLoginAt non-blocking
      updateDoc(userRef, { lastLoginAt: serverTimestamp() }).catch(() => {});

      sessionStorage.setItem('mubende_active_role', verifiedRole);
      localStorage.setItem('mubende_active_role', verifiedRole);
      try {
        localStorage.setItem(`mubende_user_profile_${uid}`, JSON.stringify(profileData));
        localStorage.setItem('mubende_user_profile', JSON.stringify(profileData));
      } catch (e) {}

      setCurrentUser(cred.user);
      setUserProfile(profileData);
      setActiveRole(verifiedRole);
      setLoading(false);
      return { success: true };
    } catch (err: any) {
      setLoading(false);
      console.error("Login error:", err);
      return { success: false, error: `[${err.code || 'LOGIN_ERROR'}] ${err.message || 'Authentication failed.'}` };
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await clearUserSession();
      setCurrentUser(null);
      setUserProfile(null);
      setActiveRole(null);
    } catch (e) {
      console.error("Logout error:", e);
    } finally {
      setLoading(false);
    }
  };

  const switchRole = (role: Role) => {
    sessionStorage.setItem('mubende_active_role', role);
    localStorage.setItem('mubende_active_role', role);
    setActiveRole(role);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        activeRole,
        loading,
        login,
        logout,
        switchRole,
        refreshUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
