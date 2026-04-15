import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Shared config from main project
const firebaseConfig = {
  apiKey: "AIzaSyAdOO4qTQFjFlC4mHMzEgWy7cCtxWCg8H0",
  authDomain: "personalexpensetracker-7b51c.firebaseapp.com",
  projectId: "personalexpensetracker-7b51c",
  storageBucket: "personalexpensetracker-7b51c.firebasestorage.app",
  messagingSenderId: "837446069297",
  appId: "1:837446069297:web:541847e66c0d2d76103910"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
