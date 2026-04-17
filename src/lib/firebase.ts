import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// New Business Hub Pro Project Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDHSGEIdDt1m-Iu3swFoKlwNA28Xck41fM",
  authDomain: "business-hub-pro.firebaseapp.com",
  projectId: "business-hub-pro",
  storageBucket: "business-hub-pro.firebasestorage.app",
  messagingSenderId: "631267912572",
  appId: "1:631267912572:web:663c0732dc25fd714f12f9",
  measurementId: "G-MKZVQ6EYZT"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
