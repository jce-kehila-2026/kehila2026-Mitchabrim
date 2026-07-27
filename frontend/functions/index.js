import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { onCall } from "firebase-functions/v2/https";
import { submitJoinRequestCore } from "./src/joinRequestCore.js";
import { inviteUserCore } from "./src/inviteUserCore.js";
import { elderlyMutationCore } from "./src/elderlyMutationCore.js";
import { getAuth } from "firebase-admin/auth";
import { locationSettingsCore } from "./src/locationSettingsCore.js";

initializeApp();
const hashPepper = defineSecret("JOIN_REQUEST_HASH_PEPPER");

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
