import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";

import { db } from "../firebase";
import { sanitizeFormData } from "../utils/sanitize";

const parliamentsCollection = collection(db, "parliaments");

/* =========================
   Parliaments (פרלמנטים)
========================= */

export async function getParliaments() {
  const q = query(parliamentsCollection, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      isArchived: data.isArchived !== undefined ? data.isArchived : false,
      deletedAt: data.deletedAt || null,
    };
  });
}

export async function createParliament(parliamentData) {
  const clean = sanitizeFormData(parliamentData);
  const docRef = await addDoc(parliamentsCollection, {
    ...clean,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: docRef.id, ...clean };
}

export async function editParliament(parliamentId, parliamentData) {
  const ref = doc(db, "parliaments", parliamentId);
  const clean = sanitizeFormData(parliamentData);
  await updateDoc(ref, { ...clean, updatedAt: serverTimestamp() });
  return { id: parliamentId, ...clean };
}

export async function deleteParliament(parliamentId) {
  const ref = doc(db, "parliaments", parliamentId);
  await deleteDoc(ref);
}

/* =========================
   Participants (parliament-wide)
   parliaments/{pid}/participants
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

export async function removeParticipant(parliamentId, participantId) {
  const ref = doc(db, "parliaments", String(parliamentId), "participants", String(participantId));
  await deleteDoc(ref);
}

/* =========================
   Meetings (פגישות)
   parliaments/{pid}/meetings/{meetingId} = { date, startTime, location, notes }
========================= */

function meetingsCol(pid) {
  return collection(db, "parliaments", pid, "meetings");
}

export async function getMeetings(parliamentId) {
  const snap = await getDocs(meetingsCol(parliamentId));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addMeeting(parliamentId, data) {
  const ref = await addDoc(meetingsCol(parliamentId), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, ...data };
}

export async function updateMeeting(parliamentId, meetingId, data) {
  const ref = doc(db, "parliaments", parliamentId, "meetings", meetingId);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
  return { id: meetingId, ...data };
}

export async function deleteMeeting(parliamentId, meetingId) {
  const ref = doc(db, "parliaments", parliamentId, "meetings", meetingId);
  await deleteDoc(ref);
}

/* =========================
   Per-meeting attendance
   parliaments/{pid}/meetings/{mid}/attendance/{participantId}
========================= */

function attendanceCol(pid, mid) {
  return collection(db, "parliaments", pid, "meetings", mid, "attendance");
}

export async function getMeetingAttendance(parliamentId, meetingId) {
  const snap = await getDocs(attendanceCol(parliamentId, meetingId));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function upsertMeetingAttendance(parliamentId, meetingId, participantId, data) {
  const ref = doc(
    db, "parliaments", parliamentId, "meetings", meetingId, "attendance", String(participantId)
  );
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  return { id: participantId, ...data };
}

/* =========================
   Per-meeting expenses
   parliaments/{pid}/meetings/{mid}/expenses/{expenseId}
========================= */

function expensesCol(pid, mid) {
  return collection(db, "parliaments", pid, "meetings", mid, "expenses");
}

export async function getMeetingExpenses(parliamentId, meetingId) {
  const snap = await getDocs(expensesCol(parliamentId, meetingId));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addMeetingExpense(parliamentId, meetingId, data) {
  const ref = await addDoc(expensesCol(parliamentId, meetingId), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, ...data };
}

export async function updateMeetingExpense(parliamentId, meetingId, expenseId, data) {
  const ref = doc(db, "parliaments", parliamentId, "meetings", meetingId, "expenses", expenseId);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
  return { id: expenseId, ...data };
}

export async function deleteMeetingExpense(parliamentId, meetingId, expenseId) {
  const ref = doc(db, "parliaments", parliamentId, "meetings", meetingId, "expenses", expenseId);
  await deleteDoc(ref);
}