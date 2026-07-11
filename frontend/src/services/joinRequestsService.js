// src/services/joinRequestsService.js
// Service layer for public "join us" (joinRequests) submissions.
// UI components must NOT import firebase/firestore directly for this flow.

import { db } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { sanitizeText } from "../utils/sanitize";

/**
 * Create a public join request document.
 *
 * Payload shape (matches Firestore rules for /joinRequests):
 *   { fullName, phone, type, message }
 *
 * Also attempts to create a matching admin notification. If the
 * notification write fails (e.g. transient permission or network),
 * the join request is still considered successful — the caller
 * gets { success: true, id, notificationError }.
 *
 * Collection: "joinRequests" (unchanged)
 * Notification collection: "notifications" (unchanged)
 */
export async function createJoinRequest({ fullName, phone, type, message, email }) {
  const safeName = sanitizeText(fullName, 200);
  const safePhone = sanitizeText(phone, 40);
  const safeType = sanitizeText(type, 100);
  const safeMessage = sanitizeText(message, 2000);
  const safeEmail = email ? sanitizeText(email, 250) : "";

  const reqRef = await addDoc(collection(db, "joinRequests"), {
    fullName: safeName,
    phone: safePhone,
    note: `${safeType} - ${safeMessage}`.trim(),
    type: safeType,
    status: "new",
    email: safeEmail,
    createdAt: serverTimestamp(),
  });

  let notificationError = null;
  try {
    await addDoc(collection(db, "notifications"), {
      audience: "admin",
      type: "join_request",
      title: "בקשת הצטרפות חדשה התקבלה",
      message: `${safeName} שלח/ה בקשת הצטרפות (${safeType})`,
      requestId: reqRef.id,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (notifErr) {
    notificationError = notifErr;
  }

  return { success: true, id: reqRef.id, notificationError };
}

/**
 * Admin: fetch every join request. Returns { id, ...data }[] in
 * whatever order Firestore returns them (matches previous inline
 * behavior in Dashboard.jsx / Reports.jsx).
 */
export async function getJoinRequests() {
  const snap = await getDocs(collection(db, "joinRequests"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Admin: delete a join request by id.
 */
export async function deleteJoinRequest(requestId) {
  await deleteDoc(doc(db, "joinRequests", requestId));
}
