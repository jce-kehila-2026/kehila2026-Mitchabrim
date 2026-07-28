import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

const projectId = process.env.GCLOUD_PROJECT || "demo-sec08";
const [firestoreHost, firestorePort] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
const [authHost, authPort] = process.env.FIREBASE_AUTH_EMULATOR_HOST.split(":");
const firestoreBase = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents`;
const authBase = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`;

function value(v) {
  if (v === null) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  return { stringValue: String(v) };
}
async function seed(path, data) {
  const response = await fetch(`${firestoreBase}/${path}`, { method: "PATCH", headers: { Authorization: "Bearer owner", "Content-Type": "application/json" }, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, value(v)])) }) });
  assert.equal(response.ok, true, `seed ${path} failed: ${response.status}`);
}
function appFor(label) {
  const app = initializeApp({ apiKey: "demo", authDomain: `${projectId}.firebaseapp.com`, projectId }, label);
  const db = getFirestore(app); connectFirestoreEmulator(db, firestoreHost, Number(firestorePort));
  const auth = getAuth(app); connectAuthEmulator(auth, `http://${authHost}:${authPort}`, { disableWarnings: true });
  return { app, db, auth };
}
async function client(label, role, status = "active") {
  const c = appFor(label); const email = `${label}@example.test`;
  const cred = await createUserWithEmailAndPassword(c.auth, email, "LocalTest!12345");
  if (role) await seed(`users/${cred.user.uid}`, { email, role, status, active: status === "active", ...(role === "volunteer" ? { linkedVolunteerId: `vol-${label}` } : {}) });
  return { ...c, uid: cred.user.uid, email };
}
async function allowed(label, fn) { try { await fn(); } catch (e) { throw new Error(`${label}: denied (${e.code || e.message})`); } }
async function denied(label, fn) { let failed = false; try { await fn(); } catch { failed = true; } assert.equal(failed, true, `${label}: unexpectedly allowed`); }
async function markVerified(uid) {
  const response = await fetch(`${authBase}/identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`, { method: "POST", headers: { Authorization: "Bearer owner", "Content-Type": "application/json" }, body: JSON.stringify({ localId: uid, emailVerified: true }) });
  assert.equal(response.ok, true, `verify emulator account failed: ${response.status}`);
}

const guest = appFor("sec08-guest");
const noDoc = await client("sec08-no-doc", null);
const volunteer = await client("sec08-volunteer", "volunteer");
const inactive = await client("sec08-inactive", "volunteer", "inactive");
const admin = await client("sec08-admin", "admin");
try {
  await denied("guest creates user", () => setDoc(doc(guest.db, "users", "guest"), { role: "admin" }));
  await denied("signed-in account without document forges admin", () => setDoc(doc(noDoc.db, "users", noDoc.uid), { email: noDoc.email, role: "admin", status: "active", active: true }));
  await seed("volunteers/uninvited-profile", { email: noDoc.email });
  await denied("volunteer profile alone is not an invitation", () => setDoc(doc(noDoc.db, "users", noDoc.uid), { email: noDoc.email, role: "volunteer", status: "active", active: true, linkedVolunteerId: "uninvited-profile" }));

  await allowed("active volunteer updates profile", () => updateDoc(doc(volunteer.db, "users", volunteer.uid), { fullName: "Allowed Name", displayName: "Allowed Name", phoneNumber: "0500000000", updatedAt: serverTimestamp() }));
  await allowed("inactive user updates harmless own profile", () => updateDoc(doc(inactive.db, "users", inactive.uid), { phoneNumber: "0500000001", updatedAt: serverTimestamp() }));
  for (const [field, v] of [["role", "admin"], ["status", "inactive"], ["active", false], ["linkedVolunteerId", "other"], ["email", "other@example.test"], ["permissions", { admin: true }], ["isAdmin", true]]) {
    await denied(`self changes ${field}`, () => updateDoc(doc(volunteer.db, "users", volunteer.uid), { [field]: v }));
  }
  await denied("self writes oversized profile", () => updateDoc(doc(volunteer.db, "users", volunteer.uid), { fullName: "x".repeat(201) }));
  await allowed("active admin changes authorization field", () => updateDoc(doc(admin.db, "users", volunteer.uid), { status: "inactive", active: false }));
  await allowed("active admin adds operational metadata", () => updateDoc(doc(admin.db, "users", volunteer.uid), { auditNote: "admin-managed" }));

  const legacy = await client("legacy.bootstrap", null);
  const inviteId = legacy.email.replace(/[^a-z0-9]/g, "_");
  await seed(`volunteers/legacy-volunteer`, { email: legacy.email });
  await seed(`users/${inviteId}`, { email: legacy.email, role: "volunteer", status: "active", active: true, linkedVolunteerId: "legacy-volunteer" });
  const bootstrap = { email: legacy.email, fullName: "Legacy User", displayName: "Legacy User", phoneNumber: "", role: "volunteer", status: "active", active: true, linkedVolunteerId: "legacy-volunteer" };
  await denied("unverified legacy invite bootstrap", () => setDoc(doc(legacy.db, "users", legacy.uid), bootstrap));
  await markVerified(legacy.uid); await signOut(legacy.auth); await signInWithEmailAndPassword(legacy.auth, legacy.email, "LocalTest!12345");
  await denied("verified bootstrap rejects unexpected field", () => setDoc(doc(legacy.db, "users", legacy.uid), { ...bootstrap, permissions: { admin: true } }));
  await denied("verified bootstrap rejects role mismatch", () => setDoc(doc(legacy.db, "users", legacy.uid), { ...bootstrap, role: "admin", linkedVolunteerId: null }));
  await allowed("verified matching legacy bootstrap", () => setDoc(doc(legacy.db, "users", legacy.uid), bootstrap));
  assert.equal((await getDoc(doc(legacy.db, "users", legacy.uid))).data().role, "volunteer");

  console.log("SEC-08: 22 authorization checks passed (guest, no-doc account, active/inactive users, admin, profile allowlist, sensitive/unexpected fields, verified legitimate and forged bootstrap)." );
  await deleteApp(legacy.app);
} finally {
  await Promise.all([guest, noDoc, volunteer, inactive, admin].map(({ app }) => deleteApp(app)));
}
