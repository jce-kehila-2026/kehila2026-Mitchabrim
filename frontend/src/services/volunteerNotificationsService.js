// src/services/volunteerNotificationsService.js
//
// Encapsulates Firestore access for the `volunteerNotifications` collection.
// Only exposes queries scoped to a single volunteer's auth uid so callers
// cannot accidentally read notifications belonging to other volunteers.

import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * Subscribe to the notifications belonging to a single volunteer.
 *
 * @param {string} volunteerAuthUid - Firebase Auth uid of the volunteer.
 * @param {(items: Array) => void} onChange - called with the latest list.
 * @param {(err: Error) => void} [onError] - optional error callback.
 * @returns {() => void} unsubscribe
 */
export function subscribeVolunteerNotifications(volunteerAuthUid, onChange, onError) {
  if (!volunteerAuthUid) {
    // Return a no-op unsubscribe so callers can always call it.
    return () => {};
  }
  const q = query(
    collection(db, "volunteerNotifications"),
    where("volunteerAuthUid", "==", volunteerAuthUid),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      if (onError) onError(err);
      else console.warn("volunteerNotifications subscribe:", err.message);
    }
  );
}

/**
 * Mark a volunteer notification as read.
 * The Firestore rule requires the doc's volunteerAuthUid == request.auth.uid.
 */
export async function markVolunteerNotificationRead(notificationId) {
  if (!notificationId) return;
  await updateDoc(doc(db, "volunteerNotifications", notificationId), { read: true });
}
