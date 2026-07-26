// src/services/allowedUsersService.js
// Role/permission lookup + admin-side invite flow.
//
// Invite flow notes:
//  - An App-Check-protected callable verifies the active Admin, creates the
//    Auth account, and writes the canonical users/{uid} document.
//  - The client sends the standard password-reset email only after the
//    backend operation succeeds. No password is stored in Firestore.

import { auth, db, getJoinRequestFunctions } from "../firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { devLog as telemetryDevLog } from "./telemetry";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";

const COLLECTION = "users";

const normalizeEmail = (email) => (email || "").trim().toLowerCase();

// `status` is authoritative. `active` is retained only as a compatibility
// mirror for older UI/data consumers and must not grant access by itself.
export const isUserActive = (u) => u?.status === "active";

const resolveEmail = (u) => {
  const e = normalizeEmail(u?.email);
  if (e.includes("@")) return e;
  const fn = normalizeEmail(u?.fullName);
  return fn.includes("@") ? fn : "";
};

const normalizeUser = (id, data) => ({
  id,
  ...data,
  email: resolveEmail(data),
  displayName: data.displayName || (data.fullName && !String(data.fullName).includes("@") ? data.fullName : ""),
  active: isUserActive(data),
});

const withCanonicalAccountStatus = (data) => {
  if (data?.status === "active" || data?.status === "inactive") {
    return { ...data, active: data.status === "active" };
  }
  if (typeof data?.active === "boolean") {
    return { ...data, status: data.active ? "active" : "inactive" };
  }
  return { ...data };
};

const devLog = (event, context) => telemetryDevLog(event, context);

const bootstrapFields = (source, email) => {
  const data = {
    email,
    fullName: source?.fullName || "",
    displayName: source?.displayName || "",
    phoneNumber: source?.phoneNumber || "",
    role: source?.role,
    status: source?.status,
    active: source?.status === "active",
  };
  if (source?.role === "volunteer" && source?.linkedVolunteerId) {
    data.linkedVolunteerId = source.linkedVolunteerId;
  } else if (source?.role === "admin") {
    data.linkedVolunteerId = null;
  }
  if (source?.createdAt) data.createdAt = source.createdAt;
  return data;
};

/**
 * Main login lookup. Order:
 *  1. users/{uid}            (fast path)
 *  2. query email == <email> (fallback)
 *  3. query fullName == <email> (legacy)
 *  4. VITE_ADMIN_EMAIL bootstrap
 */
export const resolveUserAccess = async ({ uid, email }) => {
  const normalized = normalizeEmail(email);
  devLog("login lookup start", { email: normalized, uid, collection: COLLECTION });

  try {
    if (uid) {
      const snap = await getDoc(doc(db, COLLECTION, uid));
      if (snap.exists()) {
        const user = normalizeUser(snap.id, snap.data());
        devLog("found via users/{uid}", { role: user.role, active: user.active });
        return { success: true, user };
      }
    }

    if (normalized) {
      const byEmail = await getDocs(query(collection(db, COLLECTION), where("email", "==", normalized)));
      if (!byEmail.empty) {
        const d = byEmail.docs[0];
        const canonicalData = withCanonicalAccountStatus(d.data());
        const user = normalizeUser(d.id, canonicalData);
        // Migrate: if the doc id is not the auth UID, mirror it to users/{uid}
        if (uid && d.id !== uid) {
          if (auth.currentUser?.uid !== uid || auth.currentUser.emailVerified !== true) {
            return { success: false, error: "Verified invitation claim required" };
          }
          try {
            await setDoc(
              doc(db, COLLECTION, uid),
              bootstrapFields(canonicalData, normalized),
              { merge: true },
            );
            devLog("mirrored legacy doc to users/{uid}", { from: d.id, to: uid });
          } catch (e) {
            devLog("mirror failed", e.message);
            return { success: false, error: "Invitation claim failed" };
          }
        }
        return { success: true, user };
      }

      const byFullName = await getDocs(query(collection(db, COLLECTION), where("fullName", "==", normalized)));
      if (!byFullName.empty) {
        const d = byFullName.docs[0];
        const user = normalizeUser(d.id, d.data());
        return { success: true, user };
      }
    }

    const bootstrapEmail = normalizeEmail(import.meta.env.VITE_ADMIN_EMAIL);
    if (uid && normalized && bootstrapEmail && normalized === bootstrapEmail) {
      const data = {
        email: normalized,
        fullName: normalized,
        displayName: "",
        phoneNumber: "",
        role: "admin",
        status: "active",
        active: true,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      await setDoc(doc(db, COLLECTION, uid), data);
      return { success: true, user: normalizeUser(uid, data) };
    }

    return { success: false, error: "Not found" };
  } catch (error) {
    console.error("resolveUserAccess error:", error);
    return { success: false, error: error.message };
  }
};

export const getAllowedUserByEmail = async (email) => resolveUserAccess({ uid: null, email });

export const listAllowedUsers = async () => {
  try {
    const qs = await getDocs(collection(db, COLLECTION));
    return {
      success: true,
      users: qs.docs.map((d) => normalizeUser(d.id, d.data())),
    };
  } catch (error) {
    console.error("listAllowedUsers error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Invite a new user through the Admin-authorized callable, then send the
 * password-setup email after Auth and Firestore creation both succeed.
 */
export const inviteUser = async ({ email, displayName, role, active = true, linkedVolunteerId = null }) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return { success: false, error: "יש להזין כתובת אימייל" };
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(normalized)) {
    return { success: false, error: "כתובת אימייל אינה תקינה" };
  }
  if (!["admin", "volunteer"].includes(role)) {
    return { success: false, error: "Invalid role" };
  }
  if (role === "volunteer" && !linkedVolunteerId) {
    return { success: false, error: "יש לבחור פרופיל מתנדב לקישור" };
  }

  // Duplicate-email guard: block if any users doc already has this email.
  try {
    const dupEmail = await getDocs(query(collection(db, COLLECTION), where("email", "==", normalized)));
    if (!dupEmail.empty) {
      return { success: false, error: "אימייל זה כבר קיים במערכת" };
    }
  } catch (e) {
    console.warn("duplicate email check failed:", e.message);
  }

  // Duplicate-volunteer-link guard: block if another user is already linked.
  if (role === "volunteer" && linkedVolunteerId) {
    try {
      const dupLink = await getDocs(
        query(collection(db, COLLECTION), where("linkedVolunteerId", "==", linkedVolunteerId)),
      );
      if (!dupLink.empty) {
        return { success: false, error: "מתנדב זה כבר מקושר למשתמש אחר" };
      }
    } catch (e) {
      console.warn("duplicate volunteer link check failed:", e.message);
    }
  }

  try {
    const functions = await getJoinRequestFunctions();
    if (!functions) throw new Error("Application verification is not configured.");
    const createInvitation = httpsCallable(functions, "inviteUser");
    const response = await createInvitation({
      email: normalized,
      displayName: displayName || "",
      role,
      active,
      linkedVolunteerId: role === "volunteer" ? linkedVolunteerId : null,
    });

    // Do not report success until the password-setup email call also succeeds.
    await sendPasswordResetEmail(auth, normalized);

    return {
      success: true,
      createdNewAuth: response.data?.createdAuthUser === true,
      message: "המשתמש נוסף ונשלחה אליו הודעה להגדרת סיסמה",
    };
  } catch (error) {
    console.error("inviteUser error:", error);
    const safeMessage = error?.code === "functions/already-exists"
      ? "Email is already invited."
      : "The invitation could not be completed. Please try again or review the account.";
    return { success: false, error: safeMessage };
  }
};

// Backwards-compatible name used by Settings page
export const createAllowedUser = inviteUser;

/** Resend the password setup / reset email for an existing user. */
export const sendPasswordSetupEmail = async (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return { success: false, error: "Email required" };
  try {
    await sendPasswordResetEmail(auth, normalized);
    return { success: true, message: "נשלח קישור להגדרת סיסמה מחדש" };
  } catch (error) {
    console.error("sendPasswordSetupEmail error:", error);
    return { success: false, error: error.message };
  }
};

export const updateAllowedUser = async (id, patch) => {
  try {
    const clean = { ...patch, updatedAt: serverTimestamp() };
    if (clean.email) clean.email = normalizeEmail(clean.email);
    // Accept the old `{ active: boolean }` call shape for compatibility, but
    // immediately translate it to the authoritative status field. Conflicting
    // input is rejected instead of silently choosing the less-safe value.
    if (typeof clean.active === "boolean" && clean.status == null) {
      clean.status = clean.active ? "active" : "inactive";
    }
    if (clean.status != null) {
      if (!["active", "inactive"].includes(clean.status)) {
        return { success: false, error: "Invalid account status" };
      }
      if (typeof clean.active === "boolean" && clean.active !== (clean.status === "active")) {
        return { success: false, error: "Conflicting account status fields" };
      }
      clean.active = clean.status === "active";
    }
    await updateDoc(doc(db, COLLECTION, id), clean);
    return { success: true };
  } catch (error) {
    console.error("updateAllowedUser error:", error);
    return { success: false, error: error.message };
  }
};

export const deleteAllowedUser = async (id, linkedVolunteerId = null) => {
  try {
    const userRef = doc(db, COLLECTION, id);
    const volunteerRef = linkedVolunteerId
      ? doc(db, "volunteers", linkedVolunteerId)
      : null;
    const result = await runTransaction(db, async (transaction) => {
      const [userSnap, volunteerSnap] = await Promise.all([
        transaction.get(userRef),
        volunteerRef ? transaction.get(volunteerRef) : Promise.resolve(null),
      ]);
      if (!userSnap.exists()) {
        return { deleted: false, idempotentReplay: true };
      }
      const canonicalVolunteerId = userSnap.data().linkedVolunteerId || linkedVolunteerId;
      if (canonicalVolunteerId && canonicalVolunteerId !== linkedVolunteerId) {
        const error = new Error("Linked volunteer changed concurrently");
        error.code = "db01/linked-volunteer-conflict";
        throw error;
      }
      if (
        volunteerRef
        && volunteerSnap?.exists()
        && volunteerSnap.data().authUid === id
      ) {
        transaction.update(volunteerRef, {
          authUid: null,
          updatedAt: serverTimestamp(),
        });
      }
      transaction.delete(userRef);
      return { deleted: true, idempotentReplay: false };
    });
    return { success: true, ...result };
  } catch (error) {
    console.error("deleteAllowedUser error:", error);
    return { success: false, error: error.message };
  }
};
