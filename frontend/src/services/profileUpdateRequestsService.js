// src/services/profileUpdateRequestsService.js
// Service layer for the profileUpdateRequests collection and the
// related admin/volunteer notification writes. UI components should
// not import firebase/firestore directly for this flow.

import { db, auth } from "../firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit as fbLimit,
  onSnapshot,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { sanitizeText } from "../utils/sanitize";

const COLLECTION = "profileUpdateRequests";

/**
 * Subscribe to all profile update requests (admin view), newest first.
 * Optional `max` caps the result window (Dashboard passes 50; the
 * admin ProfileUpdateRequests page passes nothing = no limit).
 * Returns the unsubscribe function.
 */
export function subscribeAllProfileUpdateRequests(onData, onError, { max } = {}) {
  const parts = [collection(db, COLLECTION), orderBy("createdAt", "desc")];
  const q = max ? query(...parts, fbLimit(max)) : query(...parts);
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => onError && onError(err)
  );
}

/**
 * Fetch the complete admin request history once.
 * The management page does not need a continuously re-delivered historical
 * collection; the dashboard keeps the bounded live operational window.
 */
export async function getAllProfileUpdateRequests() {
  const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Subscribe to profile update requests for a single volunteer, newest first.
 * Filter matches Firestore rules: volunteerAuthUid == auth.uid.
 */
export function subscribeProfileUpdateRequestsForVolunteer(volunteerAuthUid, onData, onError) {
  const q = query(
    collection(db, COLLECTION),
    where("volunteerAuthUid", "==", volunteerAuthUid),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => onError && onError(err)
  );
}

/**
 * Volunteer submits a profile update request.
 * Payload shape is preserved exactly; also creates the matching
 * admin "profile_update_request" notification.
 */
export async function createProfileUpdateRequest({
  volunteerId,
  volunteerAuthUid,
  volunteerName,
  message,
}) {
  const trimmed = sanitizeText(message, 1000);
  const safeVolName = sanitizeText(volunteerName, 200);

  const reqRef = await addDoc(collection(db, COLLECTION), {
    volunteerId,
    volunteerAuthUid,
    volunteerName: safeVolName,
    message: trimmed,
    status: "pending",
    createdAt: serverTimestamp(),
    reviewedAt: null,
    reviewedBy: null,
    adminResponse: "",
  });

  await addDoc(collection(db, "notifications"), {
    audience: "admin",
    type: "profile_update_request",
    title: "בקשה חדשה לעדכון פרטי מתנדב",
    message: `${safeVolName} שלח/ה בקשה לעדכון פרטים`,
    requestId: reqRef.id,
    read: false,
    createdAt: serverTimestamp(),
  });

  return { id: reqRef.id };
}

/**
 * Admin approves or rejects a profile update request and notifies the
 * volunteer. `decision` is "approved" or "rejected".
 */
export async function decideProfileUpdateRequest({ requestId, volunteerAuthUid, decision, response }) {
  const safeResponse = sanitizeText(response, 2000);

  await updateDoc(doc(db, COLLECTION, requestId), {
    status: decision,
    adminResponse: safeResponse,
    reviewedAt: serverTimestamp(),
    reviewedBy: auth.currentUser?.uid || null,
  });

  await addDoc(collection(db, "volunteerNotifications"), {
    volunteerAuthUid,
    type: "profile_update_response",
    title: decision === "approved" ? "הבקשה שלך אושרה" : "הבקשה שלך נדחתה",
    message:
      safeResponse ||
      (decision === "approved"
        ? "בקשתך לעדכון פרטים אושרה על ידי המנהל."
        : "בקשתך לעדכון פרטים נדחתה על ידי המנהל."),
    requestId,
    read: false,
    createdAt: serverTimestamp(),
  });
}

/**
 * Admin: delete a profile update request by id.
 */
export async function deleteProfileUpdateRequest(requestId) {
  await deleteDoc(doc(db, COLLECTION, requestId));
}
