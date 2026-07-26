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
  documentId,
  limit,
  startAfter,
  getCountFromServer,
} from "firebase/firestore";

import { db } from "../firebase";
import { sanitizeText } from "../utils/sanitize";
import { normalizeVolunteerReportInput } from "./volunteerReportPolicy.js";

const reportsCollection = collection(db, "volunteerReports");

export async function createVolunteerReport(reportData) {
  const clean = normalizeVolunteerReportInput(reportData);
  const payload = {
    ...clean,
    status: "pending",
    reviewedAt: null,
    reviewedBy: null,
    adminNote: "",
    createdAt: serverTimestamp(),
  };
  const docRef = await addDoc(reportsCollection, payload);
  return { id: docRef.id, ...payload };
}

export async function getReportsForVolunteer(volunteerId) {
  if (!volunteerId) return [];
  try {
    const q = query(
      reportsCollection,
      where("volunteerId", "==", volunteerId),
      orderBy("createdAt", "desc"),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    // Fallback without orderBy (in case composite index missing)
    const q = query(reportsCollection, where("volunteerId", "==", volunteerId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  }
}

export async function getReportsForAuthUid(authUid) {
  if (!authUid) return [];
  try {
    const q = query(
      reportsCollection,
      where("volunteerAuthUid", "==", authUid),
      orderBy("createdAt", "desc"),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    const q = query(reportsCollection, where("volunteerAuthUid", "==", authUid));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  }
}

export async function getReportsForAuthUidPage({
  authUid,
  pageSize = 20,
  cursor = null,
} = {}) {
  if (!authUid) return { items: [], lastVisible: null, hasNextPage: false };
  const snap = await getDocs(query(
    reportsCollection,
    where("volunteerAuthUid", "==", authUid),
    orderBy(documentId()),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(pageSize + 1),
  ));
  const hasNextPage = snap.docs.length > pageSize;
  const pageDocs = hasNextPage ? snap.docs.slice(0, pageSize) : snap.docs;
  return {
    items: pageDocs.map((d) => ({ id: d.id, ...d.data() })),
    lastVisible: pageDocs.at(-1) || null,
    hasNextPage,
  };
}

export async function getReportsForAuthUidCount(authUid) {
  if (!authUid) return 0;
  const snap = await getCountFromServer(
    query(reportsCollection, where("volunteerAuthUid", "==", authUid)),
  );
  return snap.data().count;
}

export async function getAllVolunteerReports() {
  try {
    const q = query(reportsCollection, orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    const snap = await getDocs(reportsCollection);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  }
}

export async function updateReportReview(reportId, { status, adminNote, reviewedBy }) {
  const ref = doc(db, "volunteerReports", reportId);
  const patch = { updatedAt: serverTimestamp() };
  if (status) {
    patch.status = status;
    patch.reviewedAt = serverTimestamp();
    if (reviewedBy) patch.reviewedBy = reviewedBy;
  }
  if (typeof adminNote === "string") patch.adminNote = sanitizeText(adminNote, 5000);
  await updateDoc(ref, patch);
}

export async function deleteVolunteerReport(reportId) {
  const ref = doc(db, "volunteerReports", reportId);
  await deleteDoc(ref);
}
