// src/services/allowedUsersService.js
// Role/permission lookup + admin-side invite flow.
//
// Invite flow notes:
//  - We create the Firebase Auth user from a SECONDARY Firebase app instance
//    so the admin's own session is NOT replaced.
//  - The new user receives a standard Firebase password-reset email, which
//    they use to set their own password. No password is ever stored in
//    Firestore, and the admin never types a password for them.
//  - If the email already exists in Auth, we simply (re)send the reset email
//    and upsert the Firestore document.

import { db } from "../firebase";
import { initializeApp, deleteApp, getApps, getApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from "firebase/auth";
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
} from "firebase/firestore";

const COLLECTION = "users";

const normalizeEmail = (email) => (email || "").trim().toLowerCase();
const emailToId = (email) => normalizeEmail(email).replace(/[^a-z0-9]/g, "_");

const isUserActive = (u) => (u?.status != null ? u.status === "active" : u?.active === true);

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

const devLog = (...args) => console.info("[auth-debug]", ...args);

// --- Secondary Firebase app helper (so creating a user doesn't sign the admin out) ---
const SECONDARY_NAME = "Secondary";
const getSecondaryAuth = () => {
  const primary = getApp();
  const existing = getApps().find((a) => a.name === SECONDARY_NAME);
  const app = existing || initializeApp(primary.options, SECONDARY_NAME);
  return { app, auth: getAuth(app) };
};
const teardownSecondary = async ({ app, auth }) => {
  try {
    await signOut(auth);
  } catch {}
  try {
    await deleteApp(app);
  } catch {}
};

const randomPassword = () => `Tmp!${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}A1`;

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
        const user = normalizeUser(d.id, d.data());
        // Migrate: if the doc id is not the auth UID, mirror it to users/{uid}
        if (uid && d.id !== uid) {
          try {
            await setDoc(doc(db, COLLECTION, uid), { ...d.data(), email: normalized }, { merge: true });
            devLog("mirrored legacy doc to users/{uid}", { from: d.id, to: uid });
          } catch (e) {
            devLog("mirror failed", e.message);
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
 * Invite a new user:
 *  - Create the Firebase Auth account (via a secondary app, so the admin
 *    session is preserved).
 *  - Write users/{uid} in Firestore with role/status.
 *  - Send a password-reset email so the user picks their own password.
 *
 * If the email already exists in Auth, we upsert Firestore (by email) and
 * resend the password-reset email instead of failing.
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

  const secondary = getSecondaryAuth();
  try {
    let uid;
    let createdNewAuth = false;
    try {
      const cred = await createUserWithEmailAndPassword(secondary.auth, normalized, randomPassword());
      uid = cred.user.uid;
      createdNewAuth = true;
    } catch (err) {
      if (err?.code !== "auth/email-already-in-use") {
        throw err;
      }
      devLog("auth account already exists, will upsert + resend reset", { email: normalized });
    }

    // Send password-setup email (works for both new and existing auth accounts)
    try {
      await sendPasswordResetEmail(secondary.auth, normalized);
    } catch (e) {
      console.warn("sendPasswordResetEmail failed:", e.message);
    }

    // Upsert Firestore document. When the Auth account already existed we
    // don't know the uid — fall back to a deterministic emailToId doc, which
    // the user will mirror into users/{uid} on their first login (allowed by
    // the self-bootstrap rule).
    const docId = uid || emailToId(normalized);
    const data = {
      email: normalized,
      fullName: displayName || "",
      displayName: displayName || "",
      role,
      status: active ? "active" : "inactive",
      active,
      updatedAt: serverTimestamp(),
    };
    if (role === "volunteer" && linkedVolunteerId) {
      data.linkedVolunteerId = linkedVolunteerId;
    } else if (role === "admin") {
      // Never leave a stale volunteer link on an admin account.
      data.linkedVolunteerId = null;
    }
    const existing = await getDoc(doc(db, COLLECTION, docId));
    if (!existing.exists()) data.createdAt = serverTimestamp();
    await setDoc(doc(db, COLLECTION, docId), data, { merge: true });

    // Link the Firebase Auth uid back onto the volunteer profile so that
    // volunteers/{volunteerDocId}.authUid == auth.uid (used by the volunteer
    // site's rules fallback). When the Auth account pre-existed we don't
    // know the uid here — the rules also accept the linkedVolunteerId path
    // via users/{uid}.linkedVolunteerId, so login still works.
    if (role === "volunteer" && linkedVolunteerId) {
      try {
        await updateDoc(doc(db, "volunteers", linkedVolunteerId), {
          authUid: uid || null,
          // Sync the volunteer's email to the login email so that the
          // users/{uid} self-bootstrap rule (which requires
          // volunteers.email == auth.token.email) succeeds on first login
          // when the Firebase Auth account already existed.
          email: normalized,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn("linkVolunteerAuthUid failed:", e.message);
      }
    }

    return {
      success: true,
      createdNewAuth,
      user: { id: docId, ...data },
      message: "המשתמש נוסף ונשלחה אליו הודעה להגדרת סיסמה",
    };
  } catch (error) {
    console.error("inviteUser error:", error);
    return { success: false, error: error.message };
  } finally {
    await teardownSecondary(secondary);
  }
};

// Backwards-compatible name used by Settings page
export const createAllowedUser = inviteUser;

/** Resend the password setup / reset email for an existing user. */
export const sendPasswordSetupEmail = async (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return { success: false, error: "Email required" };
  const secondary = getSecondaryAuth();
  try {
    await sendPasswordResetEmail(secondary.auth, normalized);
    return { success: true, message: "נשלח קישור להגדרת סיסמה מחדש" };
  } catch (error) {
    console.error("sendPasswordSetupEmail error:", error);
    return { success: false, error: error.message };
  } finally {
    await teardownSecondary(secondary);
  }
};

export const updateAllowedUser = async (id, patch) => {
  try {
    const clean = { ...patch, updatedAt: serverTimestamp() };
    if (clean.email) clean.email = normalizeEmail(clean.email);
    if (typeof clean.active === "boolean") {
      clean.status = clean.active ? "active" : "inactive";
    } else if (clean.status) {
      clean.active = clean.status === "active";
    }
    await updateDoc(doc(db, COLLECTION, id), clean);
    return { success: true };
  } catch (error) {
    console.error("updateAllowedUser error:", error);
    return { success: false, error: error.message };
  }
};

export const deleteAllowedUser = async (id) => {
  try {
    await deleteDoc(doc(db, COLLECTION, id));
    return { success: true };
  } catch (error) {
    console.error("deleteAllowedUser error:", error);
    return { success: false, error: error.message };
  }
};
