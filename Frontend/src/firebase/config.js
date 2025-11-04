// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDnmbJMC79qQM2xlWqj_g4Uur96pZYRBKI",
  authDomain: "partner-b4e79.firebaseapp.com",
  projectId: "partner-b4e79",
  storageBucket: "partner-b4e79.firebasestorage.app",
  messagingSenderId: "151724836959",
  appId: "1:151724836959:web:7d51293bc3c67b851ff3ea",
  measurementId: "G-L3MCMGC0XP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
let analytics;

export const auth = getAuth(app);
// Initialize Firestore with stable configuration
export const db = getFirestore(app);

// Connect to emulators if requested (useful for offline/dev)
const useEmulators = import.meta?.env?.VITE_USE_FIREBASE_EMULATORS === 'true';
if (useEmulators) {
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  } catch (e) {
    console.error('Failed to connect to Firebase emulators:', e);
  }
}

export default app;