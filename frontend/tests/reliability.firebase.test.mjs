import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { connectStorageEmulator, getStorage, ref, uploadBytes } from "firebase/storage";

const projectId = process.env.GCLOUD_PROJECT || "demo-reliability";
const [firestoreHost, firestorePort] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
const [authHost, authPort] = process.env.FIREBASE_AUTH_EMULATOR_HOST.split(":");
const [storageHost, storagePort] = process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(":");
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

function createClient(label) {
  const app = initializeApp({
    apiKey: "demo",
    authDomain: `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: `${projectId}.appspot.com`,
  }, label);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${authHost}:${authPort}`, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, firestoreHost, Number(firestorePort));
  const storage = getStorage(app);
  connectStorageEmulator(storage, storageHost, Number(storagePort));
  return { app, auth, db, storage };
}

async function userClient(label, role) {
  const client = createClient(label);
  const email = `${label}@example.test`;
  const credential = await createUserWithEmailAndPassword(client.auth, email, "LocalTest!12345");
  await seed(`users/${credential.user.uid}`, {
    email,
    role,
    status: "active",
    active: true,
    ...(role === "volunteer" ? { linkedVolunteerId: `vol-${label}` } : {}),
  });
  return { ...client, uid: credential.user.uid };
}

async function mustDeny(worker, message) {
  let denied = false;
  try {
    await worker();
  } catch {
    denied = true;
  }
  assert.equal(denied, true, message);
}

const admin = await userClient("rel-admin", "admin");
const volunteer = await userClient("rel-volunteer", "volunteer");
try {
  const requestId = "atomic-request";
  const requestBatch = writeBatch(volunteer.db);
  requestBatch.set(doc(volunteer.db, "profileUpdateRequests", requestId), {
    volunteerId: "vol-rel-volunteer",
    volunteerAuthUid: volunteer.uid,
    volunteerName: "Safe Volunteer",
    message: "Update request",
    status: "pending",
    operationId: "reliability_atomic_request",
    createdAt: serverTimestamp(),
    reviewedAt: null,
    reviewedBy: null,
    adminResponse: "",
  });
  requestBatch.set(doc(volunteer.db, "profileUpdateRequestPending", volunteer.uid), {
    volunteerAuthUid: volunteer.uid,
    requestId,
    createdAt: serverTimestamp(),
  });
  requestBatch.set(doc(volunteer.db, "notifications", `profile_request_${requestId}`), {
    audience: "admin",
    type: "profile_update_request",
    title: "New request",
    message: "A request was submitted",
    requestId,
    read: false,
    createdAt: serverTimestamp(),
  });
  await requestBatch.commit();
  assert.equal((await getDoc(doc(admin.db, "profileUpdateRequests", requestId))).exists(), true);
  assert.equal((await getDoc(doc(admin.db, "notifications", `profile_request_${requestId}`))).exists(), true);

  const forbiddenBatch = writeBatch(volunteer.db);
  forbiddenBatch.set(doc(volunteer.db, "profileUpdateRequests", "must-rollback"), {
    volunteerId: "vol-rel-volunteer",
    volunteerAuthUid: volunteer.uid,
    volunteerName: "Safe Volunteer",
    message: "Must roll back",
    status: "pending",
    createdAt: serverTimestamp(),
  });
  forbiddenBatch.set(doc(volunteer.db, "volunteerTasks", "forbidden"), { title: "forbidden" });
  await mustDeny(() => forbiddenBatch.commit(), "mixed unauthorized batch unexpectedly succeeded");
  assert.equal((await getDoc(doc(admin.db, "profileUpdateRequests", "must-rollback"))).exists(), false);

  const taskBatch = writeBatch(admin.db);
  taskBatch.set(doc(admin.db, "volunteerTasks", "atomic-task"), {
    volunteerId: "vol-rel-volunteer",
    volunteerAuthUid: volunteer.uid,
    title: "Atomic task",
    status: "open",
    createdAt: serverTimestamp(),
  });
  taskBatch.set(doc(admin.db, "volunteerNotifications", "task_assigned_atomic-task"), {
    volunteerId: "vol-rel-volunteer",
    volunteerAuthUid: volunteer.uid,
    type: "task_assigned",
    title: "Atomic task",
    message: "Atomic task",
    taskId: "atomic-task",
    read: false,
    createdAt: serverTimestamp(),
  });
  await taskBatch.commit();
  assert.equal((await getDoc(doc(admin.db, "volunteerTasks", "atomic-task"))).exists(), true);
  assert.equal((await getDoc(doc(admin.db, "volunteerNotifications", "task_assigned_atomic-task"))).exists(), true);

  const exactFiveMb = new Uint8Array(5 * 1024 * 1024);
  await uploadBytes(ref(admin.storage, "images/private/exact/image.webp"), exactFiveMb, { contentType: "image/webp" });
  await mustDeny(
    () => uploadBytes(ref(admin.storage, "images/private/over/image.webp"), new Uint8Array(exactFiveMb.length + 1), { contentType: "image/webp" }),
    "image over 5MB unexpectedly succeeded",
  );
  await mustDeny(
    () => uploadBytes(ref(admin.storage, "images/private/wrong/file.pdf"), new Uint8Array(100), { contentType: "application/pdf" }),
    "non-image gallery upload unexpectedly succeeded",
  );

  console.log("Reliability Firebase integration: atomic paired writes, rollback on denied batch, exact 5MB allowed, 5MB+1 and wrong MIME denied.");
} finally {
  await Promise.all([deleteApp(admin.app), deleteApp(volunteer.app)]);
}
