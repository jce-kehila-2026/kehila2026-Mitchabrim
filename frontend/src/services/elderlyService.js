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
  limit,
  startAfter,
  getCountFromServer,
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

/* =========================
   Server-side pagination (Firestore cursor)

   These helpers implement real Firestore pagination using orderBy + limit +
   startAfter. They are intended for future adoption when the current UI moves
   away from client-side filtering/search. The existing getElderly() is still
   used by pages that need the full dataset for stats cards and multi-field
   client-side search (see PHASE_8_10 in the audit).
========================= */

/**
 * Fetch a single page of elderly documents.
 * @param {{ pageSize?: number, cursor?: import("firebase/firestore").DocumentSnapshot|null }} opts
 * @returns {Promise<{ items: object[], firstVisible: any, lastVisible: any, hasNextPage: boolean }>}
 */
export async function getElderlyPage({ pageSize = 20, cursor = null } = {}) {
  const base = [where("status", "==", "פעיל"), limit(pageSize + 1)];
  const q = cursor
    ? query(elderlyCollection, where("status", "==", "פעיל"), startAfter(cursor), limit(pageSize + 1))
    : query(elderlyCollection, ...base);

  const snap = await getDocs(q);
  const docs = snap.docs;
  const hasNextPage = docs.length > pageSize;
  const pageDocs = hasNextPage ? docs.slice(0, pageSize) : docs;

  return {
    items: pageDocs.map((d) => ({ id: d.id, ...d.data() })),
    firstVisible: pageDocs[0] || null,
    lastVisible: pageDocs[pageDocs.length - 1] || null,
    hasNextPage,
  };
}

/**
 * Exact total count of elderly documents via Firestore count aggregation.
 * One aggregation read — does not fetch documents.
 */
export async function getElderlyCount() {
  const snap = await getCountFromServer(elderlyCollection);
  return snap.data().count;
}

/**
 * Stats via count aggregations — one aggregation read per query, no docs fetched.
 * volStatus === "כן" or "לא מתאים" → considered "connected" (matches previous UI logic).
 */
export async function getElderlyStatusCounts() {
  const active = where("status", "==", "פעיל");
  const [totalSnap, connectedSnap, phoneSnap] = await Promise.all([
    getCountFromServer(query(elderlyCollection, active)),
    getCountFromServer(query(elderlyCollection, active, where("volStatus", "==", "כן"))),
    getCountFromServer(query(elderlyCollection, active, where("volStatus", "==", "קשר טלפוני"))),
  ]);
  const total = totalSnap.data().count;
  const connected = connectedSnap.data().count;
  const phoneContact = phoneSnap.data().count;
  return {
    total,
    connected,
    phoneContact,
    without: Math.max(0, total - connected - phoneContact),
  };
}

/**
 * Fetch elderly documents assigned to any of the given volunteer ids.
 * Uses Firestore `in` (max 30 ids per query). Splits into chunks if needed.
 * Used to populate the "assigned to" column on the volunteers page for the
 * current page's 20 volunteers without loading the full elderly collection.
 */
export async function getElderlyForVolunteerIds(volunteerIds = []) {
  const ids = Array.from(new Set(volunteerIds.filter(Boolean)));
  if (ids.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
  const results = await Promise.all(
    chunks.map((chunk) => getDocs(query(elderlyCollection, where("volId", "in", chunk)))),
  );
  return results.flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}
