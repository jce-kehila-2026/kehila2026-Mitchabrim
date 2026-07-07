// src/services/usersService.js
// Read/update helpers for the "users" collection used by the admin
// topbar profile fetch and the "my profile" modal. Firestore rules
// require isAdmin() (or a matching auth.uid) for these operations.
//
// This is intentionally a narrow surface — the invite / role
// bootstrap flow still lives in allowedUsersService.js and must not
// be duplicated here.

import { db } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";

const COLLECTION = "users";

/**
 * Look up a single user document by lowercased email.
 * Returns { id, ...data } or null.
 * Preserves the exact query used by the admin topbars.
 */
export async function getUserByEmail(email) {
  const normalized = (email || "").toLowerCase();
  if (!normalized) return null;
  const q = query(collection(db, COLLECTION), where("email", "==", normalized));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

/**
 * Update the admin's own profile fields (fullName + phoneNumber).
 * Uses a client-side Timestamp.now() so the caller can echo the value
 * back into local state synchronously (matching the original AdminTopbar
 * behavior). Returns the timestamp used.
 */
export async function updateUserProfileFields(docId, { fullName, phoneNumber }) {
  const now = Timestamp.now();
  await updateDoc(doc(db, COLLECTION, docId), {
    fullName,
    displayName: fullName,
    phoneNumber,
    updatedAt: now,
  });
  return now;
}
