// src/services/authService.js
import { 
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "firebase/auth";
import { auth } from "../firebase";
import { getUser, createUser, updateLastLogin, createLoginSession } from "./userService";

// تسجيل الدخول بالإيميل وكلمة السر
export const login = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // جلب بيانات المستخدم من Firestore
    const userData = await getUser(user.uid);
    let role = "volunteer";
    
    if (userData.success) {
      role = userData.user.role;
      await updateLastLogin(user.uid);
    } else {
      // إذا كان المستخدم جديداً، ننشئه مع دور افتراضي
      await createUser(user.uid, "", user.email || "", "volunteer");
    }
    
    // تسجيل جلسة الدخول
    await createLoginSession(user.uid);
    
    return { 
      success: true, 
      user: { uid: user.uid, email: user.email, role },
      redirectTo: role === "admin" ? "/admin" : "/volunteer"
    };
  } catch (error) {
    console.error("Error logging in:", error);
    let message = "שגיאה בהתחברות";
    switch (error.code) {
      case "auth/invalid-credential":
        message = "אימייל או סיסמה לא נכונים";
        break;
      case "auth/user-not-found":
        message = "משתמש לא נמצא";
        break;
      case "auth/wrong-password":
        message = "סיסמה לא נכונה";
        break;
      case "auth/too-many-requests":
        message = "יותר מדי ניסיונות כושלים. נסה מאוחר יותר";
        break;
      case "auth/invalid-email":
        message = "כתובת אימייל לא תקינה";
        break;
      default:
        message = error.message;
    }
    return { success: false, error: message };
  }
};

// إرسال رابط إعادة تعيين كلمة المرور
export const forgotPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email, {
      url: window.location.origin + "/login",
    });
    return { success: true, message: "קישור לאיפוס סיסמה נשלח לאימייל שלך" };
  } catch (error) {
    let message = "שגיאה בשליחת הקישור";
    switch (error.code) {
      case "auth/user-not-found":
        message = "אימייל לא רשום במערכת";
        break;
      case "auth/invalid-email":
        message = "כתובת אימייל לא תקינה";
        break;
      default:
        message = error.message;
    }
    return { success: false, error: message };
  }
};

// تسجيل الخروج
export const logout = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// الحصول على المستخدم الحالي
export const getCurrentUser = () => {
  return auth.currentUser;
};

// مراقبة حالة المستخدم
export const onAuthStateChange = (callback) => {
  return auth.onAuthStateChanged(callback);
};