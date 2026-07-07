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
  increment,
  writeBatch,
} from "firebase/firestore";

import { db } from "../firebase";
import { getDoc } from "firebase/firestore";
import { sanitizeFormData, sanitizeText } from "../utils/sanitize";

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

export async function createVolunteer(volunteerData) {
  const clean = sanitizeFormData(volunteerData);
  const docRef = await addDoc(volunteersCollection, {
    ...clean,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    ...clean,
  };
}

export async function editVolunteer(volunteerId, volunteerData) {
  const volunteerRef = doc(db, "volunteers", volunteerId);
  const clean = sanitizeFormData(volunteerData);

  await updateDoc(volunteerRef, {
    ...clean,
    updatedAt: serverTimestamp(),
  });

  return {
    id: volunteerId,
    ...clean,
  };
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
  const volunteerRef = doc(db, "volunteers", volunteerId);
  const groupRef = doc(db, "volunteerGroups", group.id);

  await updateDoc(volunteerRef, {
    groupId: group.id,
    group: sanitizeText(group.name, 200),
    groupRole: sanitizeText(role || "חבר קבוצה", 100),
    groupNotes: sanitizeText(notes, 2000),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(groupRef, {
    count: increment(1),
    updatedAt: serverTimestamp(),
  });
}

export async function increaseGroupCount(groupId) {
  const groupRef = doc(db, "volunteerGroups", groupId);

  await updateDoc(groupRef, {
    count: increment(1),
    updatedAt: serverTimestamp(),
  });
}

/* =========================
   Delete / Remove operations
========================= */

export async function deleteVolunteer(volunteerId) {
  const volunteerRef = doc(db, "volunteers", volunteerId);
  await deleteDoc(volunteerRef);
}

export async function removeVolunteerFromGroup(volunteerId, groupId) {
  const volunteerRef = doc(db, "volunteers", volunteerId);

  await updateDoc(volunteerRef, {
    groupId: null,
    group: "ללא קבוצה",
    groupRole: "",
    groupNotes: "",
    updatedAt: serverTimestamp(),
  });

  if (groupId) {
    const groupRef = doc(db, "volunteerGroups", groupId);
    await updateDoc(groupRef, {
      count: increment(-1),
      updatedAt: serverTimestamp(),
    });
  }
}

export async function deleteVolunteerGroup(groupId) {
  const groupRef = doc(db, "volunteerGroups", groupId);
  await deleteDoc(groupRef);
}

export async function clearGroupFromVolunteers(groupId) {
  const q = query(volunteersCollection, where("groupId", "==", groupId));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return;

  const batch = writeBatch(db);

  snapshot.docs.forEach((docItem) => {
    batch.update(docItem.ref, {
      groupId: null,
      group: "ללא קבוצה",
      groupRole: "",
      groupNotes: "",
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}