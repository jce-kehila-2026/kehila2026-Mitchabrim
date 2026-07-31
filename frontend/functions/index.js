import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getDownloadURL, getStorage } from "firebase-admin/storage";
import { defineSecret } from "firebase-functions/params";
import { onCall } from "firebase-functions/v2/https";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { submitJoinRequestCore } from "./src/joinRequestCore.js";
import { inviteUserCore } from "./src/inviteUserCore.js";
import { elderlyMutationCore } from "./src/elderlyMutationCore.js";
import { getAuth } from "firebase-admin/auth";
import { locationSettingsCore } from "./src/locationSettingsCore.js";
import { profileUpdateCleanupCore } from "./src/profileUpdateCleanupCore.js";
import { mutateImageCore } from "./src/imageMutationCore.js";
import { saveSiteContentSectionCore } from "./src/siteContentImageCore.js";
import { backupStatusCore } from "./src/backupStatusCore.js";
import { GoogleAuth } from "google-auth-library";

initializeApp();
const hashPepper = defineSecret("JOIN_REQUEST_HASH_PEPPER");
const googleAuth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

async function firestoreAdminGet(path) {
  const client = await googleAuth.getClient();
  const response = await client.request({
    method: "GET",
    url: `https://firestore.googleapis.com${path}`,
  });
  return response.data;
}

export const submitJoinRequest = onCall({
  secrets: [hashPepper],
}, async (request) => submitJoinRequestCore({
  db: getFirestore(), data: request.data,
  ip: request.rawRequest?.ip, pepper: hashPepper.value(),
}));

export const inviteUser = onCall({
  region: "us-central1",
  enforceAppCheck: true,
}, async (request) => inviteUserCore({
  db: getFirestore(),
  auth: getAuth(),
  callerUid: request.auth?.uid,
  data: request.data,
}));

export const mutateElderly = onCall({
  region: "us-central1",
  enforceAppCheck: true,
}, async (request) => elderlyMutationCore({
  db: getFirestore(),
  callerUid: request.auth?.uid,
  data: request.data,
}));

export const updateLocationSettings = onCall({
  region: "us-central1",
  enforceAppCheck: true,
}, async (request) => locationSettingsCore({
  db: getFirestore(),
  callerUid: request.auth?.uid,
  data: request.data,
}));

export const getBackupStatus = onCall({
  region: "us-central1",
  // This endpoint returns only a sanitized operational summary and performs
  // its own Firebase Auth + active-admin authorization. Keeping App Check
  // optional prevents a reCAPTCHA outage from hiding backup health.
  invoker: "public",
  enforceAppCheck: false,
}, async (request) => backupStatusCore({
  db: getFirestore(),
  callerUid: request.auth?.uid,
  projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT,
  requestJson: firestoreAdminGet,
}));

export const cleanupDeletedProfileUpdateRequest = onDocumentDeleted({
  document: "profileUpdateRequests/{requestId}",
  region: "us-central1",
}, async (event) => profileUpdateCleanupCore({
  db: getFirestore(),
  requestId: event.params.requestId,
  data: event.data?.data() || {},
}));

export const saveSiteContentSection = onCall({
  region: "us-central1",
  enforceAppCheck: true,
}, async (request) => saveSiteContentSectionCore({
  db: getFirestore(),
  callerUid: request.auth?.uid,
  data: request.data,
}));

export const mutateImage = onCall({
  region: "us-central1",
  enforceAppCheck: true,
  timeoutSeconds: 120,
  memory: "512MiB",
}, async (request) => mutateImageCore({
  db: getFirestore(),
  bucket: getStorage().bucket(),
  getDownloadUrl: getDownloadURL,
  callerUid: request.auth?.uid,
  data: request.data,
}));
