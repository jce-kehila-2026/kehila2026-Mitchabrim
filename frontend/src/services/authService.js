// src/services/authService.js
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { auth } from "../firebase";
import { resolveUserAccess } from "./allowedUsersService";

const ERROR_MESSAGES = {
  "auth/invalid-credential": "אימייל או סיסמה לא נכונים",
  "auth/user-not-found": "משתמש לא נמצא",
  "auth/wrong-password": "סיסמה לא נכונה",
  "auth/too-many-requests": "יותר מדי ניסיונות. נסה שוב מאוחר יותר",
  "auth/invalid-email": "כתובת אימייל לא תקינה",
  "auth/network-request-failed": "בעיית רשת. בדוק את החיבור",
};

const friendlyError = (code) => ERROR_MESSAGES[code] || "שגיאה בהתחברות. נסה שוב";

// Sign in + verify role against users/{uid} (with email fallback)
export const login = async (email, password) => {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    const allowed = await resolveUserAccess({ uid: user.uid, email: user.email });
    if (!allowed.success) {
      await signOut(auth);
      return { success: false, error: "אין לך הרשאה להיכנס למערכת" };
    }
    if (!allowed.user.active) {
      await signOut(auth);
      return { success: false, error: "החשבון שלך אינו פעיל. פנה למנהל המערכת" };
    }

    const role = allowed.user.role;
    if (!["admin", "volunteer"].includes(role)) {
      await signOut(auth);
      return { success: false, error: "תפקיד המשתמש אינו תקין" };
    }

    return {
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: allowed.user.displayName || "",
        role,
      },
      redirectTo: role === "admin" ? "/admin" : "/volunteer",
    };
  } catch (error) {
    console.error("login error:", error);
    return { success: false, error: friendlyError(error.code) };
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const forgotPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true, message: "קישור לאיפוס סיסמה נשלח לאימייל שלך" };
  } catch (error) {
    return { success: false, error: friendlyError(error.code) };
  }
};

// Resolve the current Firebase user's role from users/{uid}
export const getCurrentUserRole = async () => {
  const user = auth.currentUser;
  if (!user?.email) return null;
  const res = await resolveUserAccess({ uid: user.uid, email: user.email });
  if (!res.success || !res.user.active) return null;
  return res.user.role;
};

export const onAuthStateChange = (cb) => auth.onAuthStateChanged(cb);

// الحصول على المستخدم الحالي
export const getCurrentUser = () => {
  return auth.currentUser;
};