import {
  collection,
  getDoc,
  getDocs,
  doc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getCountFromServer,
  documentId,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";


import { db, getSecureFunctions } from "../firebase";
import { sanitizeFormData } from "../utils/sanitize";
import { buildElderlyQueryCriteria } from "../utils/firestoreSearch";
import { mapWithConcurrency } from "../utils/bulkOperations";
import { requireOperationId } from "../utils/operationId";


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

export async function getElderlyByIds(elderlyIds = []) {
  const ids = Array.from(new Set(elderlyIds.map(String).filter(Boolean)));
  if (!ids.length) return [];
  const chunks = [];
  for (let index = 0; index < ids.length; index += 30) chunks.push(ids.slice(index, index + 30));
  const { results } = await mapWithConcurrency(
    chunks,
    (chunk) => getDocs(query(elderlyCollection, where(documentId(), "in", chunk))),
  );
  return results.flatMap((snapshot) => snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  })));
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


async function mutateElderly(payload) {
  const functions = await getSecureFunctions();
  if (!functions) {
    const error = new Error("App Check is required for protected elderly mutations.");
    error.code = "db01/app-check-required";
    throw error;
  }
  const callable = httpsCallable(functions, "mutateElderly");
  const result = await callable(payload);
  return result.data;
}

export async function createElderly(elderlyData, operationId) {
  const clean = sanitizeFormData(elderlyData);
  const result = await mutateElderly({
    action: "create",
    data: clean,
    operationId: requireOperationId(operationId),
  });

  return {
    id: result.id,
    ...clean,
  };
}

export async function editElderly(elderlyId, elderlyData, operationId) {
  elderlyData = sanitizeFormData(elderlyData);
  await mutateElderly({
    action: "update",
    elderlyId,
    data: elderlyData,
    operationId: requireOperationId(operationId),
  });

  return {
    id: elderlyId,
    ...elderlyData,
  };
}

export async function deleteElderly(elderlyId, operationId) {
  await mutateElderly({
    action: "delete",
    elderlyId,
    operationId: requireOperationId(operationId),
  });
}

/* =========================
   Server-side pagination (Firestore cursor)

   Real Firestore pagination for the admin list. Search and filters are applied
   before limit/startAfter; unrestricted getElderly() remains for explicit
   full-report actions only.
========================= */

/**
 * Fetch a single page of elderly documents.
 * @param {{ pageSize?: number, cursor?: import("firebase/firestore").DocumentSnapshot|null, criteria?: object }} opts
 * @returns {Promise<{ items: object[], firstVisible: any, lastVisible: any, hasNextPage: boolean }>}
 */
function getElderlyCriteriaConstraints(criteria = {}) {
  const normalized = buildElderlyQueryCriteria(criteria);
  const constraints = [where("status", "==", normalized.status)];
  if (normalized.area) constraints.push(where("area", "==", normalized.area));
  if (normalized.neighborhood) constraints.push(where("neighborhood", "==", normalized.neighborhood));
  if (normalized.marital) constraints.push(where("marital", "==", normalized.marital));
  if (normalized.volStatus) constraints.push(where("volStatus", "==", normalized.volStatus));
  if (normalized.searchTerm) {
    constraints.push(where("searchPrefixes", "array-contains", normalized.searchTerm));
  }
  return constraints;
}

export async function getElderlyPage({ pageSize = 20, cursor = null, criteria = {} } = {}) {
  const constraints = getElderlyCriteriaConstraints(criteria);
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(pageSize + 1));
  const q = query(elderlyCollection, ...constraints);

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

export async function getElderlyQueryCount(criteria = {}) {
  const snap = await getCountFromServer(
    query(elderlyCollection, ...getElderlyCriteriaConstraints(criteria)),
  );
  return snap.data().count;
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
  const [totalSnap, connectedSnap, phoneSnap, indexedSnap] = await Promise.all([
    getCountFromServer(query(elderlyCollection, active)),
    getCountFromServer(query(elderlyCollection, active, where("volStatus", "==", "כן"))),
    getCountFromServer(query(elderlyCollection, active, where("volStatus", "==", "קשר טלפוני"))),
    getCountFromServer(query(elderlyCollection, active, where("searchSchemaVersion", "==", 1))),
  ]);
  const total = totalSnap.data().count;
  const connected = connectedSnap.data().count;
  const phoneContact = phoneSnap.data().count;
  return {
    total,
    connected,
    phoneContact,
    searchIndexed: indexedSnap.data().count,
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
  const { results } = await mapWithConcurrency(
    chunks,
    (chunk) => getDocs(query(elderlyCollection, where("volId", "in", chunk))),
  );
  return results.flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}
