import {
  collection,
  addDoc,
  getDoc,
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
import { sanitizeFormData } from "../utils/sanitize";


const elderlyCollection = collection(db, "elderly");

/* =========================
   Elderly (אזרחים ותיקים)
========================= */

export async function getElderly() {
  const q = query(elderlyCollection, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  }));
}

/**
 * Fetch a single elderly document by id.
 * Returns { id, ...data } or null when not found.
 */
export async function getElderlyById(elderlyId) {
  if (!elderlyId) return null;
  const snap = await getDoc(doc(db, "elderly", elderlyId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Returns only the elderly assigned to a specific volunteer (volId match).
 * Safe to call from the volunteer site — matches the Firestore rule.
 */
export async function getElderlyForVolunteer(volunteerId) {
  if (!volunteerId) return [];
  const q = query(elderlyCollection, where("volId", "==", volunteerId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  }));
}


export async function createElderly(elderlyData) {
  const clean = sanitizeFormData(elderlyData);
  const docRef = await addDoc(elderlyCollection, {
    ...clean,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    ...clean,
  };
}

export async function editElderly(elderlyId, elderlyData) {
  const elderlyRef = doc(db, "elderly", elderlyId);
  elderlyData = sanitizeFormData(elderlyData);

  await updateDoc(elderlyRef, {
    ...elderlyData,
    updatedAt: serverTimestamp(),
  });

  return {
    id: elderlyId,
    ...elderlyData,
  };
}

export async function deleteElderly(elderlyId) {
  const elderlyRef = doc(db, "elderly", elderlyId);
  await deleteDoc(elderlyRef);
}
