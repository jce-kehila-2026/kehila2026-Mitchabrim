import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCn7F3IcLoEOt2_xFruA8fRqivKMaPS7WM",
  authDomain: "mitchabrim-jce2026.firebaseapp.com",
  projectId: "mitchabrim-jce2026",
  storageBucket: "mitchabrim-jce2026.firebasestorage.app",
  messagingSenderId: "263496502401",
  appId: "1:263496502401:web:20b44802e7099d77c55180",
  measurementId: "G-K1RMKD4XE5"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

export default app;
