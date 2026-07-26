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
  limit,
  startAfter,
  getCountFromServer,
  runTransaction,
} from "firebase/firestore";

import { db } from "../firebase";
import { getDoc } from "firebase/firestore";
import { sanitizeFormData, sanitizeText } from "../utils/sanitize";
import { buildVolunteerQueryCriteria, buildVolunteerSearchFields } from "../utils/firestoreSearch";
import { processQueryInChunks } from "../utils/firestoreBulk";
import { requireOperationId } from "../utils/operationId";

const volunteersCollection = collection(db, "volunteers");

/* =========================
   Link Firebase Auth user to a volunteer profile
========================= */

export async function getVolunteerByAuthUid(authUid) {
  if (!authUid) return null;
  const q = query(volunteersCollection, where("authUid", "==", authUid));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export async function getVolunteerById(volunteerId) {
  if (!volunteerId) return null;
  const ref = doc(db, "volunteers", volunteerId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function linkVolunteerAuthUid(volunteerId, authUid) {
  if (!volunteerId || !authUid) return;
  const ref = doc(db, "volunteers", volunteerId);
  await updateDoc(ref, { authUid, updatedAt: serverTimestamp() });
}

export async function unlinkVolunteerAuthUid(volunteerId) {
  if (!volunteerId) return;
  const ref = doc(db, "volunteers", volunteerId);
  await updateDoc(ref, { authUid: null, updatedAt: serverTimestamp() });
}

/**
 * Resolve the volunteer profile linked to a logged-in user.
 *
 * Primary path: users/{uid}.linkedVolunteerId -> volunteers/{linkedVolunteerId}
 * Fallback: volunteers where authUid == uid (guarded — the `list` rule
 * requires admin, so a permission-denied here is treated as "not linked"
 * rather than surfaced as a raw Firebase error).
 *
 * Preserves the exact identity-resolution logic used by useCurrentVolunteer,
 * including the relink flow (admin ↔ volunteer email re-use).
 *
 * @param {{ uid: string, email?: string }} params
 * @returns {Promise<{ volunteer: object|null, error: string }>}
 */
export async function getVolunteerForUser({ uid /*, email */ } = {}) {
  if (!uid) return { volunteer: null, error: "" };

  // 1. Read users/{uid}
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.exists() ? userSnap.data() : null;
  const linkedVolunteerId = userData?.linkedVolunteerId;

  // 2. Primary: use linkedVolunteerId
  if (linkedVolunteerId) {
    const volRef = doc(db, "volunteers", linkedVolunteerId);
    const volSnap = await getDoc(volRef);
    if (!volSnap.exists()) {
      return {
        volunteer: null,
        error: "פרופיל המתנדב המקושר לא נמצא במערכת.",
      };
    }
    return { volunteer: { id: volSnap.id, ...volSnap.data() }, error: "" };
  }

  // 3. Fallback: search volunteers by authUid.
  // The volunteers `list` rule requires admin, so this may throw
  // "Missing or insufficient permissions" for a signed-in volunteer whose
  // users/{uid} doc is missing linkedVolunteerId. Treat that as "not linked"
  // instead of surfacing a raw Firebase error.
  try {
    const q = query(volunteersCollection, where("authUid", "==", uid));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      return { volunteer: { id: d.id, ...d.data() }, error: "" };
    }
  } catch (fallbackErr) {
    console.warn(
      "getVolunteerForUser fallback query failed:",
      fallbackErr?.code || fallbackErr?.message
    );
  }

  return {
    volunteer: null,
    error: "לא נמצא קישור לפרופיל מתנדב. יש לפנות למנהל.",
  };
}
const groupsCollection = collection(db, "volunteerGroups");

/* =========================
   Volunteers
========================= */

export async function getVolunteers() {
  const q = query(volunteersCollection, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  }));
}

export async function createVolunteer(volunteerData, operationId) {
  const safeOperationId = requireOperationId(operationId);
  const clean = sanitizeFormData(volunteerData);
  const searchFields = buildVolunteerSearchFields(clean);
  const volunteerRef = doc(volunteersCollection, `volunteer_${safeOperationId}`);
  const groupRef = clean.groupId ? doc(db, "volunteerGroups", clean.groupId) : null;
  const payload = {
    ...clean,
    ...searchFields,
    operationId: safeOperationId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  return runTransaction(db, async (transaction) => {
    const [existing, groupSnap] = await Promise.all([
      transaction.get(volunteerRef),
      groupRef ? transaction.get(groupRef) : Promise.resolve(null),
    ]);
    if (existing.exists()) {
      if (existing.data().operationId !== safeOperationId) {
        const error = new Error("Volunteer operation ID collision");
        error.code = "db01/operation-conflict";
        throw error;
      }
      return { id: existing.id, ...existing.data(), idempotentReplay: true };
    }
    if (groupRef && !groupSnap?.exists()) {
      const error = new Error("Volunteer group not found");
      error.code = "db01/group-not-found";
      throw error;
    }
    transaction.set(volunteerRef, payload);
    if (groupRef) {
      transaction.update(groupRef, {
        count: Number(groupSnap.data().count || 0) + 1,
        updatedAt: serverTimestamp(),
      });
    }
    return { id: volunteerRef.id, ...clean, idempotentReplay: false };
  });
}

export async function editVolunteer(volunteerId, volunteerData) {
  const clean = sanitizeFormData(volunteerData);
  return updateVolunteerWithGroupAccounting(volunteerId, clean);
}

/* =========================
   Volunteer Groups
========================= */

export async function getVolunteerGroups() {
  const q = query(groupsCollection, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  }));
}

export async function createVolunteerGroup(groupData) {
  const clean = sanitizeFormData(groupData);
  const docRef = await addDoc(groupsCollection, {
    ...clean,
    count: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    ...clean,
    count: 0,
  };
}

export async function editVolunteerGroup(groupId, groupData) {
  const groupRef = doc(db, "volunteerGroups", groupId);
  const clean = sanitizeFormData(groupData);

  await updateDoc(groupRef, {
    ...clean,
    updatedAt: serverTimestamp(),
  });

  return {
    id: groupId,
    ...clean,
  };
}

/* =========================
   Add volunteer to group
========================= */

export async function addVolunteerToGroup(volunteerId, group, role, notes = "") {
  const groupPatch = {
    groupId: group.id,
    group: sanitizeText(group.name, 200),
    groupRole: sanitizeText(role || "חבר קבוצה", 100),
    groupNotes: sanitizeText(notes, 2000),
  };
  return updateVolunteerWithGroupAccounting(volunteerId, groupPatch);
}

/* =========================
   Delete / Remove operations
========================= */

export async function deleteVolunteer(volunteerId) {
  const volunteerRef = doc(db, "volunteers", volunteerId);
  return runTransaction(db, async (transaction) => {
    const volunteerSnap = await transaction.get(volunteerRef);
    if (!volunteerSnap.exists()) return { deleted: false, idempotentReplay: true };
    const groupId = volunteerSnap.data().groupId;
    const groupRef = groupId ? doc(db, "volunteerGroups", groupId) : null;
    const groupSnap = groupRef ? await transaction.get(groupRef) : null;
    transaction.delete(volunteerRef);
    if (groupRef && groupSnap?.exists()) {
      transaction.update(groupRef, {
        count: Math.max(0, Number(groupSnap.data().count || 0) - 1),
        updatedAt: serverTimestamp(),
      });
    }
    return { deleted: true, idempotentReplay: false };
  });
}

export async function removeVolunteerFromGroup(volunteerId, groupId) {
  const groupPatch = {
    groupId: null,
    group: "ללא קבוצה",
    groupRole: "",
    groupNotes: "",
  };
  return updateVolunteerWithGroupAccounting(volunteerId, groupPatch, { expectedCurrentGroupId: groupId });
}

async function updateVolunteerWithGroupAccounting(
  volunteerId,
  cleanPatch,
  { expectedCurrentGroupId } = {},
) {
  const volunteerRef = doc(db, "volunteers", volunteerId);
  return runTransaction(db, async (transaction) => {
    const current = await transaction.get(volunteerRef);
    if (!current.exists()) {
      const error = new Error("Volunteer not found");
      error.code = "db01/volunteer-not-found";
      throw error;
    }
    const currentData = current.data();
    const oldGroupId = currentData.groupId || null;
    if (expectedCurrentGroupId !== undefined && oldGroupId !== (expectedCurrentGroupId || null)) {
      if (!oldGroupId && cleanPatch.groupId == null) {
        return { id: volunteerId, ...currentData, idempotentReplay: true };
      }
      const error = new Error("Volunteer group changed concurrently");
      error.code = "db01/group-conflict";
      throw error;
    }
    const changesGroup = Object.prototype.hasOwnProperty.call(cleanPatch, "groupId");
    const nextGroupId = changesGroup ? (cleanPatch.groupId || null) : oldGroupId;
    const oldGroupRef = oldGroupId && oldGroupId !== nextGroupId
      ? doc(db, "volunteerGroups", oldGroupId)
      : null;
    const nextGroupRef = nextGroupId && nextGroupId !== oldGroupId
      ? doc(db, "volunteerGroups", nextGroupId)
      : null;
    const [oldGroupSnap, nextGroupSnap] = await Promise.all([
      oldGroupRef ? transaction.get(oldGroupRef) : Promise.resolve(null),
      nextGroupRef ? transaction.get(nextGroupRef) : Promise.resolve(null),
    ]);
    if (nextGroupRef && !nextGroupSnap?.exists()) {
      const error = new Error("Target volunteer group not found");
      error.code = "db01/group-not-found";
      throw error;
    }

    const merged = { ...currentData, ...cleanPatch };
    transaction.update(volunteerRef, {
      ...cleanPatch,
      ...buildVolunteerSearchFields(merged),
      updatedAt: serverTimestamp(),
    });
    if (oldGroupRef && oldGroupSnap?.exists()) {
      transaction.update(oldGroupRef, {
        count: Math.max(0, Number(oldGroupSnap.data().count || 0) - 1),
        updatedAt: serverTimestamp(),
      });
    }
    if (nextGroupRef) {
      transaction.update(nextGroupRef, {
        count: Number(nextGroupSnap.data().count || 0) + 1,
        updatedAt: serverTimestamp(),
      });
    }
    return { id: volunteerId, ...cleanPatch, idempotentReplay: false };
  });
}

export async function deleteVolunteerGroup(groupId) {
  const groupRef = doc(db, "volunteerGroups", groupId);
  await deleteDoc(groupRef);
}

export async function clearGroupFromVolunteers(groupId) {
  const q = query(volunteersCollection, where("groupId", "==", groupId));
  return processQueryInChunks(db, q, (docItem) => (batch) => {
    const groupPatch = {
      groupId: null,
      group: "ללא קבוצה",
      groupRole: "",
      groupNotes: "",
    };
    batch.update(docItem.ref, {
      ...groupPatch,
      ...buildVolunteerSearchFields({ ...docItem.data(), ...groupPatch }),
      updatedAt: serverTimestamp(),
    });
  });
}
/* =========================
   Server-side pagination (Firestore cursor)

   Real Firestore cursor pagination. Search and supported filters are applied
   before limit/startAfter. Assigned elderly are fetched separately for the
   current page only.
========================= */

function getVolunteerCriteriaConstraints(criteria = {}, { includeOrder = true } = {}) {
  const normalized = buildVolunteerQueryCriteria(criteria);
  const constraints = [];
  if (normalized.area) constraints.push(where("area", "==", normalized.area));
  if (normalized.neighborhood) constraints.push(where("neighborhood", "==", normalized.neighborhood));
  if (normalized.status) constraints.push(where("status", "==", normalized.status));
  if (normalized.insurance) constraints.push(where("insuranceKey", "==", normalized.insurance));
  if (normalized.searchTerm) {
    constraints.push(where("searchPrefixes", "array-contains", normalized.searchTerm));
  }
  const hasCriteria = Boolean(
    normalized.area || normalized.neighborhood || normalized.status ||
    normalized.insurance || normalized.searchTerm,
  );
  if (includeOrder && !hasCriteria) constraints.push(orderBy("createdAt", "desc"));
  return constraints;
}

export async function getVolunteersPage({ pageSize = 20, cursor = null, criteria = {} } = {}) {
  const constraints = getVolunteerCriteriaConstraints(criteria);
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(pageSize + 1));
  const q = query(volunteersCollection, ...constraints);

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

export async function getVolunteersQueryCount(criteria = {}) {
  const snap = await getCountFromServer(
    query(volunteersCollection, ...getVolunteerCriteriaConstraints(criteria, { includeOrder: false })),
  );
  return snap.data().count;
}

export async function getVolunteersCount() {
  const snap = await getCountFromServer(volunteersCollection);
  return snap.data().count;
}

/**
 * Stats via count aggregations — one aggregation read per query.
 * Matches labels used in the volunteers admin stats cards.
 */
export async function getVolunteersStatusCounts() {
  const [totalSnap, assignedSnap, pendingSnap, indexedSnap] = await Promise.all([
    getCountFromServer(volunteersCollection),
    getCountFromServer(query(volunteersCollection, where("status", "==", "משויך לאזרח ותיק"))),
    getCountFromServer(query(volunteersCollection, where("status", "==", "ממתין לשיבוץ"))),
    getCountFromServer(query(volunteersCollection, where("searchSchemaVersion", "==", 1))),
  ]);
  return {
    total: totalSnap.data().count,
    assigned: assignedSnap.data().count,
    pending: pendingSnap.data().count,
    searchIndexed: indexedSnap.data().count,
  };
}
