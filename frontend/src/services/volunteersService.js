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
  const docRef = await addDoc(volunteersCollection, {
    ...volunteerData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    ...volunteerData,
  };
}

export async function editVolunteer(volunteerId, volunteerData) {
  const volunteerRef = doc(db, "volunteers", volunteerId);

  await updateDoc(volunteerRef, {
    ...volunteerData,
    updatedAt: serverTimestamp(),
  });

  return {
    id: volunteerId,
    ...volunteerData,
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
  const docRef = await addDoc(groupsCollection, {
    ...groupData,
    count: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    ...groupData,
    count: 0,
  };
}

export async function editVolunteerGroup(groupId, groupData) {
  const groupRef = doc(db, "volunteerGroups", groupId);

  await updateDoc(groupRef, {
    ...groupData,
    updatedAt: serverTimestamp(),
  });

  return {
    id: groupId,
    ...groupData,
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
    group: group.name,
    groupRole: role || "חבר קבוצה",
    groupNotes: notes,
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
