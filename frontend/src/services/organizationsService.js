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
  writeBatch,
} from "firebase/firestore";

import { db } from "../firebase";

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

export async function getOrganizationById(id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, "organizations", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function createOrganization(data) {
  const payload = {
    organizationName: data.organizationName || "",
    category: data.category || "",
    phone: data.phone || "",
    email: data.email || "",
    website: data.website || "",
    address: data.address || "",
    status: data.status || "פעיל",
    notes: data.notes || "",
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
  const payload = { ...data, updatedAt: serverTimestamp() };
  await updateDoc(doc(db, "organizations", id), payload);
  return { id, ...payload };
}

export async function deleteOrganization(id) {
  const linksSnap = await getDocs(query(contactsCol, where("organizationId", "==", id)));
  const batch = writeBatch(db);
  linksSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, "organizations", id));
  await batch.commit();
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
    organizationName: data.organizationName || "",
    contactName: data.contactName || "",
    role: data.role || "",
    phone: data.phone || "",
    email: data.email || "",
    notes: data.notes || "",
    isPrimary: !!data.isPrimary,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(contactsCol, payload);
  return { id: ref.id, ...payload };
}

export async function updateOrganizationContact(id, data) {
  const payload = { ...data, updatedAt: serverTimestamp() };
  await updateDoc(doc(db, "organizationContacts", id), payload);
  return { id, ...payload };
}

export async function deleteOrganizationContact(id) {
  await deleteDoc(doc(db, "organizationContacts", id));
}

/**
 * Set a contact as the primary one for an organization.
 * Clears isPrimary on all others, sets it on the target, and updates the
 * organization document's denormalized primary contact fields.
 */
export async function setPrimaryContact(organizationId, contactId) {
  const snap = await getDocs(query(contactsCol, where("organizationId", "==", organizationId)));
  const batch = writeBatch(db);
  let primary = null;
  snap.docs.forEach((d) => {
    const isP = d.id === contactId;
    batch.update(d.ref, { isPrimary: isP, updatedAt: serverTimestamp() });
    if (isP) primary = { id: d.id, ...d.data() };
  });
  await batch.commit();
  if (primary) {
    await updateDoc(doc(db, "organizations", organizationId), {
      primaryContactId: primary.id,
      primaryContactName: primary.contactName || "",
      primaryContactPhone: primary.phone || "",
      primaryContactEmail: primary.email || "",
      updatedAt: serverTimestamp(),
    });
  }
}

/**
 * Create an organization + a primary contact in a single flow.
 */
export async function createOrganizationWithPrimaryContact(orgData, contactData) {
  const org = await createOrganization(orgData);
  if (contactData && (contactData.contactName || contactData.phone)) {
    const contact = await createOrganizationContact({
      ...contactData,
      organizationId: org.id,
      organizationName: org.organizationName,
      isPrimary: true,
    });
    await updateDoc(doc(db, "organizations", org.id), {
      primaryContactId: contact.id,
      primaryContactName: contact.contactName || "",
      primaryContactPhone: contact.phone || "",
      primaryContactEmail: contact.email || "",
      updatedAt: serverTimestamp(),
    });
    return {
      ...org,
      primaryContactId: contact.id,
      primaryContactName: contact.contactName,
      primaryContactPhone: contact.phone,
      primaryContactEmail: contact.email,
    };
  }
  return org;
}
