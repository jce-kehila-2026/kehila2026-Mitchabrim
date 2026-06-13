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

const parliamentsCollection = collection(db, "parliaments");

/* =========================
   Parliaments (פרלמנטים)
========================= */

export async function getParliaments() {
  const q = query(parliamentsCollection, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createParliament(parliamentData) {
  const docRef = await addDoc(parliamentsCollection, {
    ...parliamentData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: docRef.id, ...parliamentData };
}

export async function editParliament(parliamentId, parliamentData) {
  const ref = doc(db, "parliaments", parliamentId);
  await updateDoc(ref, { ...parliamentData, updatedAt: serverTimestamp() });
  return { id: parliamentId, ...parliamentData };
}

export async function deleteParliament(parliamentId) {
  const ref = doc(db, "parliaments", parliamentId);
  await deleteDoc(ref);
}

/* =========================
   Participant attendance (מעקב נוכחות)
   Stored as subcollection: parliaments/{parliamentId}/participants
========================= */

export async function getParticipants(parliamentId) {
  const col = collection(db, "parliaments", parliamentId, "participants");
  const snapshot = await getDocs(col);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addParticipant(parliamentId, participantData) {
  const col = collection(db, "parliaments", parliamentId, "participants");
  const ref = await addDoc(col, {
    ...participantData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, ...participantData };
}

export async function updateParticipantAttendance(parliamentId, participantId, data) {
  const ref = doc(db, "parliaments", String(parliamentId), "participants", String(participantId));
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
  return { id: participantId, ...data };
}