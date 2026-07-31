// src/services/userService.js
import { db } from "../firebase";
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";

const USERS_COLLECTION = "users";

// إنشاء مستخدم جديد في Firestore
export const createUser = async (userId, phoneNumber, fullName, role) => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const userData = {
      phoneNumber: phoneNumber || "",
      fullName: fullName || "",
      role: role || "volunteer", // admin / volunteer
      status: "active",
      active: true, // legacy compatibility mirror; authorization uses status
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };
    await setDoc(userRef, userData);
    return { success: true, user: userData };
  } catch (error) {
    console.error("Error creating user:", error);
    return { success: false, error: error.message };
  }
};

// الحصول على بيانات مستخدم من Firestore
export const getUser = async (userId) => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      return { success: true, user: userSnap.data() };
    } else {
      return { success: false, error: "User not found" };
    }
  } catch (error) {
    console.error("Error getting user:", error);
    return { success: false, error: error.message };
  }
};

// الحصول على مستخدم حسب رقم الهاتف
export const getUserByPhone = async (phoneNumber) => {
  try {
    const q = query(collection(db, USERS_COLLECTION), where("phoneNumber", "==", phoneNumber));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { success: true, user: { id: doc.id, ...doc.data() } };
    }
    return { success: false, error: "User not found" };
  } catch (error) {
    console.error("Error getting user by phone:", error);
    return { success: false, error: error.message };
  }
};

// تحديث آخر تسجيل دخول
export const updateLastLogin = async (userId) => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      lastLogin: new Date().toISOString(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error updating last login:", error);
    return { success: false, error: error.message };
  }
};

// جلب دور المستخدم
export const getUserRole = async (userId) => {
  const result = await getUser(userId);
  if (result.success) {
    return result.user.role;
  }
  return null;
};

// تحديث دور المستخدم
export const updateUserRole = async (userId, newRole) => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      role: newRole,
    });
    return { success: true };
  } catch (error) {
    console.error("Error updating user role:", error);
    return { success: false, error: error.message };
  }
};

// تحديث حالة المستخدم
export const updateUserStatus = async (userId, status) => {
  try {
    if (!["active", "inactive"].includes(status)) {
      return { success: false, error: "Invalid account status" };
    }
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      status: status, // active / inactive
      active: status === "active", // compatibility mirror only
    });
    return { success: true };
  } catch (error) {
    console.error("Error updating user status:", error);
    return { success: false, error: error.message };
  }
};
