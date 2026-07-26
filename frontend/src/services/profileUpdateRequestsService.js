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
  deleteDoc,
  doc,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { sanitizeText } from "../utils/sanitize";
import { retrySafeRead } from "../utils/errorPolicy";
import { requireOperationId } from "../utils/operationId";

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
  const snap = await retrySafeRead(() => getDocs(q));
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
  operationId,
}) {
  const safeOperationId = requireOperationId(operationId);
  const trimmed = sanitizeText(message, 1000);
  const safeVolName = sanitizeText(volunteerName, 200);

  const reqRef = doc(db, COLLECTION, `profile_${safeOperationId}`);
  const notificationRef = doc(db, "notifications", `profile_request_${reqRef.id}`);
  const requestPayload = {
    volunteerId,
    volunteerAuthUid,
    volunteerName: safeVolName,
    message: trimmed,
    status: "pending",
    operationId: safeOperationId,
    createdAt: serverTimestamp(),
    reviewedAt: null,
    reviewedBy: null,
    adminResponse: "",
  };
  const notificationPayload = {
    audience: "admin",
    type: "profile_update_request",
    title: "בקשה חדשה לעדכון פרטי מתנדב",
    message: `${safeVolName} שלח/ה בקשה לעדכון פרטים`,
    requestId: reqRef.id,
    read: false,
    createdAt: serverTimestamp(),
  };

  return runTransaction(db, async (transaction) => {
    const existing = await transaction.get(reqRef);
    if (existing.exists()) {
      if (
        existing.data().operationId !== safeOperationId
        || existing.data().volunteerAuthUid !== volunteerAuthUid
      ) {
        const error = new Error("Profile request operation ID conflict");
        error.code = "db01/operation-conflict";
        throw error;
      }
      return { id: reqRef.id, idempotentReplay: true };
    }
    transaction.set(reqRef, requestPayload);
    transaction.set(notificationRef, notificationPayload);
    return { id: reqRef.id, idempotentReplay: false };
  });
}

/**
 * Admin approves or rejects a profile update request and notifies the
 * volunteer. `decision` is "approved" or "rejected".
 */
export async function decideProfileUpdateRequest({ requestId, volunteerAuthUid, decision, response }) {
  if (!["approved", "rejected"].includes(decision)) {
    const error = new Error("Invalid profile request decision");
    error.code = "db01/invalid-decision";
    throw error;
  }
  const safeResponse = sanitizeText(response, 2000);
  const requestRef = doc(db, COLLECTION, requestId);
  const notificationRef = doc(db, "volunteerNotifications", `profile_response_${requestId}`);
  const notificationPayload = {
    volunteerAuthUid,
    type: "profile_update_response",
    decision,
    title: decision === "approved" ? "הבקשה שלך אושרה" : "הבקשה שלך נדחתה",
    message:
      safeResponse ||
      (decision === "approved"
        ? "בקשתך לעדכון פרטים אושרה על ידי המנהל."
        : "בקשתך לעדכון פרטים נדחתה על ידי המנהל."),
    requestId,
    read: false,
    createdAt: serverTimestamp(),
  };

  return runTransaction(db, async (transaction) => {
    const [requestSnap, notificationSnap] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(notificationRef),
    ]);
    if (!requestSnap.exists()) {
      const error = new Error("Profile update request not found");
      error.code = "db01/not-found";
      throw error;
    }
    const current = requestSnap.data();
    if (current.volunteerAuthUid !== volunteerAuthUid) {
      const error = new Error("Profile request volunteer mismatch");
      error.code = "db01/identity-conflict";
      throw error;
    }
    if (current.status !== "pending" && current.status !== decision) {
      const error = new Error("Profile request was already decided differently");
      error.code = "db01/decision-conflict";
      throw error;
    }
    if (current.status === decision && notificationSnap.exists()) {
      return { id: requestId, decision, idempotentReplay: true };
    }
    if (current.status === "pending") {
      transaction.update(requestRef, {
        status: decision,
        adminResponse: safeResponse,
        reviewedAt: serverTimestamp(),
        reviewedBy: auth.currentUser?.uid || null,
      });
    }
    if (!notificationSnap.exists()) {
      transaction.set(notificationRef, notificationPayload);
    }
    return { id: requestId, decision, idempotentReplay: current.status === decision };
  });
}

/**
 * Admin: delete a profile update request by id.
 */
export async function deleteProfileUpdateRequest(requestId) {
  await deleteDoc(doc(db, COLLECTION, requestId));
}
