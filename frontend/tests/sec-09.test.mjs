import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initializeApp, deleteApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc } from "firebase/firestore";
import { inviteUserCore } from "../functions/src/inviteUserCore.js";

const projectId = process.env.GCLOUD_PROJECT || "demo-sec09";
const [firestoreHost, firestorePort] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
const [authHost, authPort] = process.env.FIREBASE_AUTH_EMULATOR_HOST.split(":");

async function denied(label, fn, code) { let caught; try { await fn(); } catch (e) { caught = e; } assert.ok(caught, `${label}: unexpectedly allowed`); if (code) assert.equal(caught.code, code); }

class Snapshot { constructor(data) { this._data = data; this.exists = data !== undefined; } data() { return this._data; } }
class MemoryDb {
  constructor() { this.docs = new Map(); }
  collection(name) {
    const db = this;
    return {
      doc(id) { return { path: `${name}/${id}`, id, get: async () => new Snapshot(db.docs.get(`${name}/${id}`)) }; },
      where(field, _op, expected) { return { limit() { return { get: async () => ({ empty: ![...db.docs.entries()].some(([k, v]) => k.startsWith(`${name}/`) && v?.[field] === expected) }) }; } }; },
    };
  }
  batch() {
    const operations = [];
    return {
      create: (ref, data) => operations.push(["create", ref, data]),
      update: (ref, data) => operations.push(["update", ref, data]),
      commit: async () => {
        for (const [type, ref] of operations) if (type === "create" && this.docs.has(ref.path)) throw Object.assign(new Error("exists"), { code: 6 });
        for (const [type, ref, data] of operations) {
          if (type === "update" && !this.docs.has(ref.path)) throw new Error("missing");
          this.docs.set(ref.path, { ...(this.docs.get(ref.path) || {}), ...data });
        }
      },
    };
  }
}
class MemoryAuth {
  constructor() { this.users = new Map(); this.next = 1; }
  async getUserByEmail(email) { const u = [...this.users.values()].find((x) => x.email === email); if (!u) throw Object.assign(new Error("missing"), { code: "auth/user-not-found" }); return u; }
  async createUser(data) { if ([...this.users.values()].some((u) => u.email === data.email)) throw Object.assign(new Error("exists"), { code: "auth/email-already-exists" }); const user = { uid: `auth-${this.next++}`, ...data }; this.users.set(user.uid, user); return user; }
  async deleteUser(uid) { this.users.delete(uid); }
}

const app = initializeApp({ apiKey: "demo", authDomain: `${projectId}.firebaseapp.com`, projectId }, "sec09-public-signup");
const auth = getAuth(app); connectAuthEmulator(auth, `http://${authHost}:${authPort}`, { disableWarnings: true });
const clientDb = getFirestore(app); connectFirestoreEmulator(clientDb, firestoreHost, Number(firestorePort));
try {
  const orphan = await createUserWithEmailAndPassword(auth, "orphan@example.test", "LocalTest!12345");
  assert.equal((await getDoc(doc(clientDb, "users", orphan.user.uid))).exists(), false);
  await denied("orphan Auth account forges app admin", () => setDoc(doc(clientDb, "users", orphan.user.uid), { email: "orphan@example.test", role: "admin", status: "active", active: true }));

  const root = resolve(import.meta.dirname, "..");
  const service = readFileSync(resolve(root, "src/services/allowedUsersService.js"), "utf8");
  const functionIndex = readFileSync(resolve(root, "functions/index.js"), "utf8");
  assert.doesNotMatch(service, /createUserWithEmailAndPassword/);
  assert.match(service, /httpsCallable\(functions, "inviteUser"\)/);
  assert.match(functionIndex, /export const inviteUser = onCall\([\s\S]*enforceAppCheck: true/);

  const db = new MemoryDb(); const adminAuth = new MemoryAuth();
  db.docs.set("users/admin", { email: "admin@example.test", role: "admin", status: "active" });
  db.docs.set("users/inactive-admin", { email: "inactive@example.test", role: "admin", status: "inactive" });
  db.docs.set("users/volunteer", { email: "volunteer@example.test", role: "volunteer", status: "active" });
  db.docs.set("volunteers/vol-1", { email: "person@example.test" });
  const data = { email: "person@example.test", displayName: "Person", role: "volunteer", active: true, linkedVolunteerId: "vol-1" };
  await denied("guest calls invite core", () => inviteUserCore({ db, auth: adminAuth, callerUid: null, data }), "unauthenticated");
  await denied("signed-in no-doc user calls invite core", () => inviteUserCore({ db, auth: adminAuth, callerUid: "missing", data }), "permission-denied");
  await denied("active volunteer calls invite core", () => inviteUserCore({ db, auth: adminAuth, callerUid: "volunteer", data }), "permission-denied");
  await denied("inactive admin calls invite core", () => inviteUserCore({ db, auth: adminAuth, callerUid: "inactive-admin", data }), "permission-denied");
  const created = await inviteUserCore({ db, auth: adminAuth, callerUid: "admin", data });
  assert.equal(created.status, "created"); assert.equal(adminAuth.users.size, 1);
  const createdAuth = [...adminAuth.users.values()][0];
  assert.equal(db.docs.get(`users/${createdAuth.uid}`).role, "volunteer");
  assert.equal(db.docs.get("volunteers/vol-1").authUid, createdAuth.uid);
  await denied("duplicate invitation", () => inviteUserCore({ db, auth: adminAuth, callerUid: "admin", data }), "already-exists");
  assert.equal(adminAuth.users.size, 1);

  db.docs.set("volunteers/vol-2", { email: "preclaimed@example.test" });
  adminAuth.users.set("preclaim", { uid: "preclaim", email: "preclaimed@example.test", emailVerified: false });
  await denied("unverified preclaimed Auth account is not authorized", () => inviteUserCore({ db, auth: adminAuth, callerUid: "admin", data: { ...data, email: "preclaimed@example.test", linkedVolunteerId: "vol-2" } }), "failed-precondition");
  assert.equal(db.docs.has("users/preclaim"), false);

  db.docs.set("volunteers/vol-3", { email: "verified@example.test" });
  adminAuth.users.set("verified-existing", { uid: "verified-existing", email: "verified@example.test", emailVerified: true });
  const linked = await inviteUserCore({ db, auth: adminAuth, callerUid: "admin", data: { ...data, email: "verified@example.test", linkedVolunteerId: "vol-3" } });
  assert.equal(linked.createdAuthUser, false); assert.equal(db.docs.get("users/verified-existing").status, "active");
  await denied("invalid role", () => inviteUserCore({ db, auth: adminAuth, callerUid: "admin", data: { ...data, email: "x@example.test", role: "owner" } }), "invalid-argument");
  await denied("missing volunteer profile", () => inviteUserCore({ db, auth: adminAuth, callerUid: "admin", data: { ...data, email: "x@example.test", linkedVolunteerId: "missing" } }), "failed-precondition");

  console.log("SEC-09: 20 checks passed (public orphan account, no app authorization, callable wiring/App Check, guest/no-doc/volunteer/inactive-admin denial, admin invite, duplicates, preclaimed and verified-existing accounts)." );
} finally { await deleteApp(app); }
