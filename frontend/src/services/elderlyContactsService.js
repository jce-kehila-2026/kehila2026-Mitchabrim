import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  where,
  orderBy,
} from "firebase/firestore";

import { db } from "../firebase";
import { sanitizeFormData } from "../utils/sanitize";
import { commitBatchOperations, deleteQueryInChunks } from "../utils/firestoreBulk";
import { mapWithConcurrency } from "../utils/bulkOperations";

const contactsCol = collection(db, "elderlyContactPersons");
const linksCol = collection(db, "elderlyContactLinks");

/* =========================
   Contacts (CRUD)
========================= */

export async function getElderlyContacts() {
  try {
    const q = query(contactsCol, orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(contactsCol);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
}

export async function getElderlyContactById(id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, "elderlyContactPersons", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function createElderlyContact(data) {
  const clean = sanitizeFormData(data);
  const payload = {
    ...clean,
    fullName: `${clean.firstName || ""} ${clean.lastName || ""}`.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(contactsCol, payload);
  return { id: ref.id, ...payload };
}

export async function updateElderlyContact(id, data) {
  const clean = sanitizeFormData(data);
  const payload = {
    ...clean,
    fullName: `${clean.firstName || ""} ${clean.lastName || ""}`.trim(),
    updatedAt: serverTimestamp(),
  };
  await updateDoc(doc(db, "elderlyContactPersons", id), payload);
  return { id, ...payload };
}

export async function deleteElderlyContact(id) {
  await deleteQueryInChunks(db, query(linksCol, where("contactId", "==", id)));
  await deleteDoc(doc(db, "elderlyContactPersons", id));
}

export async function archiveElderlyContact(id) {
  await updateDoc(doc(db, "elderlyContactPersons", id), {
    status: "לא פעיל",
    archived: true,
    updatedAt: serverTimestamp(),
  });
}

/* =========================
   Links (contact <-> elderly)
========================= */

export async function getAllContactLinks() {
  const snap = await getDocs(linksCol);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getLinksForContact(contactId) {
  if (!contactId) return [];
  const snap = await getDocs(query(linksCol, where("contactId", "==", contactId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getContactsForElderly(elderlyId) {
  if (!elderlyId) return [];
  const snap = await getDocs(query(linksCol, where("elderlyId", "==", elderlyId)));
  const links = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (links.length === 0) return [];
  const { results: contacts } = await mapWithConcurrency(
    links,
    async (l) => {
      const c = await getElderlyContactById(l.contactId);
      return c ? { ...c, _linkId: l.id } : null;
    },
  );
  return contacts.filter(Boolean);
}

export async function linkContactToElderly(contactId, elderly) {
  if (!contactId || !elderly?.id) return null;
  // avoid duplicate
  const existing = await getDocs(
    query(linksCol, where("contactId", "==", contactId), where("elderlyId", "==", elderly.id)),
  );
  if (!existing.empty) {
    return { id: existing.docs[0].id, ...existing.docs[0].data() };
  }
  const elderlyName =
    `${elderly.firstName || ""} ${elderly.lastName || ""}`.trim() || elderly.name || "אזרח ותיק";
  const payload = {
    contactId,
    elderlyId: elderly.id,
    elderlyName,
    elderlyArea: elderly.area || "",
    elderlyNeighborhood: elderly.neighborhood || "",
    relationNote: "",
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(linksCol, payload);
  return { id: ref.id, ...payload };
}

export async function unlinkContactFromElderly(contactId, elderlyId) {
  const snap = await getDocs(
    query(linksCol, where("contactId", "==", contactId), where("elderlyId", "==", elderlyId)),
  );
  const operations = snap.docs.map((d) => (batch) => batch.delete(d.ref));
  await commitBatchOperations(db, operations);
}

export async function removeLinkById(linkId) {
  await deleteDoc(doc(db, "elderlyContactLinks", linkId));
}

/**
 * Replace the full set of links for a contact with the provided elderly list.
 */
export async function syncContactLinks(contactId, elderlyArray) {
  const current = await getLinksForContact(contactId);
  const desiredIds = new Set((elderlyArray || []).map((e) => e.id));
  const currentIds = new Set(current.map((l) => l.elderlyId));

  const operations = [];
  // delete removed
  current.forEach((l) => {
    if (!desiredIds.has(l.elderlyId)) {
      operations.push((batch) => batch.delete(doc(db, "elderlyContactLinks", l.id)));
    }
  });
  // add new
  (elderlyArray || []).forEach((e) => {
    if (!currentIds.has(e.id)) {
      const elderlyName =
        `${e.firstName || ""} ${e.lastName || ""}`.trim() || e.name || "אזרח ותיק";
      const ref = doc(linksCol, `${contactId}__${e.id}`);
      operations.push((batch) => {
        batch.set(ref, {
          contactId,
          elderlyId: e.id,
          elderlyName,
          elderlyArea: e.area || "",
          elderlyNeighborhood: e.neighborhood || "",
          relationNote: "",
          createdAt: serverTimestamp(),
        }, { merge: true });
      });
    }
  });
  return commitBatchOperations(db, operations);
}
