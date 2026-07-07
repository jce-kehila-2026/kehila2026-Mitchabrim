// src/services/financialService.js
// Firestore + Storage helpers for the admin Financial page.
//
// Two collections live here:
//   - "financial"              → historical read-only export used by
//                                Reports.jsx.
//   - "financialTransactions"  → live-edited transactions + receipts
//                                used by /admin/financial.
//
// Both are admin-only per Firestore rules; the Storage path
// `receipts/<timestamp>_<name>` is preserved exactly.

import { db, storage } from "../firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// ---------------------------------------------------------------------
// "financial" collection (Reports.jsx admin exports)
// ---------------------------------------------------------------------
const REPORTS_COLLECTION = "financial";

/**
 * Fetch every financial record. Returns { id, ...data }[] in whatever
 * order Firestore returns them (matches previous inline behavior).
 */
export async function getFinancialRecords() {
  const snap = await getDocs(collection(db, REPORTS_COLLECTION));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------------------------------------------------------------------
// "financialTransactions" collection (/admin/financial)
// ---------------------------------------------------------------------
const TX_COLLECTION = "financialTransactions";
const RECEIPTS_STORAGE_PREFIX = "receipts";

/**
 * Subscribe to all financial transactions, sorted by `date` desc.
 * Preserves the exact query used by Financial.jsx.
 *
 * @returns {() => void} unsubscribe
 */
export function subscribeFinancialTransactions(onData, onError) {
  const q = query(collection(db, TX_COLLECTION), orderBy("date", "desc"));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      if (onError) onError(err);
      else console.error("Error fetching financial data:", err);
    }
  );
}

/**
 * Create a new financial transaction. The service stamps
 * `createdAt: serverTimestamp()` — the caller must NOT set it.
 *
 * The payload shape (fields and types) is passed through unchanged so
 * this stays a thin wrapper: no field renames, no defaults added.
 */
export async function createFinancialTransaction(payload) {
  return addDoc(collection(db, TX_COLLECTION), {
    ...(payload || {}),
    createdAt: serverTimestamp(),
  });
}

/**
 * Patch an existing financial transaction. Fields are passed through
 * verbatim to updateDoc (no field renames, no merge shims).
 */
export async function updateFinancialTransaction(id, patch) {
  await updateDoc(doc(db, TX_COLLECTION, id), patch || {});
}

/**
 * Delete a financial transaction by id.
 */
export async function deleteFinancialTransaction(id) {
  await deleteDoc(doc(db, TX_COLLECTION, id));
}

/**
 * Upload a receipt file to Firebase Storage under the historical path:
 *   receipts/<Date.now()>_<file.name>
 *
 * DO NOT change this path — existing receipts point at these URLs.
 *
 * @param {File} file
 * @returns {Promise<{ url: string, path: string }>} download URL + path
 */
export async function uploadReceiptFile(file) {
  const path = `${RECEIPTS_STORAGE_PREFIX}/${Date.now()}_${file.name}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);
  return { url, path };
}
