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
} from "firebase/firestore";

import { db } from "../firebase";
import { sanitizeFormData, sanitizeText } from "../utils/sanitize";

const reportsCollection = collection(db, "volunteerReports");

export async function createVolunteerReport(reportData) {
  const clean = sanitizeFormData(reportData);
  const docRef = await addDoc(reportsCollection, {
    ...clean,
    status: "pending",
    reviewedAt: null,
    reviewedBy: null,
    adminNote: "",
    createdAt: serverTimestamp(),
  });
  return { id: docRef.id, ...clean };
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
