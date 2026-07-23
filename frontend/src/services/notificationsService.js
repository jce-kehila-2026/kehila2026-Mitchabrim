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
  deleteDoc,
  getDocs,
} from "firebase/firestore";

const COLLECTION = "notifications";

/**
 * Subscribe to admin notifications, newest first.
 *
 * @param {(items: Array) => void} onData
 * @param {(err: Error) => void} [onError]
 * @param {{ max?: number }} [opts]
 * @returns {() => void} unsubscribe
 */
export function subscribeAdminNotifications(onData, onError, { max = 10 } = {}) {
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
 */
export async function markAdminNotificationRead(notificationId) {
  if (!notificationId) return;
  await updateDoc(doc(db, COLLECTION, notificationId), { read: true });
}

/**
 * Keep only the latest `maxKeep` admin notifications. Older ones are
 * deleted (fire-and-forget). Requires isAdmin() per Firestore rules.
 * Returns the number of deleted docs.
 */
export async function pruneAdminNotifications(maxKeep = 10) {
  try {
    const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    const extras = snap.docs.slice(maxKeep);
    if (!extras.length) return 0;
    await Promise.all(extras.map((d) => deleteDoc(d.ref).catch(() => {})));
    return extras.length;
  } catch (e) {
    console.warn("pruneAdminNotifications:", e.message);
    return 0;
  }
}
