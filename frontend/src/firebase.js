import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; 

const firebaseConfig = {
  apiKey: "AIzaSyCn7F3IcLoEOt2_xFruA8fRqivKMaPS7WM",
  authDomain: "mitchabrim-jce2026.firebaseapp.com",
  projectId: "mitchabrim-jce2026",
  storageBucket: "mitchabrim-jce2026.firebasestorage.app",
  messagingSenderId: "263496502401",
  appId: "1:263496502401:web:d94572e720bbd0c0c55180"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export const storage = getStorage(app);

export default app;