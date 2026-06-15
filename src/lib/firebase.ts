import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyBiy0aiyLr_HBi5E-enFhG4VVvGb2QPT2c",
  authDomain: "smart-po-app.firebaseapp.com",
  projectId: "smart-po-app",
  storageBucket: "smart-po-app.firebasestorage.app",
  messagingSenderId: "341070222786",
  appId: "1:341070222786:web:3081e8cb4195f07406b25b",
  measurementId: "G-3LPJ1XY5C5"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Use custom scope based on the workspace applet identifier
declare const __app_id: string | undefined;
export const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'smart-po-company';
export const BASE_PATH = `artifacts/${APP_ID}/public/data`;
