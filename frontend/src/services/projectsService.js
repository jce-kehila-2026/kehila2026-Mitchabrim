import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  setDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  writeBatch,
} from "firebase/firestore";

import { db } from "../firebase";

const projectsCollection = collection(db, "projects");

/* =========================
   Projects
========================= */

export async function getProjects() {
  const q = query(projectsCollection, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  }));
}

export async function createProject(projectData) {
  const docRef = await addDoc(projectsCollection, {
    ...projectData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    ...projectData,
  };
}

export async function editProject(projectId, projectData) {
  const projectRef = doc(db, "projects", projectId);

  await updateDoc(projectRef, {
    ...projectData,
    updatedAt: serverTimestamp(),
  });

  return {
    id: projectId,
    ...projectData,
  };
}

export async function deleteProject(projectId) {
  const projectRef = doc(db, "projects", projectId);
  await deleteDoc(projectRef);
}

/* =========================
   Elderly participants
   (subcollection: projects/{projectId}/elderlyParticipants/{elderlyId})
========================= */

function participantsCol(projectId) {
  return collection(db, "projects", projectId, "elderlyParticipants");
}

export async function getElderlyParticipants(projectId) {
  const snapshot = await getDocs(participantsCol(projectId));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addElderlyParticipants(projectId, participants) {
  // participants: array of plain objects, each MUST include elderlyId.
  const batch = writeBatch(db);
  participants.forEach((p) => {
    const ref = doc(db, "projects", projectId, "elderlyParticipants", p.elderlyId);
    batch.set(
      ref,
      {
        receives: "כן",
        delivery: "ממתין למסירה",
        notes: "",
        ...p,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });
  await batch.commit();
}

export async function updateElderlyParticipant(projectId, elderlyId, patch) {
  const ref = doc(db, "projects", projectId, "elderlyParticipants", elderlyId);
  await setDoc(
    ref,
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function removeElderlyParticipant(projectId, elderlyId) {
  const ref = doc(db, "projects", projectId, "elderlyParticipants", elderlyId);
  await deleteDoc(ref);
}

/* =========================
   Project groups + selected volunteers
   (subcollection: projects/{projectId}/projectGroups/{groupId}
    with field `volunteerIds: string[]`)
========================= */

function projectGroupsCol(projectId) {
  return collection(db, "projects", projectId, "projectGroups");
}

export async function getProjectGroups(projectId) {
  const snapshot = await getDocs(projectGroupsCol(projectId));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addProjectGroups(projectId, groupIds) {
  const batch = writeBatch(db);
  groupIds.forEach((gid) => {
    const ref = doc(db, "projects", projectId, "projectGroups", gid);
    batch.set(
      ref,
      {
        volunteerIds: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });
  await batch.commit();
}

export async function removeProjectGroup(projectId, groupId) {
  const ref = doc(db, "projects", projectId, "projectGroups", groupId);
  await deleteDoc(ref);
}

export async function setProjectGroupVolunteers(projectId, groupId, volunteerIds) {
  const ref = doc(db, "projects", projectId, "projectGroups", groupId);
  await setDoc(
    ref,
    { volunteerIds, updatedAt: serverTimestamp() },
    { merge: true }
  );
}
