import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  where,
  orderBy,
} from "firebase/firestore";

import { db } from "../firebase";
import { sanitizeFormData, sanitizeText } from "../utils/sanitize";

const tasksCollection = collection(db, "volunteerTasks");

export async function getAllTasks() {
  try {
    const q = query(tasksCollection, orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    const snap = await getDocs(tasksCollection);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  }
}

export async function getTasksForVolunteer(volunteerId) {
  if (!volunteerId) return [];
  try {
    const q = query(
      tasksCollection,
      where("volunteerId", "==", volunteerId),
      orderBy("createdAt", "desc"),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    const q = query(tasksCollection, where("volunteerId", "==", volunteerId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  }
}

export async function getTasksForAuthUid(authUid) {
  if (!authUid) return [];
  try {
    const q = query(
      tasksCollection,
      where("volunteerAuthUid", "==", authUid),
      orderBy("createdAt", "desc"),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    const q = query(tasksCollection, where("volunteerAuthUid", "==", authUid));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  }
}

export async function createTask(data, createdBy = null) {
  const payload = {
    volunteerId: data.volunteerId || null,
    volunteerAuthUid: data.volunteerAuthUid || null,
    volunteerName: sanitizeText(data.volunteerName, 200),
    title: sanitizeText(data.title, 200),
    description: sanitizeText(data.description, 5000),
    taskType: sanitizeText(data.taskType, 60) || "other",
    elderlyId: data.elderlyId || null,
    elderlyName: sanitizeText(data.elderlyName, 200),
    dueDate: data.dueDate || null,
    status: sanitizeText(data.status, 40) || "open",
    priority: sanitizeText(data.priority, 40) || "normal",
    createdBy: createdBy || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(tasksCollection, payload);

  // Create a single notification for the volunteer (only at creation time,
  // so refreshing the admin page does not duplicate notifications).
  if (payload.volunteerAuthUid) {
    try {
      await addDoc(collection(db, "volunteerNotifications"), {
        volunteerAuthUid: payload.volunteerAuthUid,
        volunteerId: payload.volunteerId,
        type: "task_assigned",
        title: "משימה חדשה שובצה אליך",
        message: payload.title
          ? `שובצה אליך משימה חדשה: ${payload.title}`
          : "שובצה אליך משימה חדשה. ניתן לצפות בה במסך המשימות שלי.",
        taskId: docRef.id,
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn("createTask: notification failed:", err.message);
    }
  }

  return { id: docRef.id, ...payload };
}


export async function updateTask(taskId, patch) {
  const ref = doc(db, "volunteerTasks", taskId);
  await updateDoc(ref, { ...sanitizeFormData(patch), updatedAt: serverTimestamp() });
}

export async function deleteTask(taskId) {
  const ref = doc(db, "volunteerTasks", taskId);
  await deleteDoc(ref);
}

export const TASK_STATUS_OPTIONS = [
  { value: "open", label: "פתוחה" },
  { value: "in_progress", label: "בטיפול" },
  { value: "done", label: "בוצעה" },
  { value: "cancelled", label: "בוטלה" },
];

export const TASK_TYPE_OPTIONS = [
  { value: "visit", label: "ביקור בית" },
  { value: "call", label: "שיחת טלפון" },
  { value: "package", label: "חלוקת חבילה" },
  { value: "event", label: "אירוע" },
  { value: "other", label: "אחר" },
];

export const TASK_PRIORITY_OPTIONS = [
  { value: "low", label: "נמוכה" },
  { value: "normal", label: "רגילה" },
  { value: "high", label: "גבוהה" },
];

export const taskStatusLabel = (s) =>
  TASK_STATUS_OPTIONS.find((o) => o.value === s)?.label || "פתוחה";
export const taskTypeLabel = (t) =>
  TASK_TYPE_OPTIONS.find((o) => o.value === t)?.label || t || "—";
export const taskStatusBadge = (s) =>
  s === "done" ? "badge-green" : s === "in_progress" ? "badge-orange" : s === "cancelled" ? "badge-gray" : "badge-orange";