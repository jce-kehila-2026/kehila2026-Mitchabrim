import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
} from "firebase/auth";
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
} from "firebase/firestore";

const projectId = process.env.GCLOUD_PROJECT || "demo-sec07";
const [firestoreHost, firestorePort] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
const [authHost, authPort] = process.env.FIREBASE_AUTH_EMULATOR_HOST.split(":");
const firestoreBase = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents`;

async function seedDocument(path, data) {
  const response = await fetch(`${firestoreBase}/${path}`, {
    method: "PATCH",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, { stringValue: value }])),
    }),
  });
  assert.equal(response.ok, true, `failed to seed ${path}: ${response.status}`);
}

function createApp(label) {
  const app = initializeApp({
    apiKey: "demo-key",
    authDomain: `${projectId}.firebaseapp.com`,
    projectId,
  }, label);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, firestoreHost, Number(firestorePort));
  return { app, db };
}

async function createAuthenticatedClient(label, role, status = "active") {
  const client = createApp(label);
  const auth = getAuth(client.app);
  connectAuthEmulator(auth, `http://${authHost}:${authPort}`, { disableWarnings: true });
  const credential = await createUserWithEmailAndPassword(
    auth,
    `${label}@example.test`,
    "LocalTest!12345",
  );
  await seedDocument(`users/${credential.user.uid}`, {
    email: `${label}@example.test`,
    role,
    status,
  });
  return client;
}

async function expectAllowed(label, operation) {
  try {
    await operation();
  } catch (error) {
    throw new Error(`${label}: unexpectedly denied (${error.code || error.message})`);
  }
}

async function expectDenied(label, operation) {
  let denied = false;
  try {
    await operation();
  } catch {
    denied = true;
  }
  assert.equal(denied, true, `${label}: unexpectedly allowed`);
}

await seedDocument("settings/general", {
  orgName: "Local organization",
  address: "Local address",
  emails: "admin@example.test",
  phones: "0000000000",
  areas: "Synthetic areas",
  categories: "Synthetic categories",
});
await seedDocument("settings/internal", {
  operationalMode: "synthetic-admin-only",
});
await seedDocument("settings/public", {
  label: "synthetic-document-that-must-not-become-public-by-name",
});
await seedDocument("siteContent/home", {
  title: "Synthetic public content",
});

const guest = createApp("sec07-guest");
const member = await createAuthenticatedClient("sec07-member", "member");
const volunteer = await createAuthenticatedClient("sec07-volunteer", "volunteer");
const admin = await createAuthenticatedClient("sec07-admin", "admin");
const inactiveAdmin = await createAuthenticatedClient("sec07-inactive-admin", "admin", "inactive");

try {
  await expectDenied("guest reads settings/general", () => getDoc(doc(guest.db, "settings", "general")));
  await expectDenied("guest reads settings/internal", () => getDoc(doc(guest.db, "settings", "internal")));
  await expectDenied("guest reads settings/public", () => getDoc(doc(guest.db, "settings", "public")));
  await expectDenied("guest lists settings", () => getDocs(collection(guest.db, "settings")));
  await expectAllowed("guest reads public siteContent/home", () => getDoc(doc(guest.db, "siteContent", "home")));
  await expectDenied("guest writes settings/general", () => setDoc(doc(guest.db, "settings", "general"), { orgName: "blocked" }, { merge: true }));

  for (const [label, client] of [["member", member], ["active volunteer", volunteer]]) {
    await expectDenied(`${label} reads settings/general`, () => getDoc(doc(client.db, "settings", "general")));
    await expectDenied(`${label} reads settings/internal`, () => getDoc(doc(client.db, "settings", "internal")));
    await expectDenied(`${label} lists settings`, () => getDocs(collection(client.db, "settings")));
    await expectDenied(`${label} writes settings/general`, () => setDoc(doc(client.db, "settings", "general"), { orgName: "blocked" }, { merge: true }));
    await expectAllowed(`${label} reads public siteContent/home`, () => getDoc(doc(client.db, "siteContent", "home")));
  }

  await expectDenied("inactive admin reads settings/general", () => getDoc(doc(inactiveAdmin.db, "settings", "general")));
  await expectDenied("inactive admin writes settings/general", () => setDoc(doc(inactiveAdmin.db, "settings", "general"), { orgName: "blocked" }, { merge: true }));

  await expectAllowed("active admin reads settings/general", () => getDoc(doc(admin.db, "settings", "general")));
  await expectAllowed("active admin reads settings/internal", () => getDoc(doc(admin.db, "settings", "internal")));
  await expectAllowed("active admin lists settings", () => getDocs(collection(admin.db, "settings")));
  await expectAllowed("active admin updates settings/general", () => setDoc(doc(admin.db, "settings", "general"), { orgName: "Updated locally" }, { merge: true }));
  await expectAllowed("active admin creates settings/adminOnly", () => setDoc(doc(admin.db, "settings", "adminOnly"), { mode: "local" }));
  await expectAllowed("active admin deletes settings/adminOnly", () => deleteDoc(doc(admin.db, "settings", "adminOnly")));

  console.log("SEC-07: 24 authorization checks passed (guest, member, active volunteer, inactive admin, active admin, public siteContent, settings reads/lists, and writes).");
} finally {
  await Promise.all([guest, member, volunteer, admin, inactiveAdmin].map(({ app }) => deleteApp(app)));
}
