import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { onCall } from "firebase-functions/v2/https";
import { submitJoinRequestCore } from "./src/joinRequestCore.js";
import { inviteUserCore } from "./src/inviteUserCore.js";
import { getAuth } from "firebase-admin/auth";

initializeApp();
const hashPepper = defineSecret("JOIN_REQUEST_HASH_PEPPER");

export const submitJoinRequest = onCall({
  enforceAppCheck: true, consumeAppCheckToken: true, secrets: [hashPepper],
}, async (request) => submitJoinRequestCore({
  db: getFirestore(), data: request.data, appCheckToken: request.app?.token,
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
