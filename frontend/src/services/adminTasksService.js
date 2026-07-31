// src/services/adminTasksService.js
// Personal admin task list used only by the /admin dashboard.
//
// Collection: "tasks" (kept as-is; do NOT rename or move — this is a
// separate collection from "volunteerTasks", which is owned by
// tasksService.js).
//
// Firestore rules gate "tasks" via the catch-all isAdmin() fallback.
// The subscription is filtered by adminId in code to preserve the
// current single-admin view.

import { db } from "../firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

const COLLECTION = "tasks";

/**
 * Subscribe to personal admin tasks for a single admin uid.
 * Sorting is performed client-side (matches previous inline behavior
 * so we do not need a composite index).
 *
 * @param {string} adminId
 * @param {(items: Array) => void} onData
 * @param {(err: Error) => void} [onError]
 * @returns {() => void} unsubscribe (no-op when adminId is falsy)
 */
export function subscribeAdminTasks(adminId, onData, onError) {
  if (!adminId) return () => {};
  const q = query(collection(db, COLLECTION), where("adminId", "==", adminId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort(
        (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      );
      onData(list);
    },
    (err) => {
      if (onError) onError(err);
      else console.warn("personal tasks listen:", err.message);
    }
  );
}

export async function createAdminTask({ adminId, title }) {
  const clean = (title || "").trim();
  return addDoc(collection(db, COLLECTION), {
    title: clean,
    status: "פתוח",
    adminId,
    createdAt: serverTimestamp(),
  });
}

export async function updateAdminTaskStatus(taskId, status) {
  await updateDoc(doc(db, COLLECTION, taskId), { status });
}

export async function updateAdminTaskTitle(taskId, title) {
  await updateDoc(doc(db, COLLECTION, taskId), { title: (title || "").trim() });
}

export async function deleteAdminTask(taskId) {
  await deleteDoc(doc(db, COLLECTION, taskId));
}
