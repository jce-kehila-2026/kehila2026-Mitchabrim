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
  startAfter,
  limit as fbLimit,
  onSnapshot,
  getDocs,
  getDoc,
  doc,
  serverTimestamp,
  Timestamp,
  runTransaction,
  writeBatch,
} from "firebase/firestore";
import { sanitizeText } from "../utils/sanitize";
import { retrySafeRead } from "../utils/errorPolicy";
import { requireOperationId } from "../utils/operationId";
import { profileUpdateRequestExpiryDate } from "../utils/profileUpdateRequestRetention";

const COLLECTION = "profileUpdateRequests";
const PENDING_LOCKS_COLLECTION = "profileUpdateRequestPending";
export const PROFILE_REQUEST_PAGE_SIZE = 20;

const mapRequest = (snapshot) => ({ id: snapshot.id, ...snapshot.data() });

function pendingQueryForVolunteer(volunteerAuthUid) {
  return query(
    collection(db, COLLECTION),
    where("volunteerAuthUid", "==", volunteerAuthUid),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc"),
    fbLimit(1),
  );
}

function pendingExistsError(requestId = null) {
  const error = new Error("A pending profile update request already exists");
  error.code = "profile-update/pending-exists";
  error.requestId = requestId;
  return error;
}

/**
 * Subscribe to all profile update requests (admin view), newest first.
 * Optional `max` caps the live operational window used by Dashboard.
 * Full management history uses cursor-based page functions below.
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

async function getRequestPage(baseParts, { pageSize = PROFILE_REQUEST_PAGE_SIZE, cursor = null } = {}) {
  const safePageSize = Math.min(Math.max(Number(pageSize) || PROFILE_REQUEST_PAGE_SIZE, 1), 50);
  const parts = [...baseParts];
  if (cursor) parts.push(startAfter(cursor));
  parts.push(fbLimit(safePageSize + 1));

  const snap = await retrySafeRead(() => getDocs(query(...parts)));
  const hasMore = snap.docs.length > safePageSize;
  const pageDocs = hasMore ? snap.docs.slice(0, safePageSize) : snap.docs;
  return {
    items: pageDocs.map(mapRequest),
    cursor: pageDocs.at(-1) || null,
    hasMore,
  };
}

export function getProfileUpdateRequestsPageForVolunteer(
  volunteerAuthUid,
  options = {},
) {
  return getRequestPage([
    collection(db, COLLECTION),
    where("volunteerAuthUid", "==", volunteerAuthUid),
    orderBy("createdAt", "desc"),
  ], options);
}

export function getProfileUpdateRequestsPageForAdmin(
  { status = "pending", ...options } = {},
) {
  const parts = [collection(db, COLLECTION)];
  if (status && status !== "all") parts.push(where("status", "==", status));
  parts.push(orderBy("createdAt", "desc"));
  return getRequestPage(parts, options);
}

export async function getPendingProfileUpdateRequestForVolunteer(volunteerAuthUid) {
  const snap = await retrySafeRead(() => getDocs(pendingQueryForVolunteer(volunteerAuthUid)));
  return snap.empty ? null : mapRequest(snap.docs[0]);
}

export async function getProfileUpdateRequestById(requestId) {
  const snap = await retrySafeRead(() => getDoc(doc(db, COLLECTION, requestId)));
  return snap.exists() ? mapRequest(snap) : null;
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

  const existingPending = await getPendingProfileUpdateRequestForVolunteer(volunteerAuthUid);
  if (existingPending) throw pendingExistsError(existingPending.id);

  const reqRef = doc(db, COLLECTION, `profile_${safeOperationId}`);
  const pendingLockRef = doc(db, PENDING_LOCKS_COLLECTION, volunteerAuthUid);
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

  const batch = writeBatch(db);
  batch.set(reqRef, requestPayload);
  batch.set(pendingLockRef, {
    volunteerAuthUid,
    requestId: reqRef.id,
    createdAt: serverTimestamp(),
  });
  batch.set(notificationRef, notificationPayload);

  try {
    await batch.commit();
    return { id: reqRef.id, idempotentReplay: false };
  } catch (error) {
    // A retry of a commit whose response was lost reaches the update rule and
    // is denied. Only then read the now-existing, volunteer-owned request and
    // accept it when both immutable operation identifiers match.
    if (error?.code === "permission-denied") {
      try {
        const existing = await getDoc(reqRef);
        if (
          existing.exists()
          && existing.data().operationId === safeOperationId
          && existing.data().volunteerAuthUid === volunteerAuthUid
        ) {
          return { id: reqRef.id, idempotentReplay: true };
        }
      } catch {
        // Preserve the original batch failure when no own request is readable.
      }
      const pending = await getPendingProfileUpdateRequestForVolunteer(volunteerAuthUid)
        .catch(() => null);
      if (pending) throw pendingExistsError(pending.id);
    }
    throw error;
  }
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
  const pendingLockRef = doc(db, PENDING_LOCKS_COLLECTION, volunteerAuthUid);
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
    const [requestSnap, notificationSnap, pendingLockSnap] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(notificationRef),
      transaction.get(pendingLockRef),
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
    if (
      current.status === decision
      && !current.expiresAt
      && current.reviewedAt?.toDate
    ) {
      transaction.update(requestRef, {
        expiresAt: Timestamp.fromDate(
          profileUpdateRequestExpiryDate(current.reviewedAt.toDate()),
        ),
      });
    }
    if (current.status === "pending") {
      const reviewedAt = Timestamp.now();
      transaction.update(requestRef, {
        status: decision,
        adminResponse: safeResponse,
        reviewedAt,
        expiresAt: Timestamp.fromDate(
          profileUpdateRequestExpiryDate(reviewedAt.toDate()),
        ),
        reviewedBy: auth.currentUser?.uid || null,
      });
    }
    if (pendingLockSnap.exists() && pendingLockSnap.data().requestId === requestId) {
      transaction.delete(pendingLockRef);
    }
    if (current.status === decision && notificationSnap.exists()) {
      return { id: requestId, decision, idempotentReplay: true };
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
  const requestRef = doc(db, COLLECTION, requestId);
  await runTransaction(db, async (transaction) => {
    const requestSnap = await transaction.get(requestRef);
    if (!requestSnap.exists()) return;

    const volunteerAuthUid = requestSnap.data().volunteerAuthUid;
    const pendingLockRef = volunteerAuthUid
      ? doc(db, PENDING_LOCKS_COLLECTION, volunteerAuthUid)
      : null;
    const pendingLockSnap = pendingLockRef
      ? await transaction.get(pendingLockRef)
      : null;

    transaction.delete(requestRef);
    if (pendingLockSnap?.exists() && pendingLockSnap.data().requestId === requestId) {
      transaction.delete(pendingLockRef);
    }
  });
}
