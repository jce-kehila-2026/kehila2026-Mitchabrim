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
  where,
  orderBy,
  limit as fbLimit,
  onSnapshot,
  doc,
  updateDoc,
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
  const recentQuery = query(
    collection(db, COLLECTION),
    orderBy("createdAt", "desc"),
    fbLimit(max)
  );
  // Keep the badge exact without listening to the entire read history.
  // This query follows only actionable (unread) documents and is deliberately
  // unordered so it does not require a new composite index.
  const unreadQuery = query(
    collection(db, COLLECTION),
    where("read", "==", false)
  );

  let recent = [];
  let unreadCount = 0;
  let stopped = false;
  const emit = () => {
    if (!stopped) onData(recent, { unreadCount });
  };
  const reportError = (err) => {
    if (onError) onError(err);
    else console.warn("admin notifications listen error:", err.message);
  };

  const unsubscribeRecent = onSnapshot(
    recentQuery,
    (snap) => {
      recent = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      emit();
    },
    reportError
  );
  const unsubscribeUnread = onSnapshot(
    unreadQuery,
    (snap) => {
      unreadCount = snap.size;
      emit();
    },
    reportError
  );

  return () => {
    stopped = true;
    unsubscribeRecent();
    unsubscribeUnread();
  };
}

/**
 * Mark a single admin notification as read.
 */
export async function markAdminNotificationRead(notificationId) {
  if (!notificationId) return;
  await updateDoc(doc(db, COLLECTION, notificationId), { read: true });
}
