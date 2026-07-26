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
  getDocs,
  runTransaction,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { requireOperationId } from "../utils/operationId";

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
 * Fetch all financial transactions once, sorted by `date` desc.
 * Financial.jsx refreshes explicitly after its own writes, so an unbounded
 * realtime listener is not kept open for historical accounting data.
 */
export async function getFinancialTransactions() {
  const q = query(collection(db, TX_COLLECTION), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Create a new financial transaction. The service stamps
 * `createdAt: serverTimestamp()` — the caller must NOT set it.
 *
 * The payload shape (fields and types) is passed through unchanged so
 * this stays a thin wrapper: no field renames, no defaults added.
 */
export async function createFinancialTransaction(payload, { operationId } = {}) {
  if (operationId) {
    const safeOperationId = requireOperationId(operationId);
    const transactionRef = doc(db, TX_COLLECTION, `financial_${safeOperationId}`);
    return runTransaction(db, async (transaction) => {
      const existing = await transaction.get(transactionRef);
      if (existing.exists()) return transactionRef;
      transaction.set(transactionRef, {
        ...(payload || {}),
        operationId: safeOperationId,
        createdAt: serverTimestamp(),
      });
      return transactionRef;
    });
  }
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
export async function uploadReceiptFile(file, { operationId } = {}) {
  const safeFileName = String(file?.name || "receipt")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .slice(-120);
  const path = operationId
    ? `${RECEIPTS_STORAGE_PREFIX}/${requireOperationId(operationId)}_${safeFileName}`
    : `${RECEIPTS_STORAGE_PREFIX}/${Date.now()}_${safeFileName}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);
  return { url, path };
}

export async function moveReceiptLinkage({
  sourceId,
  targetId,
  sourceIsStandalone,
  sourceAttachmentId = null,
  receiptUrl,
  receiptName,
  receipt,
  receiptStoragePath = "",
  operationId,
}) {
  const safeOperationId = requireOperationId(operationId);
  if (!sourceId) throw new Error("Receipt source is required");
  if (targetId && targetId === sourceId && !sourceIsStandalone) {
    return { sourceId, targetId, idempotentReplay: true };
  }

  const sourceRef = doc(db, TX_COLLECTION, sourceId);
  const destinationRef = targetId
    ? doc(db, TX_COLLECTION, targetId)
    : doc(db, TX_COLLECTION, `receipt_${safeOperationId}`);
  return runTransaction(db, async (transaction) => {
    const [sourceSnap, destinationSnap] = await Promise.all([
      transaction.get(sourceRef),
      transaction.get(destinationRef),
    ]);
    if (!sourceSnap.exists()) {
      if (
        destinationSnap.exists()
        && destinationSnap.data().receiptMoveOperationId === safeOperationId
      ) {
        return {
          sourceId,
          targetId: destinationRef.id,
          idempotentReplay: true,
        };
      }
      const error = new Error("Receipt source not found");
      error.code = "db01/receipt-source-not-found";
      throw error;
    }

    const receiptPatch = {
      receiptUrl: receiptUrl || "",
      receiptName: receiptName || "",
      receipt: receipt || "",
      receiptStoragePath: receiptStoragePath || "",
      receiptMoveOperationId: safeOperationId,
    };
    if (targetId) {
      if (!destinationSnap.exists()) {
        const error = new Error("Receipt destination not found");
        error.code = "db01/receipt-destination-not-found";
        throw error;
      }
      transaction.update(destinationRef, receiptPatch);
    } else {
      transaction.set(destinationRef, {
        type: "קבלה_בלבד",
        amount: 0,
        source: "—",
        project: "—",
        date: new Date().toISOString().split("T")[0],
        ...receiptPatch,
        notes: "קבלה עצמאית במאגר",
        operationId: safeOperationId,
        createdAt: serverTimestamp(),
      });
    }

    if (sourceIsStandalone) {
      transaction.delete(sourceRef);
    } else if (sourceAttachmentId) {
      const nextAttachments = Array.isArray(sourceSnap.data().attachments)
        ? sourceSnap.data().attachments.filter((attachment) => attachment.id !== sourceAttachmentId)
        : [];
      transaction.update(sourceRef, {
        attachments: nextAttachments,
        receiptMoveOperationId: safeOperationId,
      });
    } else {
      transaction.update(sourceRef, {
        receiptUrl: "",
        receiptName: "",
        receipt: "",
        receiptStoragePath: "",
        receiptMoveOperationId: safeOperationId,
      });
    }
    return {
      sourceId,
      targetId: destinationRef.id,
      idempotentReplay: false,
    };
  });
}
