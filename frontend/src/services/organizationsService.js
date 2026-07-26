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
  runTransaction,
} from "firebase/firestore";

import { db } from "../firebase";
import { sanitizeFormData, sanitizeText } from "../utils/sanitize";
import { commitBatchOperations, deleteQueryInChunks } from "../utils/firestoreBulk";
import { requireOperationId } from "../utils/operationId";

const orgsCol = collection(db, "organizations");
const contactsCol = collection(db, "organizationContacts");

/* ========== Organizations ========== */

export async function getOrganizations() {
  try {
    const snap = await getDocs(query(orgsCol, orderBy("createdAt", "desc")));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(orgsCol);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
}


export async function createOrganization(data) {
  const payload = {
    organizationName: sanitizeText(data.organizationName, 200),
    category: sanitizeText(data.category, 60),
    phone: sanitizeText(data.phone, 40),
    email: sanitizeText(data.email, 200),
    website: sanitizeText(data.website, 300),
    address: sanitizeText(data.address, 300),
    status: sanitizeText(data.status, 40) || "פעיל",
    notes: sanitizeText(data.notes, 5000),
    primaryContactId: null,
    primaryContactName: "",
    primaryContactPhone: "",
    primaryContactEmail: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(orgsCol, payload);
  return { id: ref.id, ...payload };
}

export async function updateOrganization(id, data) {
  const payload = { ...sanitizeFormData(data), updatedAt: serverTimestamp() };
  await updateDoc(doc(db, "organizations", id), payload);
  return { id, ...payload };
}

export async function deleteOrganization(id) {
  await deleteQueryInChunks(db, query(contactsCol, where("organizationId", "==", id)));
  await deleteDoc(doc(db, "organizations", id));
}

export async function archiveOrganization(id) {
  await updateDoc(doc(db, "organizations", id), {
    status: "לא פעיל",
    archived: true,
    updatedAt: serverTimestamp(),
  });
}

/* ========== Organization Contacts ========== */

export async function getAllOrganizationContacts() {
  const snap = await getDocs(contactsCol);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getContactsForOrganization(organizationId) {
  if (!organizationId) return [];
  const snap = await getDocs(query(contactsCol, where("organizationId", "==", organizationId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createOrganizationContact(data) {
  const payload = {
    organizationId: data.organizationId || "",
    organizationName: sanitizeText(data.organizationName, 200),
    contactName: sanitizeText(data.contactName, 200),
    role: sanitizeText(data.role, 100),
    phone: sanitizeText(data.phone, 40),
    email: sanitizeText(data.email, 200),
    notes: sanitizeText(data.notes, 5000),
    isPrimary: !!data.isPrimary,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(contactsCol, payload);
  return { id: ref.id, ...payload };
}

export async function updateOrganizationContact(id, data) {
  const payload = { ...sanitizeFormData(data), updatedAt: serverTimestamp() };
  const contactRef = doc(db, "organizationContacts", id);
  await runTransaction(db, async (transaction) => {
    const contactSnap = await transaction.get(contactRef);
    if (!contactSnap.exists()) throw new Error("Organization contact does not exist");
    const current = contactSnap.data();
    const organizationRef = current.organizationId
      ? doc(db, "organizations", current.organizationId)
      : null;
    const organizationSnap = organizationRef
      ? await transaction.get(organizationRef)
      : null;
    transaction.update(contactRef, payload);
    if (
      organizationRef
      && organizationSnap?.exists()
      && organizationSnap.data().primaryContactId === id
    ) {
      transaction.update(organizationRef, {
        primaryContactName: payload.contactName ?? current.contactName ?? "",
        primaryContactPhone: payload.phone ?? current.phone ?? "",
        primaryContactEmail: payload.email ?? current.email ?? "",
        updatedAt: serverTimestamp(),
      });
    }
  });
  return { id, ...payload };
}

export async function deleteOrganizationContact(id) {
  const contactRef = doc(db, "organizationContacts", id);
  return runTransaction(db, async (transaction) => {
    const contactSnap = await transaction.get(contactRef);
    if (!contactSnap.exists()) return { deleted: false, idempotentReplay: true };
    const organizationId = contactSnap.data().organizationId;
    const organizationRef = organizationId
      ? doc(db, "organizations", organizationId)
      : null;
    const organizationSnap = organizationRef
      ? await transaction.get(organizationRef)
      : null;
    transaction.delete(contactRef);
    if (
      organizationRef
      && organizationSnap?.exists()
      && organizationSnap.data().primaryContactId === id
    ) {
      transaction.update(organizationRef, {
        primaryContactId: null,
        primaryContactName: "",
        primaryContactPhone: "",
        primaryContactEmail: "",
        updatedAt: serverTimestamp(),
      });
    }
    return { deleted: true, idempotentReplay: false };
  });
}

/**
 * Set a contact as the primary one for an organization.
 * Clears isPrimary on all others, sets it on the target, and updates the
 * organization document's denormalized primary contact fields.
 */
export async function setPrimaryContact(organizationId, contactId) {
  const organizationRef = doc(db, "organizations", organizationId);
  const nextPrimaryRef = doc(db, "organizationContacts", contactId);
  return runTransaction(db, async (transaction) => {
    const [organizationSnap, nextPrimarySnap] = await Promise.all([
      transaction.get(organizationRef),
      transaction.get(nextPrimaryRef),
    ]);
    if (!organizationSnap.exists() || !nextPrimarySnap.exists()) {
      throw new Error("Organization or contact does not exist");
    }
    const nextPrimary = nextPrimarySnap.data();
    if (nextPrimary.organizationId !== organizationId) {
      throw new Error("Contact does not belong to organization");
    }
    const previousPrimaryId = organizationSnap.data().primaryContactId;
    if (previousPrimaryId && previousPrimaryId !== contactId) {
      transaction.update(doc(db, "organizationContacts", previousPrimaryId), {
        isPrimary: false,
        updatedAt: serverTimestamp(),
      });
    }
    transaction.update(nextPrimaryRef, { isPrimary: true, updatedAt: serverTimestamp() });
    transaction.update(organizationRef, {
      primaryContactId: contactId,
      primaryContactName: nextPrimary.contactName || "",
      primaryContactPhone: nextPrimary.phone || "",
      primaryContactEmail: nextPrimary.email || "",
      updatedAt: serverTimestamp(),
    });
    return { id: contactId, ...nextPrimary };
  });
}

/**
 * Create an organization + a primary contact in a single flow.
 */
export async function createOrganizationWithPrimaryContact(orgData, contactData, operationId) {
  const safeOperationId = requireOperationId(operationId);
  const organizationRef = doc(orgsCol, `organization_${safeOperationId}`);
  const hasPrimaryContact = !!(
    contactData
    && (contactData.contactName || contactData.phone)
  );
  const contactRef = doc(contactsCol, `organization_contact_${safeOperationId}`);
  const contact = {
    organizationId: organizationRef.id,
    organizationName: sanitizeText(orgData.organizationName, 200),
    contactName: sanitizeText(contactData.contactName, 200),
    role: sanitizeText(contactData.role, 100),
    phone: sanitizeText(contactData.phone, 40),
    email: sanitizeText(contactData.email, 200),
    notes: sanitizeText(contactData.notes, 5000),
    isPrimary: hasPrimaryContact,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const organization = {
    organizationName: sanitizeText(orgData.organizationName, 200),
    category: sanitizeText(orgData.category, 60),
    phone: sanitizeText(orgData.phone, 40),
    email: sanitizeText(orgData.email, 200),
    website: sanitizeText(orgData.website, 300),
    address: sanitizeText(orgData.address, 300),
    status: sanitizeText(orgData.status, 40) || "פעיל",
    notes: sanitizeText(orgData.notes, 5000),
    primaryContactId: hasPrimaryContact ? contactRef.id : null,
    primaryContactName: hasPrimaryContact ? contact.contactName : "",
    primaryContactPhone: hasPrimaryContact ? contact.phone : "",
    primaryContactEmail: hasPrimaryContact ? contact.email : "",
    operationId: safeOperationId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const operations = [(batch) => batch.set(organizationRef, organization)];
  if (hasPrimaryContact) {
    operations.push((batch) => batch.set(contactRef, {
      ...contact,
      operationId: safeOperationId,
    }));
  }
  await commitBatchOperations(db, operations);
  return { id: organizationRef.id, ...organization };
}
