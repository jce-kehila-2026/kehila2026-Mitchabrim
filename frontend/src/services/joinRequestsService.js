import { db, getJoinRequestFunctions } from "../firebase";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  getCountFromServer,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { sanitizeText } from "../utils/sanitize";

export async function createJoinRequest({ fullName, phone, type, message, email, idempotencyKey }) {
  const functions = await getJoinRequestFunctions();
  const submit = httpsCallable(functions, "submitJoinRequest");
  const result = await submit({
    fullName: sanitizeText(fullName, 100),
    phone: sanitizeText(phone, 40),
    type: sanitizeText(type, 100),
    message: sanitizeText(message, 2000),
    email: email ? sanitizeText(email, 250) : "",
    idempotencyKey,
  });
  return result.data;
}

export async function getJoinRequests() {
  const snap = await getDocs(collection(db, "joinRequests"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getRecentJoinRequests(max = 50) {
  const q = query(
    collection(db, "joinRequests"),
    orderBy("createdAt", "desc"),
    limit(Math.max(1, max)),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getJoinRequestsCount() {
  const snap = await getCountFromServer(collection(db, "joinRequests"));
  return snap.data().count;
}

export async function deleteJoinRequest(requestId) {
  await deleteDoc(doc(db, "joinRequests", requestId));
}
