import { pathToFileURL } from "node:url";
import { initializeApp, deleteApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, doc, getFirestore, updateDoc, deleteField } from "firebase/firestore";
import {
  connectStorageEmulator,
  deleteObject,
  getBytes,
  getDownloadURL,
  getMetadata,
  getStorage,
  ref,
  uploadBytes,
} from "firebase/storage";
import {
  imageStoragePath,
  planImageMigration,
  resolveManagedImagePath,
} from "../src/services/imageStoragePolicy.js";

function decodeValue(value = {}) {
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  return undefined;
}

function decodeDocument(document) {
  const fields = Object.fromEntries(
    Object.entries(document.fields || {}).map(([key, value]) => [key, decodeValue(value)]),
  );
  return { id: document.name.split("/").at(-1), ...fields };
}

async function listImageDocuments(host, projectId) {
  const base = `http://${host}/v1/projects/${projectId}/databases/(default)/documents/images`;
  const documents = [];
  let pageToken = "";
  do {
    const url = new URL(base);
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers: { Authorization: "Bearer owner" } });
    if (!response.ok) throw new Error(`Failed to list emulator images: ${response.status}`);
    const body = await response.json();
    documents.push(...(body.documents || []));
    pageToken = body.nextPageToken || "";
  } while (pageToken);
  return documents.map(decodeDocument);
}

async function seedMigrationAdmin(host, projectId, uid) {
  const url = `http://${host}/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({ fields: {
      role: { stringValue: "admin" },
      status: { stringValue: "active" },
      active: { booleanValue: true },
    } }),
  });
  if (!response.ok) throw new Error(`Failed to seed emulator migration admin: ${response.status}`);
}

async function patchImageMetadata(host, projectId, imageId, patch) {
  const url = new URL(
    `http://${host}/v1/projects/${projectId}/databases/(default)/documents/images/${imageId}`,
  );
  Object.keys(patch).forEach((field) => url.searchParams.append("updateMask.fieldPaths", field));
  const fields = {};
  for (const [field, value] of Object.entries(patch)) {
    if (typeof value === "string") fields[field] = { stringValue: value };
    else if (typeof value === "boolean") fields[field] = { booleanValue: value };
  }
  const response = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  if (!response.ok) throw new Error(`Failed to patch image metadata: HTTP ${response.status}`);
}

const uploadMetadata = (metadata = {}) => ({
  contentType: metadata.contentType || undefined,
  cacheControl: metadata.cacheControl || undefined,
  contentDisposition: metadata.contentDisposition || undefined,
  customMetadata: metadata.customMetadata || undefined,
});

async function moveImage({ firestoreHost, projectId, storage, image }) {
  const sourcePath = resolveManagedImagePath(image);
  const sourceRef = ref(storage, sourcePath);
  const [bytes, metadata] = await Promise.all([getBytes(sourceRef), getMetadata(sourceRef)]);
  const targetPath = imageStoragePath({
    imageId: image.id,
    fileName: sourcePath.split("/").at(-1),
    isPublic: image.isPublic === true,
  });
  const targetRef = ref(storage, targetPath);
  await uploadBytes(targetRef, bytes, uploadMetadata(metadata));
  const url = image.isPublic === true ? await getDownloadURL(targetRef) : "";

  try {
    await patchImageMetadata(firestoreHost, projectId, image.id, { storagePath: targetPath, url });
    await deleteObject(sourceRef);
  } catch (error) {
    await patchImageMetadata(firestoreHost, projectId, image.id, {
      storagePath: image.storagePath || deleteField(),
      url: image.url || "",
    }).catch(() => {});
    await deleteObject(targetRef).catch(() => {});
    throw error;
  }
}

export { planImageMigration };

export async function runImageMigration({ apply = false } = {}) {
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
  const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const projectId = process.env.GCLOUD_PROJECT || "demo-sec03";
  if (!firestoreHost || !storageHost || (apply && !authHost)) {
    throw new Error("Refusing to run: Firebase Emulator hosts are required; production is never supported.");
  }

  const images = await listImageDocuments(firestoreHost, projectId);
  const summary = { mode: apply ? "apply-emulator" : "dry-run", unchanged: 0, move: 0, metadata: 0, externalPublic: 0, review: 0 };
  let app;
  let db;
  let storage;

  if (apply) {
    app = initializeApp({ apiKey: "demo-key", projectId, storageBucket: `${projectId}.appspot.com` }, `sec03-migration-${Date.now()}`);
    const auth = getAuth(app);
    const [authHostname, authPort] = authHost.split(":");
    connectAuthEmulator(auth, `http://${authHostname}:${authPort}`, { disableWarnings: true });
    const credential = await createUserWithEmailAndPassword(auth, `sec03-migration-${Date.now()}@example.test`, "LocalMigration!123");
    await seedMigrationAdmin(firestoreHost, projectId, credential.user.uid);
    db = getFirestore(app);
    const [firestoreHostname, firestorePort] = firestoreHost.split(":");
    connectFirestoreEmulator(db, firestoreHostname, Number(firestorePort));
    storage = getStorage(app);
    const [storageHostname, storagePort] = storageHost.split(":");
    connectStorageEmulator(storage, storageHostname, Number(storagePort));
  }

  try {
    for (const image of images) {
      const plan = planImageMigration(image);
      const key = plan.action === "external-public" ? "externalPublic" : plan.action;
      summary[key] += 1;
      console.log(JSON.stringify({ id: image.id, ...plan }));
      if (!apply) continue;
      if (plan.action === "move") {
        await moveImage({ firestoreHost, projectId, storage, image });
      }
      if (plan.action === "metadata") {
        await patchImageMetadata(firestoreHost, projectId, image.id, plan.patch);
      }
    }
  } finally {
    if (app) await deleteApp(app);
  }

  console.log(JSON.stringify(summary));
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runImageMigration({ apply: process.argv.includes("--apply") }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
