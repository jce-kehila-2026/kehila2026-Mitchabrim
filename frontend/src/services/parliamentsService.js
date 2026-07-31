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
  collectionGroup,
  documentId,
  where,
  limit,
  writeBatch,
} from "firebase/firestore";

import { db } from "../firebase";
import { sanitizeFormData } from "../utils/sanitize";
import { commitBatchOperations, deleteQueryInChunks } from "../utils/firestoreBulk";
import { mapWithConcurrency } from "../utils/bulkOperations";
import { requireOperationId } from "../utils/operationId";

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
  while (true) {
    const meetingsSnapshot = await getDocs(query(meetingsCol(parliamentId), limit(25)));
    if (meetingsSnapshot.empty) break;
    await mapWithConcurrency(
      meetingsSnapshot.docs,
      (meeting) => deleteMeeting(parliamentId, meeting.id),
      { concurrency: 3 },
    );
  }
  await deleteQueryInChunks(
    db,
    collection(db, "parliaments", parliamentId, "participants"),
  );
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

function groupByParentDocument(snapshot) {
  const grouped = {};
  snapshot.docs.forEach((d) => {
    const parentId = d.ref.parent.parent?.id;
    if (!parentId) return;
    if (!grouped[parentId]) grouped[parentId] = [];
    grouped[parentId].push({ id: d.id, ...d.data() });
  });
  return grouped;
}

export async function getParticipantsByParliament() {
  const snapshot = await getDocs(parliamentChildrenQuery("participants"));
  return groupByParentDocument(snapshot);
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

export async function addParticipantsAtomically(
  parliamentId,
  participantData,
  operationId,
) {
  const safeOperationId = requireOperationId(operationId);
  const participants = (participantData || []).filter((participant) => participant?.elderlyId);
  if (participants.length > 400) {
    const error = new Error("At most 400 parliament participants can be added atomically");
    error.code = "db01/atomic-limit-exceeded";
    throw error;
  }
  const batch = writeBatch(db);
  const saved = participants.map((participant, index) => {
    const id = `participant_${safeOperationId}_${index}`;
    const ref = doc(db, "parliaments", parliamentId, "participants", id);
    batch.set(ref, {
      ...participant,
      operationId: safeOperationId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id, ...participant };
  });
  await batch.commit();
  return saved;
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

export async function getMeetingsByParliament() {
  const snapshot = await getDocs(parliamentChildrenQuery("meetings"));
  return groupByParentDocument(snapshot);
}

function parliamentChildrenQuery(collectionId) {
  const low = "\u0000";
  const high = "\uf8ff";
  return query(
    collectionGroup(db, collectionId),
    where(documentId(), ">=", doc(db, "parliaments", low, collectionId, low)),
    where(documentId(), "<=", doc(db, "parliaments", high, collectionId, high)),
  );
}

export async function addMeeting(parliamentId, data) {
  const ref = await addDoc(meetingsCol(parliamentId), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, ...data };
}

export async function addMeetingWithAttendance(parliamentId, data, participants, operationId) {
  const safeOperationId = requireOperationId(operationId);
  const meetingId = `meeting_${safeOperationId}`;
  const meetingRef = doc(db, "parliaments", parliamentId, "meetings", meetingId);
  const operations = (participants || []).filter((participant) => participant?.id)
    .map((participant) => (batch) => {
      const attendanceRef = doc(
        db,
        "parliaments",
        parliamentId,
        "meetings",
        meetingId,
        "attendance",
        String(participant.id),
      );
      batch.set(attendanceRef, {
        firstName: participant.firstName || "",
        lastName: participant.lastName || "",
        elderlyId: participant.elderlyId || "",
        phone: participant.phone || "",
        homePhone: participant.homePhone || "",
        address: participant.address || "",
        called: "לא",
        confirmed: "ממתין",
        arrived: "—",
        notes: "",
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
  operations.push((batch) => batch.set(meetingRef, {
    ...data,
    operationId: safeOperationId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  await commitBatchOperations(db, operations);
  return { id: meetingId, ...data };
}

export async function updateMeeting(parliamentId, meetingId, data) {
  const ref = doc(db, "parliaments", parliamentId, "meetings", meetingId);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
  return { id: meetingId, ...data };
}

export async function deleteMeeting(parliamentId, meetingId) {
  const ref = doc(db, "parliaments", parliamentId, "meetings", meetingId);
  await deleteQueryInChunks(db, attendanceCol(parliamentId, meetingId));
  await deleteQueryInChunks(db, expensesCol(parliamentId, meetingId));
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

export async function deleteMeetingAttendance(parliamentId, meetingId, participantId) {
  const ref = doc(
    db, "parliaments", parliamentId, "meetings", meetingId, "attendance", String(participantId)
  );
  await deleteDoc(ref);
}

export async function upsertMeetingAttendance(parliamentId, meetingId, participantId, data) {
  const ref = doc(
    db, "parliaments", parliamentId, "meetings", meetingId, "attendance", String(participantId)
  );
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  return { id: participantId, ...data };
}

export async function snapshotMeetingAttendance(parliamentId, meetingId, participants) {
  const operations = (participants || []).filter((participant) => participant?.id)
    .map((participant) => (batch) => {
      const ref = doc(
        db,
        "parliaments",
        parliamentId,
        "meetings",
        meetingId,
        "attendance",
        String(participant.id),
      );
      batch.set(ref, {
        firstName: participant.firstName || "",
        lastName: participant.lastName || "",
        elderlyId: participant.elderlyId || "",
        phone: participant.phone || "",
        homePhone: participant.homePhone || "",
        address: participant.address || "",
        called: "לא",
        confirmed: "ממתין",
        arrived: "—",
        notes: "",
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
  return commitBatchOperations(db, operations);
}

export async function preserveOrRemoveParticipantAttendance(
  parliamentId,
  participant,
  meetings,
  todayIso,
) {
  const operations = (meetings || []).filter((meeting) => meeting?.id).map((meeting) => (batch) => {
    const ref = doc(
      db,
      "parliaments",
      parliamentId,
      "meetings",
      meeting.id,
      "attendance",
      String(participant.id),
    );
    if (meeting.date && meeting.date > todayIso) {
      batch.delete(ref);
      return;
    }
    batch.set(ref, {
      firstName: participant.firstName || "",
      lastName: participant.lastName || "",
      elderlyId: participant.elderlyId || "",
      phone: participant.phone || "",
      homePhone: participant.homePhone || "",
      address: participant.address || "",
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
  return commitBatchOperations(db, operations);
}

export async function removeParticipantWithAttendance(
  parliamentId,
  participant,
  meetings,
  todayIso,
) {
  const operations = (meetings || []).filter((meeting) => meeting?.id).map((meeting) => (batch) => {
    const attendanceRef = doc(
      db,
      "parliaments",
      parliamentId,
      "meetings",
      meeting.id,
      "attendance",
      String(participant.id),
    );
    if (meeting.date && meeting.date > todayIso) {
      batch.delete(attendanceRef);
      return;
    }
    batch.set(attendanceRef, {
      firstName: participant.firstName || "",
      lastName: participant.lastName || "",
      elderlyId: participant.elderlyId || "",
      phone: participant.phone || "",
      homePhone: participant.homePhone || "",
      address: participant.address || "",
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
  operations.push((batch) => batch.delete(
    doc(db, "parliaments", parliamentId, "participants", participant.id),
  ));
  return commitBatchOperations(db, operations);
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

function descendantsOfParliamentQuery(parliamentId, collectionId) {
  const low = "\u0000";
  const high = "\uf8ff";
  const lowerRef = doc(
    db, "parliaments", parliamentId, "meetings", low, collectionId, low,
  );
  const upperRef = doc(
    db, "parliaments", parliamentId, "meetings", high, collectionId, high,
  );
  return query(
    collectionGroup(db, collectionId),
    where(documentId(), ">=", lowerRef),
    where(documentId(), "<=", upperRef),
  );
}

export async function getMeetingAggregates(parliamentId) {
  const [attendanceSnapshot, expensesSnapshot] = await Promise.all([
    getDocs(descendantsOfParliamentQuery(parliamentId, "attendance")),
    getDocs(descendantsOfParliamentQuery(parliamentId, "expenses")),
  ]);

  const arrivedByMeeting = {};
  attendanceSnapshot.docs.forEach((d) => {
    const meetingRef = d.ref.parent.parent;
    const ownerRef = meetingRef?.parent.parent;
    if (ownerRef?.id !== parliamentId || d.data().arrived !== "כן") return;
    arrivedByMeeting[meetingRef.id] = (arrivedByMeeting[meetingRef.id] || 0) + 1;
  });

  const expenseTotalByMeeting = {};
  expensesSnapshot.docs.forEach((d) => {
    const meetingRef = d.ref.parent.parent;
    const ownerRef = meetingRef?.parent.parent;
    if (ownerRef?.id !== parliamentId) return;
    expenseTotalByMeeting[meetingRef.id] =
      (expenseTotalByMeeting[meetingRef.id] || 0) + (Number(d.data().amount) || 0);
  });

  return { arrivedByMeeting, expenseTotalByMeeting };
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
