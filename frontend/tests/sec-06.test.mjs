import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initializeApp, deleteApp } from "firebase/app";
import { addDoc, collection, connectFirestoreEmulator, getFirestore, serverTimestamp } from "firebase/firestore";
import { submitJoinRequestCore, limits } from "../functions/src/joinRequestCore.js";
import { createAppCheckDebugUuid, prepareAppCheckDebugMode } from "../src/utils/appCheckDebug.js";

const projectId = process.env.GCLOUD_PROJECT || "demo-sec06";
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
const app = initializeApp({ apiKey: "demo", projectId }, "sec06-public");
const clientDb = getFirestore(app);
connectFirestoreEmulator(clientDb, host, Number(port));

async function denied(operation) {
  let failed = false;
  try { await operation(); } catch { failed = true; }
  assert.equal(failed, true);
}

class MemoryDb {
  constructor() { this.docs = new Map(); }
  collection(name) { return { doc: (id) => ({ path: `${name}/${id}`, id }) }; }
  async runTransaction(fn) {
    const tx = {
      get: async (ref) => ({ exists: this.docs.has(ref.path), data: () => this.docs.get(ref.path) }),
      create: (ref, data) => { if (this.docs.has(ref.path)) throw new Error("already exists"); this.docs.set(ref.path, data); },
      set: (ref, data, options) => {
        const old = options?.merge ? (this.docs.get(ref.path) || {}) : {};
        const next = { ...old, ...data };
        if (data.count && typeof data.count === "object") next.count = (old.count || 0) + 1;
        this.docs.set(ref.path, next);
      },
    };
    return fn(tx);
  }
  count(prefix) { return [...this.docs.keys()].filter((key) => key.startsWith(prefix)).length; }
}

const base = (n = 1) => ({
  fullName: `Local User ${n}`, phone: `0500000${String(n).padStart(3, "0")}`,
  email: `user${n}@example.test`, type: "אחר", message: "Local emulator test",
  idempotencyKey: `local_test_key_${String(n).padStart(4, "0")}`,
});

try {
  const root = resolve(import.meta.dirname, "..");
  const firebaseSource = readFileSync(resolve(root, "src/firebase.js"), "utf8");
  const serviceSource = readFileSync(resolve(root, "src/services/joinRequestsService.js"), "utf8");
  const joinFormSource = readFileSync(resolve(root, "src/components/public/JoinRequestSection.jsx"), "utf8");
  const hostingConfig = JSON.parse(readFileSync(resolve(root, "firebase.json"), "utf8"));
  assert.match(firebaseSource, /getRegionalFunctions\(\)[\s\S]*getFunctions\(app, "us-central1"\)/);
  assert.match(firebaseSource, /getSecureFunctions\(\)[\s\S]*await getToken\(appCheck, false\)/);
  assert.match(firebaseSource, /import\.meta\.env\.DEV[\s\S]*VITE_FIREBASE_APPCHECK_DEBUG/);
  assert.match(firebaseSource, /prepareAppCheckDebugMode\(self\)/);
  assert.match(firebaseSource, /join-request\/app-check-debug-token-rejected/);
  assert.match(firebaseSource, /connectFunctionsEmulator\(regionalFunctions, "127\.0\.0\.1", 5001\)/);
  assert.match(serviceSource, /await getJoinRequestFunctions\(\)[\s\S]*httpsCallable\(functions, "submitJoinRequest"\)/);
  assert.doesNotMatch(serviceSource, /isJoinRequestAppCheckConfigured|limitedUseAppCheckTokens/);
  assert.equal(hostingConfig.hosting.public, "dist");

  const cryptoStub = {
    calls: 0,
    getRandomValues(bytes) {
      this.calls += 1;
      for (let i = 0; i < bytes.length; i += 1) bytes[i] = i;
      return bytes;
    },
  };
  const generatedUuid = createAppCheckDebugUuid(cryptoStub);
  assert.match(generatedUuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  const debugTarget = { crypto: cryptoStub };
  const debugSetup = prepareAppCheckDebugMode(debugTarget);
  assert.equal(debugSetup.ready, true);
  assert.equal(debugSetup.strategy, "polyfilled");
  assert.equal(typeof debugTarget.crypto.randomUUID, "function");
  assert.equal(debugTarget.FIREBASE_APPCHECK_DEBUG_TOKEN, true);
  assert.match(debugTarget.crypto.randomUUID(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(prepareAppCheckDebugMode({}).ready, false);
  assert.match(joinFormSource, /resultStatus === "development-setup"[\s\S]*App Check Debug Token/);

  await denied(() => addDoc(collection(clientDb, "joinRequests"), { ...base(), status: "new", note: "test", createdAt: serverTimestamp() }));
  await denied(() => addDoc(collection(clientDb, "notifications"), {
    audience: "admin", type: "join_request", title: "test", message: "test",
    requestId: "test", read: false, createdAt: serverTimestamp(),
  }));

  const db = new MemoryDb();
  const context = { db, appCheckToken: "local-app-check", ip: "127.0.0.1", pepper: "local-secret", now: 1000000000 };
  const first = await submitJoinRequestCore({ ...context, data: base(1) });
  assert.equal(first.status, "submitted");
  assert.equal(db.count("joinRequests/"), 1);
  assert.equal(db.count("notifications/"), 1);

  const replay = await submitJoinRequestCore({ ...context, data: base(1) });
  assert.equal(replay.status, "duplicate");
  assert.equal(replay.requestId, first.requestId);
  const semanticDuplicate = await submitJoinRequestCore({ ...context, data: { ...base(1), idempotencyKey: "different_key_0001" } });
  assert.equal(semanticDuplicate.status, "duplicate");
  assert.equal(db.count("joinRequests/"), 1);

  await assert.rejects(() => submitJoinRequestCore({ ...context, data: { ...base(2), phone: "bad" } }), (e) => e.code === "invalid-argument");

  for (let i = 2; i <= limits.IP_LIMIT; i += 1) await submitJoinRequestCore({ ...context, data: base(i) });
  await assert.rejects(() => submitJoinRequestCore({ ...context, data: base(99) }), (e) => e.code === "resource-exhausted");
  assert.equal(db.count("joinRequests/"), limits.IP_LIMIT);
  assert.equal(db.count("notifications/"), limits.IP_LIMIT);

  console.log("SEC-06: public join callable and protected admin callables are separated; rules, validation, atomic writes, idempotency, duplicate and rapid-submission protection passed.");
} finally {
  await deleteApp(app);
}
