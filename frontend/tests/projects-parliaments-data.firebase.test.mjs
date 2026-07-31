import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
} from "firebase/auth";
import {
  collection,
  collectionGroup,
  connectFirestoreEmulator,
  doc,
  documentId,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

const projectId = process.env.GCLOUD_PROJECT || "demo-projects-parliaments";
const [firestoreHost, firestorePort] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
const [authHost, authPort] = process.env.FIREBASE_AUTH_EMULATOR_HOST.split(":");
const app = initializeApp({ apiKey: "demo-key", projectId }, "projects-parliaments-data");
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${authHost}:${authPort}`, { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, firestoreHost, Number(firestorePort));
const publicApp = initializeApp({ apiKey: "demo-key", projectId }, "projects-parliaments-public");
const publicDb = getFirestore(publicApp);
connectFirestoreEmulator(publicDb, firestoreHost, Number(firestorePort));

async function seedActiveAdmin(uid) {
  const base = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents`;
  const response = await fetch(`${base}/users/${uid}`, {
    method: "PATCH",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        role: { stringValue: "admin" },
        status: { stringValue: "active" },
      },
    }),
  });
  assert.equal(response.ok, true);
}

const credential = await createUserWithEmailAndPassword(
  auth,
  "projects-parliaments@example.test",
  "LocalTest!12345",
);
await seedActiveAdmin(credential.user.uid);

try {
  await setDoc(doc(db, "projects", "project-one"), {
    name: "Project one",
    createdAt: serverTimestamp(),
  });
  console.log("project parent write passed");
  await setDoc(doc(db, "projects", "project-one", "elderlyParticipants", "elderly-one"), {
    elderlyId: "elderly-one",
  });
  console.log("project child write passed");
  await setDoc(doc(db, "projects", "project-one", "projectGroups", "group-one"), {
    volunteerIds: [],
  });
  console.log("project group write passed");
  await setDoc(doc(db, "parliaments", "parliament-one"), {
    name: "Parliament one",
    createdAt: serverTimestamp(),
  });
  console.log("parliament parent write passed");
  await setDoc(doc(db, "parliaments", "parliament-one", "participants", "participant-one"), {
    elderlyId: "elderly-one",
  });
  console.log("parliament participant write passed");
  await setDoc(doc(db, "parliaments", "parliament-one", "meetings", "meeting-one"), {
    date: "2026-08-01",
  });
  console.log("parliament meeting write passed");

  const projects = await getDocs(query(collection(db, "projects"), orderBy("createdAt", "desc")));
  const parliaments = await getDocs(query(collection(db, "parliaments"), orderBy("createdAt", "desc")));
  assert.equal(projects.size, 1);
  assert.equal(parliaments.size, 1);
  console.log("top-level ordered reads passed");

  const low = "\u0000";
  const high = "\uf8ff";
  const projectParticipants = await getDocs(query(
    collectionGroup(db, "elderlyParticipants"),
    where(documentId(), ">=", doc(db, "projects", low, "elderlyParticipants", low)),
    where(documentId(), "<=", doc(db, "projects", high, "elderlyParticipants", high)),
  ));
  console.log("project collection-group read passed");
  const projectGroups = await getDocs(query(
    collectionGroup(db, "projectGroups"),
    where(documentId(), ">=", doc(db, "projects", low, "projectGroups", low)),
    where(documentId(), "<=", doc(db, "projects", high, "projectGroups", high)),
  ));
  console.log("project groups collection-group read passed");
  const parliamentParticipants = await getDocs(query(
    collectionGroup(db, "participants"),
    where(documentId(), ">=", doc(db, "parliaments", low, "participants", low)),
    where(documentId(), "<=", doc(db, "parliaments", high, "participants", high)),
  ));
  console.log("parliament collection-group read passed");
  const parliamentMeetings = await getDocs(query(
    collectionGroup(db, "meetings"),
    where(documentId(), ">=", doc(db, "parliaments", low, "meetings", low)),
    where(documentId(), "<=", doc(db, "parliaments", high, "meetings", high)),
  ));
  console.log("parliament meetings collection-group read passed");
  assert.equal(projectParticipants.size, 1);
  assert.equal(projectGroups.size, 1);
  assert.equal(parliamentParticipants.size, 1);
  assert.equal(parliamentMeetings.size, 1);
  await assert.rejects(getDocs(collectionGroup(publicDb, "participants")));

  console.log("Projects and parliaments direct Firestore reads/writes passed.");
} finally {
  await Promise.all([deleteApp(app), deleteApp(publicApp)]);
}
