// src/services/notificationsService.js
// Admin-facing "notifications" collection.
// Used by AdminTopbar.jsx and HeroTopbar.jsx.
//
// Firestore rules require isAdmin() to read this collection, so all
// callers of subscribeAdminNotifications must already be signed in as
// an admin (both topbars are only rendered inside /admin).

import { db } from "../firebase";
import {
  collection,
  query,
  orderBy,
  limit as fbLimit,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";

const COLLECTION = "notifications";

/**
 * Subscribe to admin notifications, newest first.
 * Preserves the exact query used by AdminTopbar/HeroTopbar:
 *   orderBy("createdAt", "desc"), limit(20)
 *
 * @param {(items: Array) => void} onData
 * @param {(err: Error) => void} [onError]
 * @param {{ max?: number }} [opts]
 * @returns {() => void} unsubscribe
 */
export function subscribeAdminNotifications(onData, onError, { max = 20 } = {}) {
  const q = query(
    collection(db, COLLECTION),
    orderBy("createdAt", "desc"),
    fbLimit(max)
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      if (onError) onError(err);
      else console.warn("admin notifications listen error:", err.message);
    }
  );
}

/**
 * Mark a single admin notification as read.
 * Requires isAdmin() per Firestore rules.
 */
export async function markAdminNotificationRead(notificationId) {
  if (!notificationId) return;
  await updateDoc(doc(db, COLLECTION, notificationId), { read: true });
}
