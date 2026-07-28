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
  collectionGroup,
  documentId,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "../firebase";
import { sanitizeFormData } from "../utils/sanitize";
import { commitBatchOperations, deleteQueryInChunks } from "../utils/firestoreBulk";
import { requireOperationId } from "../utils/operationId";

const projectsCollection = collection(db, "projects");

/* =========================
   Single project
========================= */


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
  const clean = sanitizeFormData(projectData);
  const docRef = await addDoc(projectsCollection, {
    ...clean,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    ...clean,
  };
}

export async function createProjectWithRelations({
  projectData,
  participants = [],
  groupAssignments = [],
  operationId,
}) {
  const safeOperationId = requireOperationId(operationId);
  const projectId = `project_${safeOperationId}`;
  const projectRef = doc(db, "projects", projectId);
  const clean = sanitizeFormData(projectData);
  const operations = [];

  (participants || []).filter((participant) => participant?.elderlyId).forEach((participant) => {
    const participantRef = doc(
      db,
      "projects",
      projectId,
      "elderlyParticipants",
      participant.elderlyId,
    );
    operations.push((batch) => batch.set(participantRef, {
      receives: "כן",
      delivery: "ממתין למסירה",
      notes: "",
      ...participant,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true }));
  });

  (groupAssignments || []).filter((assignment) => assignment?.groupId).forEach((assignment) => {
    const groupRef = doc(
      db,
      "projects",
      projectId,
      "projectGroups",
      assignment.groupId,
    );
    operations.push((batch) => batch.set(groupRef, {
      volunteerIds: Array.from(new Set((assignment.volunteerIds || []).filter(Boolean))),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true }));
  });

  // The parent is committed last. Small creations stay in one atomic batch;
  // large creations are resumable and remain invisible to project queries
  // until every deterministic child write has completed.
  operations.push((batch) => batch.set(projectRef, {
    ...clean,
    operationId: safeOperationId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  await commitBatchOperations(db, operations);
  return { id: projectId, ...clean };
}

function assertAtomicProjectWriteLimit(writeCount) {
  if (writeCount > 400) {
    const error = new Error("This project change exceeds the 400-write atomic limit");
    error.code = "db01/atomic-limit-exceeded";
    throw error;
  }
}

export async function updateProjectWithParticipantChanges({
  projectId,
  projectPatch,
  participantsToUpsert = [],
  participantPatches = [],
  participantIdsToDelete = [],
}) {
  const upserts = (participantsToUpsert || []).filter((participant) => participant?.elderlyId);
  const patches = (participantPatches || []).filter((participant) => participant?.elderlyId);
  const deletes = Array.from(new Set((participantIdsToDelete || []).filter(Boolean)));
  assertAtomicProjectWriteLimit(upserts.length + patches.length + deletes.length + 1);
  const batch = writeBatch(db);
  upserts.forEach((participant) => {
    batch.set(
      doc(db, "projects", projectId, "elderlyParticipants", participant.elderlyId),
      {
        receives: "כן",
        delivery: "ממתין למסירה",
        notes: "",
        ...participant,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });
  patches.forEach(({ elderlyId, ...patch }) => {
    batch.set(
      doc(db, "projects", projectId, "elderlyParticipants", elderlyId),
      { ...sanitizeFormData(patch), updatedAt: serverTimestamp() },
      { merge: true },
    );
  });
  deletes.forEach((elderlyId) => {
    batch.delete(doc(db, "projects", projectId, "elderlyParticipants", elderlyId));
  });
  batch.update(doc(db, "projects", projectId), {
    ...sanitizeFormData(projectPatch),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function addProjectGroupAssignments(projectId, assignments) {
  const valid = (assignments || []).filter((assignment) => assignment?.groupId);
  assertAtomicProjectWriteLimit(valid.length);
  const batch = writeBatch(db);
  valid.forEach((assignment) => {
    batch.set(
      doc(db, "projects", projectId, "projectGroups", assignment.groupId),
      {
        volunteerIds: Array.from(new Set((assignment.volunteerIds || []).filter(Boolean))),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });
  await batch.commit();
}

export async function editProject(projectId, projectData) {
  const projectRef = doc(db, "projects", projectId);
  const clean = sanitizeFormData(projectData);

  await updateDoc(projectRef, {
    ...clean,
    updatedAt: serverTimestamp(),
  });

  return {
    id: projectId,
    ...clean,
  };
}

/* Cascade delete: remove the project and all of its project-scoped
   subcollection data (elderlyParticipants + projectGroups).
   IMPORTANT: this does NOT delete elderly residents, neighborhoods, or
   volunteer groups from the main database. */
export async function deleteProjectCascade(projectId) {
  await deleteQueryInChunks(db, participantsCol(projectId));
  await deleteQueryInChunks(db, projectGroupsCol(projectId));
  await deleteDoc(doc(db, "projects", projectId));
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

export async function getElderlyParticipantsByProject() {
  const snapshot = await getDocs(projectChildrenQuery("elderlyParticipants"));
  const byProject = {};
  snapshot.docs.forEach((d) => {
    const projectId = d.ref.parent.parent?.id;
    if (!projectId) return;
    if (!byProject[projectId]) byProject[projectId] = [];
    byProject[projectId].push({ id: d.id, ...d.data() });
  });
  return byProject;
}

export async function addElderlyParticipants(projectId, participants) {
  const validParticipants = (participants || []).filter((p) => p?.elderlyId);
  const operations = validParticipants.map((p) => (batch) => {
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
  return commitBatchOperations(db, operations);
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

export async function removeElderlyParticipants(projectId, elderlyIds) {
  const operations = Array.from(new Set((elderlyIds || []).filter(Boolean)))
    .map((elderlyId) => (batch) => {
      batch.delete(doc(db, "projects", projectId, "elderlyParticipants", elderlyId));
    });
  return commitBatchOperations(db, operations);
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

export async function getProjectGroupsByProject() {
  const snapshot = await getDocs(projectChildrenQuery("projectGroups"));
  const byProject = {};
  snapshot.docs.forEach((d) => {
    const projectId = d.ref.parent.parent?.id;
    if (!projectId) return;
    if (!byProject[projectId]) byProject[projectId] = [];
    byProject[projectId].push({ id: d.id, ...d.data() });
  });
  return byProject;
}

function projectChildrenQuery(collectionId) {
  const low = "\u0000";
  const high = "\uf8ff";
  return query(
    collectionGroup(db, collectionId),
    where(documentId(), ">=", doc(db, "projects", low, collectionId, low)),
    where(documentId(), "<=", doc(db, "projects", high, collectionId, high)),
  );
}

export async function addProjectGroups(projectId, groupIds) {
  const operations = Array.from(new Set((groupIds || []).filter(Boolean))).map((gid) => (batch) => {
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
  return commitBatchOperations(db, operations);
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
