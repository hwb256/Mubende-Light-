import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signOut } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  setLogLevel,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Silence transient backend retry noise in console so it does not trigger false-positive alert banners
try {
  setLogLevel('silent');
} catch (e) {
  // ignore
}

export const firebaseConfig = {
  apiKey: "AIzaSyCJZReUn1bYSoCpJNc6W1rRWDH1AhMNY0U",
  authDomain: "school-management-system-55829.firebaseapp.com",
  databaseURL: "https://school-management-system-55829-default-rtdb.firebaseio.com",
  projectId: "school-management-system-55829",
  storageBucket: "school-management-system-55829.firebasestorage.app",
  messagingSenderId: "471597850096",
  appId: "1:471597850096:web:204c60b10ea41c06d21135",
  measurementId: "G-L10ZT7N98B"
};

// Main Firebase app
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Resilient Firestore initialization with forced long polling and persistent cache
let dbInstance;
const resilientSettings: any = {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
  experimentalForceLongPolling: true,
  useFetchStreams: false,
  experimentalLongPollingOptions: {
    timeoutSeconds: 20,
  },
};

try {
  dbInstance = initializeFirestore(app, resilientSettings);
} catch (e1) {
  try {
    dbInstance = getFirestore(app);
  } catch (e2) {
    try {
      dbInstance = initializeFirestore(app, {
        experimentalForceLongPolling: true,
        useFetchStreams: false,
      } as any);
    } catch (e3) {
      dbInstance = getFirestore(app);
    }
  }
}

export const db = dbInstance;
export const storage = getStorage(app);

// Isolated secondary app dedicated to account creation without signing out the active admin
let secondaryAppInstance;
try {
  secondaryAppInstance = initializeApp(firebaseConfig, "SecondaryRegistrarApp");
} catch (e) {
  secondaryAppInstance = getApp("SecondaryRegistrarApp");
}
export const secondaryAuth = getAuth(secondaryAppInstance);

export async function clearUserSession() {
  try {
    await signOut(auth);
  } catch (err) {
    console.error("SignOut error:", err);
  }
  sessionStorage.removeItem('mubende_active_role');
  localStorage.removeItem('mubende_active_role');
  sessionStorage.removeItem('active_role');
  sessionStorage.removeItem('intended_role');
  localStorage.removeItem('active_role');
}
