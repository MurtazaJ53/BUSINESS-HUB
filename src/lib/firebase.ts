import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from "firebase/auth";
import { initializeFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { Capacitor } from '@capacitor/core';

// Public client-side Firebase identifiers can safely live in the app bundle.
const firebasePublicDefaults = {
  apiKey: 'AIzaSyDHSGEIdDt1m-Iu3swFoKlwNA28Xck41fM',
  authDomain: 'business-hub-pro.firebaseapp.com',
  projectId: 'business-hub-pro',
  storageBucket: 'business-hub-pro.firebasestorage.app',
  messagingSenderId: '631267912572',
  appId: '1:631267912572:web:663c0732dc25fd714f12f9',
  measurementId: 'G-MKZVQ6EYZT',
  recaptchaSiteKey: '6Lff9MUsAAAAACFLJG0zYTgf57KpeQ9e0YHOo2sw'
};

// 1. Environment Variable Protection
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebasePublicDefaults.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebasePublicDefaults.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebasePublicDefaults.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebasePublicDefaults.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebasePublicDefaults.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebasePublicDefaults.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || firebasePublicDefaults.measurementId
};

// 2. Hot-Reload Protection
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 3. Platform-Aware App Check
if (typeof window !== 'undefined' && import.meta.env.PROD) {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || firebasePublicDefaults.recaptchaSiteKey;
  const isLocalPreviewOrigin = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
    || window.location.protocol === 'file:';
  
  try {
    if (Capacitor.isNativePlatform()) {
      console.info("[Security] Bypassing reCAPTCHA v3 on native. Awaiting native attestation.");
    } else if (isLocalPreviewOrigin) {
      console.info("[Security] Skipping web App Check on local preview origin.");
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
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
});
export const storage = getStorage(app);

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
    connectStorageEmulator(storage, host, 9199);
  } catch (err) {
    console.warn("Emulators already connected or failed to attach.");
  }
}
