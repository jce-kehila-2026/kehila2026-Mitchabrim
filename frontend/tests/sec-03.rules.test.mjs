import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeApp, deleteApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc } from "firebase/firestore";
import {
  connectStorageEmulator,
  getBytes,
  getDownloadURL,
  getMetadata,
  getStorage,
  ref,
  uploadBytes,
} from "firebase/storage";
import { runImageMigration } from "../scripts/sec-03-migrate-images.mjs";
import { planImageMigration } from "../src/services/imageStoragePolicy.js";

const projectId = process.env.GCLOUD_PROJECT || "demo-sec03";
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const [firestoreHostname, firestorePort] = firestoreHost.split(":");
const [authHostname, authPort] = process.env.FIREBASE_AUTH_EMULATOR_HOST.split(":");
const [storageHostname, storagePort] = process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(":");
const firestoreBase = `http://${firestoreHost}/v1/projects/${projectId}/databases/(default)/documents`;

function encodeValue(value) {
  if (typeof value === "boolean") return { booleanValue: value };
  return { stringValue: value };
}

async function seedDocument(path, data) {
  const response = await fetch(`${firestoreBase}/${path}`, {
    method: "PATCH",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, encodeValue(v)])) }),
  });
  assert.equal(response.ok, true, `failed to seed ${path}: ${response.status}`);
}

async function readDocument(path) {
  const response = await fetch(`${firestoreBase}/${path}`, { headers: { Authorization: "Bearer owner" } });
  assert.equal(response.ok, true, `failed to read ${path}: ${response.status}`);
  return response.json();
}

async function createClient(name, role = null) {
  const app = initializeApp({ apiKey: "demo-key", projectId, storageBucket: `${projectId}.appspot.com` }, name);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, firestoreHostname, Number(firestorePort));
  const storage = getStorage(app);
  connectStorageEmulator(storage, storageHostname, Number(storagePort));
  if (role) {
    const auth = getAuth(app);
    connectAuthEmulator(auth, `http://${authHostname}:${authPort}`, { disableWarnings: true });
    const credential = await createUserWithEmailAndPassword(auth, `${name}@example.test`, "LocalTest!12345");
    await seedDocument(`users/${credential.user.uid}`, { role, status: "active", active: true });
  }
  return { app, db, storage };
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

const admin = await createClient("sec03-admin", "admin");
const volunteer = await createClient("sec03-volunteer", "volunteer");
const anonymous = await createClient("sec03-anonymous");

try {
  const bytes = new Uint8Array([1, 2, 3]);
  await uploadBytes(ref(admin.storage, "images/public/rules/public.png"), bytes, { contentType: "image/png" });
  await uploadBytes(ref(admin.storage, "images/private/rules/private.png"), bytes, { contentType: "image/png" });
  await uploadBytes(ref(admin.storage, "images/legacy-rules.png"), bytes, { contentType: "image/png" });

  await expectAllowed("anonymous public read", () => getBytes(ref(anonymous.storage, "images/public/rules/public.png")));
  await expectDenied("anonymous private read", () => getBytes(ref(anonymous.storage, "images/private/rules/private.png")));
  await expectDenied("anonymous legacy read", () => getBytes(ref(anonymous.storage, "images/legacy-rules.png")));
  await expectAllowed("admin public read", () => getBytes(ref(admin.storage, "images/public/rules/public.png")));
  await expectAllowed("admin private read", () => getBytes(ref(admin.storage, "images/private/rules/private.png")));
  await expectAllowed("admin private metadata read", () => getMetadata(ref(admin.storage, "images/private/rules/private.png")));
  await expectAllowed("admin legacy read", () => getBytes(ref(admin.storage, "images/legacy-rules.png")));
  await expectAllowed("volunteer public read", () => getBytes(ref(volunteer.storage, "images/public/rules/public.png")));
  await expectDenied("volunteer private read", () => getBytes(ref(volunteer.storage, "images/private/rules/private.png")));
  await expectDenied("volunteer legacy read", () => getBytes(ref(volunteer.storage, "images/legacy-rules.png")));
  await expectDenied("anonymous public write", () => uploadBytes(ref(anonymous.storage, "images/public/rules/no.png"), bytes));

  await expectAllowed("consistent public metadata", () => setDoc(doc(admin.db, "images", "consistent-public"), {
    isPublic: true,
    storagePath: "images/public/consistent-public/image.png",
    url: "public-url",
  }));
  await expectAllowed("consistent private metadata", () => setDoc(doc(admin.db, "images", "consistent-private"), {
    isPublic: false,
    storagePath: "images/private/consistent-private/image.png",
    url: "",
  }));
  await expectAllowed("anonymous public metadata read", () => getDoc(doc(anonymous.db, "images", "consistent-public")));
  await expectDenied("anonymous private metadata read", () => getDoc(doc(anonymous.db, "images", "consistent-private")));

  assert.equal(planImageMigration({ id: "a", isPublic: true, storagePath: "images/old.png" }).action, "move");
  assert.equal(planImageMigration({ id: "b", isPublic: false, storagePath: "images/old.png" }).action, "move");
  assert.equal(planImageMigration({ id: "c", isPublic: false, url: "https://example.test/image.png" }).action, "review");
  assert.equal(planImageMigration({ id: "d", isPublic: true, url: "https://example.test/image.png" }).action, "external-public");
  assert.equal(planImageMigration({ id: "e", isPublic: false, storagePath: "images/private/e/image.png", url: "token" }).action, "metadata");

  const legacyPublicRef = ref(admin.storage, "images/migrate-public.png");
  const legacyPrivateRef = ref(admin.storage, "images/migrate-private.png");
  await uploadBytes(legacyPublicRef, bytes, { contentType: "image/png" });
  await uploadBytes(legacyPrivateRef, bytes, { contentType: "image/png" });
  const legacyPublicUrl = await getDownloadURL(legacyPublicRef);
  const legacyPrivateUrl = await getDownloadURL(legacyPrivateRef);
  await seedDocument("images/migrate-public", { isPublic: true, url: legacyPublicUrl });
  await seedDocument("images/migrate-private", { isPublic: false, url: legacyPrivateUrl });

  const dryRun = await runImageMigration({ apply: false });
  assert.equal(dryRun.mode, "dry-run");
  assert.equal(dryRun.move >= 2, true);
  await expectAllowed("dry-run leaves public legacy source", () => getBytes(legacyPublicRef));
  await expectAllowed("dry-run leaves private legacy source for admin", () => getBytes(legacyPrivateRef));

  const applied = await runImageMigration({ apply: true });
  assert.equal(applied.mode, "apply-emulator");
  const publicDoc = await readDocument("images/migrate-public");
  const privateDoc = await readDocument("images/migrate-private");
  const publicPath = publicDoc.fields.storagePath.stringValue;
  const privatePath = privateDoc.fields.storagePath.stringValue;
  assert.equal(publicPath.startsWith("images/public/migrate-public/"), true);
  assert.equal(privatePath.startsWith("images/private/migrate-private/"), true);
  assert.equal(publicDoc.fields.url.stringValue.length > 0, true);
  assert.equal(privateDoc.fields.url.stringValue, "");
  await expectAllowed("migrated public anonymous read", () => getBytes(ref(anonymous.storage, publicPath)));
  await expectDenied("migrated private anonymous read", () => getBytes(ref(anonymous.storage, privatePath)));
  await expectAllowed("migrated private admin read", () => getBytes(ref(admin.storage, privatePath)));
  await expectDenied("legacy public source removed", () => getBytes(legacyPublicRef));
  await expectDenied("legacy private source removed", () => getBytes(legacyPrivateRef));

  const cors = JSON.parse(readFileSync(new URL("../storage.cors.json", import.meta.url), "utf8"));
  assert.equal(cors.some((entry) => entry.origin?.includes("http://localhost:8080") && entry.method?.includes("GET")), true);

  const imagesServiceSource = readFileSync(new URL("../src/services/imagesService.js", import.meta.url), "utf8");
  const getAllImagesBody = imagesServiceSource.match(/export async function getAllImages\(\)\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  assert.equal(getAllImagesBody.includes("loadAdminImagePreview"), false, "admin list must not wait for private previews");
  assert.equal(imagesServiceSource.includes("export async function loadAdminImagePreview"), true);

  console.log("SEC-03: 39 assertions passed (non-blocking admin list, Storage reads, CORS config, Firestore metadata, legacy migration, and dry-run).");
} finally {
  await Promise.all([deleteApp(admin.app), deleteApp(volunteer.app), deleteApp(anonymous.app)]);
}
