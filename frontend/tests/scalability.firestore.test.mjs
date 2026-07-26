import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDocs,
  getFirestore,
  query,
} from "firebase/firestore";
import { commitBatchOperations, deleteQueryInChunks } from "../src/utils/firestoreBulk.js";

const projectId = process.env.GCLOUD_PROJECT || "demo-scalability";
const [firestoreHost, firestorePort] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
const [authHost, authPort] = process.env.FIREBASE_AUTH_EMULATOR_HOST.split(":");
const firestoreBase = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents`;

async function seed(path, data) {
  const fields = Object.fromEntries(Object.entries(data).map(([key, value]) => [
    key,
    typeof value === "boolean" ? { booleanValue: value } : { stringValue: String(value) },
  ]));
  const response = await fetch(`${firestoreBase}/${path}`, {
    method: "PATCH",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  assert.equal(response.ok, true, `seed ${path} failed: ${response.status}`);
}

function client(label) {
  const app = initializeApp({ apiKey: "demo", authDomain: `${projectId}.firebaseapp.com`, projectId }, label);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, firestoreHost, Number(firestorePort));
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${authHost}:${authPort}`, { disableWarnings: true });
  return { app, db, auth };
}

const admin = client("scalability-admin");
const unauthorized = client("scalability-unauthorized");
try {
  const credential = await createUserWithEmailAndPassword(admin.auth, "scale-admin@example.test", "LocalTest!12345");
  await seed(`users/${credential.user.uid}`, {
    email: "scale-admin@example.test",
    role: "admin",
    status: "active",
    active: true,
  });

  const participants = collection(admin.db, "projects", "scale-project", "elderlyParticipants");
  const progress = [];
  const operations = Array.from({ length: 1001 }, (_, index) => (
    (batch) => batch.set(doc(participants, `person-${String(index).padStart(4, "0")}`), { index })
  ));
  const written = await commitBatchOperations(admin.db, operations, {
    chunkSize: 400,
    onProgress: (state) => progress.push(state),
  });
  assert.deepEqual(written, { committed: 1001, chunks: 3 });
  assert.deepEqual(progress.map(({ committed }) => committed), [400, 800, 1001]);
  assert.equal((await getDocs(participants)).size, 1001);

  const removed = await deleteQueryInChunks(admin.db, query(participants), { pageSize: 200 });
  assert.deepEqual(removed, { deleted: 1001, chunks: 6 });
  assert.equal((await getDocs(participants)).empty, true);

  let denied = false;
  try {
    await commitBatchOperations(unauthorized.db, [
      (batch) => batch.set(doc(unauthorized.db, "projects", "denied"), { name: "denied" }),
    ]);
  } catch {
    denied = true;
  }
  assert.equal(denied, true, "unauthorized bulk write was unexpectedly allowed");
  console.log("Scalability Firestore integration: 1001 writes in 3 chunks, 1001 deletes in 6 pages, unauthorized write denied.");
} finally {
  await Promise.all([deleteApp(admin.app), deleteApp(unauthorized.app)]);
}
