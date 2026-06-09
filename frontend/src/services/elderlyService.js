import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";

import { db } from "../firebase";

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

export async function createElderly(elderlyData) {
  const docRef = await addDoc(elderlyCollection, {
    ...elderlyData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    ...elderlyData,
  };
}

export async function editElderly(elderlyId, elderlyData) {
  const elderlyRef = doc(db, "elderly", elderlyId);

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

/* =========================
   Volunteer Assignment (שיוך מתנדב)
========================= */

export async function assignVolunteerToElderly(elderlyId, volunteerName, status) {
  const elderlyRef = doc(db, "elderly", elderlyId);

  await updateDoc(elderlyRef, {
    volunteerName: volunteerName,
    volunteerStatus: status, 
    updatedAt: serverTimestamp(),
  });
}