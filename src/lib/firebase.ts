import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager, persistentMultipleTabManager, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { Capacitor } from '@capacitor/core';

// 1. Environment Variable Protection
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// 2. Hot-Reload Protection
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 3. Platform-Aware App Check
if (typeof window !== 'undefined' && import.meta.env.PROD) {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  
  try {
    if (Capacitor.isNativePlatform()) {
      console.info("[Security] Bypassing reCAPTCHA v3 on native. Awaiting native attestation.");
    } else if (siteKey) {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true
      });
      console.info("[Security] Web App Check initialized.");
    }
  } catch (err) {
    console.warn("[Security] App Check initialization failed:", err);
  }
}

// 4. Core Service Initialization
export const auth = getAuth(app);

// Capacitor/WebView doesn't support SharedWorker (required by multiple tab manager)
const tabManager = Capacitor.isNativePlatform() 
  ? persistentSingleTabManager({}) 
  : persistentMultipleTabManager();

export const db = initializeFirestore(app, { 
  localCache: persistentLocalCache({ tabManager }) 
});

// 5. Regional Optimization
// Currently set to us-central1 for quota stability. 
// Switch to 'asia-south1' only after increasing GCP vCPU limits.
export const functions = getFunctions(app, 'us-central1');

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// 6. Seamless Local Emulator Suite Integration
if (import.meta.env.MODE === 'development' && import.meta.env.VITE_USE_EMULATORS === 'true') {
  console.info('🛠️ Launching Local Emulator Suite');
  const host = Capacitor.getPlatform() === 'android' ? '10.0.2.2' : 'localhost';
  
  try {
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, 8080);
    connectFunctionsEmulator(functions, host, 5001);
  } catch (err) {
    console.warn("Emulators already connected or failed to attach.");
  }
}
