import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
} from "firebase/firestore";
import {
  connectStorageEmulator,
  getStorage,
  ref,
  uploadBytes,
} from "firebase/storage";
import {
  planAccountStatusMigration,
  runMigration,
} from "../scripts/sec-01-migrate-users.mjs";

const projectId = process.env.GCLOUD_PROJECT || "demo-sec01";
const [firestoreHost, firestorePort] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
const [authHost, authPort] = process.env.FIREBASE_AUTH_EMULATOR_HOST.split(":");
const [storageHost, storagePort] = process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(":");
const firestoreBase = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents`;

function encodeValue(value) {
  if (typeof value === "boolean") return { booleanValue: value };
  if (value === null) return { nullValue: null };
  return { stringValue: value };
}

async function seedDocument(path, data) {
  const response = await fetch(`${firestoreBase}/${path}`, {
    method: "PATCH",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encodeValue(value)])),
    }),
  });
  assert.equal(response.ok, true, `failed to seed ${path}: ${response.status}`);
}

async function createClient(label, role, accountState) {
  const app = initializeApp(
    {
      apiKey: "demo-key",
      authDomain: `${projectId}.firebaseapp.com`,
      projectId,
      storageBucket: `${projectId}.appspot.com`,
    },
    label,
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${authHost}:${authPort}`, { disableWarnings: true });
  const credential = await createUserWithEmailAndPassword(
    auth,
    `${label}@example.test`,
    "LocalTest!12345",
  );

  const linkedVolunteerId = `volunteer-${label}`;
  await seedDocument(`users/${credential.user.uid}`, {
    email: `${label}@example.test`,
    role,
    linkedVolunteerId,
    ...accountState,
  });
  await seedDocument(`volunteers/${linkedVolunteerId}`, {
    email: `${label}@example.test`,
    authUid: credential.user.uid,
  });
  await seedDocument(`elderly/elderly-${label}`, { volId: linkedVolunteerId });

  const db = getFirestore(app);
  connectFirestoreEmulator(db, firestoreHost, Number(firestorePort));
  const storage = getStorage(app);
  connectStorageEmulator(storage, storageHost, Number(storagePort));
  return { app, db, storage, linkedVolunteerId };
}

async function expectResult(name, operation, allowed) {
  try {
    await operation();
    assert.equal(allowed, true, `${name}: unexpectedly allowed`);
  } catch (error) {
    if (allowed) throw new Error(`${name}: unexpectedly denied (${error.code || error.message})`);
  }
}

async function testAdminCase(name, state, allowed) {
  const client = await createClient(name, "admin", state);
  try {
    await expectResult(
      `${name} Firestore`,
      () => getDoc(doc(client.db, "projects", "sec01-protected")),
      allowed,
    );
    await expectResult(
      `${name} Storage`,
      () => uploadBytes(ref(client.storage, `receipts/${name}.png`), new Uint8Array([1]), { contentType: "image/png" }),
      allowed,
    );
  } finally {
    await deleteApp(client.app);
  }
}

async function testVolunteerCase(name, state, allowed) {
  const client = await createClient(name, "volunteer", state);
  try {
    await expectResult(
      `${name} Firestore volunteer authorization`,
      () => getDoc(doc(client.db, "elderly", `elderly-${name}`)),
      allowed,
    );
  } finally {
    await deleteApp(client.app);
  }
}

await seedDocument("projects/sec01-protected", { label: "protected" });

const cases = [
  ["active-mirror-true", { status: "active", active: true }, true],
  ["active-mirror-false", { status: "active", active: false }, true],
  ["inactive-stale-true", { status: "inactive", active: true }, false],
  ["inactive-mirror-false", { status: "inactive", active: false }, false],
  ["legacy-active-only", { active: true }, false],
  ["missing-both", {}, false],
  ["invalid-status-stale-true", { status: "disabled", active: true }, false],
];

for (const [name, state, allowed] of cases) {
  await testAdminCase(`admin-${name}`, state, allowed);
  await testVolunteerCase(`volunteer-${name}`, state, allowed);
}

assert.deepEqual(planAccountStatusMigration({ status: "active", active: true }), {
  action: "unchanged",
  reason: "canonical fields already agree",
});
assert.deepEqual(planAccountStatusMigration({ status: "inactive", active: true }), {
  action: "update",
  patch: { active: false },
  reason: "status is authoritative; synchronize the legacy mirror",
});
assert.deepEqual(planAccountStatusMigration({ active: true }), {
  action: "update",
  patch: { status: "active" },
  reason: "legacy document has an unambiguous active boolean",
});
assert.equal(planAccountStatusMigration({}).action, "review");
assert.equal(planAccountStatusMigration({ status: "disabled", active: true }).action, "review");

await seedDocument("users/migration-legacy-active", { role: "volunteer", active: true });
await seedDocument("users/migration-conflict", { role: "admin", status: "inactive", active: true });
await seedDocument("users/migration-review", { role: "admin" });
const migrationSummary = await runMigration({ apply: true });
assert.equal(migrationSummary.update >= 2, true);
assert.equal(migrationSummary.review >= 1, true);

const migratedLegacy = await fetch(`${firestoreBase}/users/migration-legacy-active`, {
  headers: { Authorization: "Bearer owner" },
}).then((response) => response.json());
assert.equal(migratedLegacy.fields.status.stringValue, "active");

const migratedConflict = await fetch(`${firestoreBase}/users/migration-conflict`, {
  headers: { Authorization: "Bearer owner" },
}).then((response) => response.json());
assert.equal(migratedConflict.fields.status.stringValue, "inactive");
assert.equal(migratedConflict.fields.active.booleanValue, false);

console.log(`SEC-01: ${cases.length * 3 + 7} assertions passed (Firestore, Storage, and migration).`);
