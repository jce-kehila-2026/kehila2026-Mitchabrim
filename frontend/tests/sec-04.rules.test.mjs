import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { normalizeVolunteerReportInput } from "../src/services/volunteerReportPolicy.js";
import { planVolunteerReportReconciliation, runReportReconciliation } from "../scripts/sec-04-reconcile-reports.mjs";

const projectId = process.env.GCLOUD_PROJECT || "demo-sec04";
const [firestoreHost, firestorePort] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
const [authHost, authPort] = process.env.FIREBASE_AUTH_EMULATOR_HOST.split(":");
const firestoreBase = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents`;

function encodeValue(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  return { stringValue: value };
}

async function seedDocument(path, data) {
  const response = await fetch(`${firestoreBase}/${path}`, {
    method: "PATCH",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encodeValue(value)])) }),
  });
  assert.equal(response.ok, true, `failed to seed ${path}: ${response.status}`);
}

async function createClient(label, role, linkedVolunteerId = "") {
  const email = `${label}@example.test`;
  const app = initializeApp({ apiKey: "demo-key", authDomain: `${projectId}.firebaseapp.com`, projectId }, label);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${authHost}:${authPort}`, { disableWarnings: true });
  const credential = await createUserWithEmailAndPassword(auth, email, "LocalTest!12345");
  await seedDocument(`users/${credential.user.uid}`, {
    email,
    role,
    status: "active",
    active: true,
    ...(linkedVolunteerId ? { linkedVolunteerId } : {}),
  });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, firestoreHost, Number(firestorePort));
  return { app, db, uid: credential.user.uid, email };
}

async function expectAllowed(label, operation) {
  try { return await operation(); } catch (error) {
    throw new Error(`${label}: unexpectedly denied (${error.code || error.message})`);
  }
}

async function expectDenied(label, operation) {
  let denied = false;
  try { await operation(); } catch { denied = true; }
  assert.equal(denied, true, `${label}: unexpectedly allowed`);
}

function validPayload(client, overrides = {}) {
  return {
    volunteerId: "volunteer-a",
    volunteerAuthUid: client.uid,
    volunteerName: "Volunteer A",
    volunteerEmail: client.email,
    elderlyId: "elderly-a",
    elderlyName: "Elderly A",
    reportDate: "2026-07-21",
    reportType: "ביקור בית",
    notes: "Legitimate local report",
    status: "pending",
    reviewedAt: null,
    reviewedBy: null,
    adminNote: "",
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

function validProfileRequest(client, overrides = {}) {
  return {
    volunteerId: "volunteer-a",
    volunteerAuthUid: client.uid,
    volunteerName: "Volunteer A",
    message: "Please update my phone number",
    status: "pending",
    operationId: "profile_test_operation_a",
    createdAt: serverTimestamp(),
    reviewedAt: null,
    reviewedBy: null,
    adminResponse: "",
    ...overrides,
  };
}

const volunteerA = await createClient("sec04-a", "volunteer", "volunteer-a");
const volunteerB = await createClient("sec04-b", "volunteer", "volunteer-b");
const admin = await createClient("sec04-admin", "admin");

try {
  await seedDocument("volunteers/volunteer-a", { authUid: volunteerA.uid, email: volunteerA.email, name: "Volunteer A" });
  await seedDocument("volunteers/volunteer-b", { authUid: volunteerB.uid, email: volunteerB.email, name: "Volunteer B" });
  await seedDocument("elderly/elderly-a", { volId: "volunteer-a", name: "Elderly A" });
  await seedDocument("elderly/elderly-b", { volId: "volunteer-b", name: "Elderly B" });

  const created = await expectAllowed("legitimate volunteer report", () => addDoc(collection(volunteerA.db, "volunteerReports"), validPayload(volunteerA)));
  await expectDenied("forged auth uid", () => addDoc(collection(volunteerA.db, "volunteerReports"), validPayload(volunteerA, { volunteerAuthUid: volunteerB.uid })));
  await expectDenied("forged volunteer id", () => addDoc(collection(volunteerA.db, "volunteerReports"), validPayload(volunteerA, { volunteerId: "volunteer-b" })));
  await expectDenied("unassigned elderly id", () => addDoc(collection(volunteerA.db, "volunteerReports"), validPayload(volunteerA, { elderlyId: "elderly-b" })));
  await expectDenied("missing elderly", () => addDoc(collection(volunteerA.db, "volunteerReports"), validPayload(volunteerA, { elderlyId: "missing" })));
  await expectDenied("forged email", () => addDoc(collection(volunteerA.db, "volunteerReports"), validPayload(volunteerA, { volunteerEmail: volunteerB.email })));
  await expectDenied("injected admin field", () => addDoc(collection(volunteerA.db, "volunteerReports"), validPayload(volunteerA, { approvedBy: "attacker" })));
  const missingField = validPayload(volunteerA); delete missingField.notes;
  await expectDenied("missing required field", () => addDoc(collection(volunteerA.db, "volunteerReports"), missingField));
  await expectDenied("wrong notes type", () => addDoc(collection(volunteerA.db, "volunteerReports"), validPayload(volunteerA, { notes: false })));
  await expectDenied("oversized notes", () => addDoc(collection(volunteerA.db, "volunteerReports"), validPayload(volunteerA, { notes: "x".repeat(2001) })));
  await expectDenied("invalid report type", () => addDoc(collection(volunteerA.db, "volunteerReports"), validPayload(volunteerA, { reportType: "forged" })));
  await expectDenied("invalid report date", () => addDoc(collection(volunteerA.db, "volunteerReports"), validPayload(volunteerA, { reportDate: "21/07/2026" })));
  await expectDenied("pre-approved report", () => addDoc(collection(volunteerA.db, "volunteerReports"), validPayload(volunteerA, { status: "approved" })));
  await expectDenied("injected review note", () => addDoc(collection(volunteerA.db, "volunteerReports"), validPayload(volunteerA, { adminNote: "trusted" })));
  await expectDenied("client supplied creation time", () => addDoc(collection(volunteerA.db, "volunteerReports"), validPayload(volunteerA, { createdAt: new Date("2020-01-01") })));

  await expectAllowed("volunteer reads own report", () => getDoc(doc(volunteerA.db, "volunteerReports", created.id)));
  await expectDenied("other volunteer cannot read report", () => getDoc(doc(volunteerB.db, "volunteerReports", created.id)));
  const ownQuery = query(collection(volunteerA.db, "volunteerReports"), where("volunteerAuthUid", "==", volunteerA.uid));
  const ownReports = await expectAllowed("volunteer lists own reports", () => getDocs(ownQuery));
  assert.equal(ownReports.size, 1);
  await expectDenied("volunteer cannot update report", () => updateDoc(doc(volunteerA.db, "volunteerReports", created.id), { notes: "changed" }));
  await expectDenied("volunteer cannot delete report", () => deleteDoc(doc(volunteerA.db, "volunteerReports", created.id)));
  await expectAllowed("admin reviews report", () => updateDoc(doc(admin.db, "volunteerReports", created.id), { status: "approved", adminNote: "reviewed" }));
  await expectAllowed("admin creates compatibility report", () => setDoc(doc(admin.db, "volunteerReports", "admin-legacy"), { legacy: true }));

  const profileRequestRef = doc(
    volunteerA.db,
    "profileUpdateRequests",
    "profile_profile_test_operation_a",
  );
  const profileNotificationRef = doc(
    volunteerA.db,
    "notifications",
    "profile_request_profile_profile_test_operation_a",
  );
  const profilePendingLockRef = doc(
    volunteerA.db,
    "profileUpdateRequestPending",
    volunteerA.uid,
  );
  const commitProfileRequest = async (requestRef, payload) => {
    const batch = writeBatch(volunteerA.db);
    batch.set(requestRef, payload);
    batch.set(profilePendingLockRef, {
      volunteerAuthUid: volunteerA.uid,
      requestId: requestRef.id,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  };
  await expectAllowed("volunteer atomically creates own profile request", async () => {
    const batch = writeBatch(volunteerA.db);
    batch.set(profileRequestRef, validProfileRequest(volunteerA));
    batch.set(profilePendingLockRef, {
      volunteerAuthUid: volunteerA.uid,
      requestId: profileRequestRef.id,
      createdAt: serverTimestamp(),
    });
    batch.set(profileNotificationRef, {
      audience: "admin",
      type: "profile_update_request",
      title: "New profile update request",
      message: "Volunteer A submitted a profile update request",
      requestId: profileRequestRef.id,
      read: false,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  });
  await expectDenied(
    "volunteer cannot stack a second pending profile request",
    () => commitProfileRequest(
      doc(volunteerA.db, "profileUpdateRequests", "profile_second_pending_operation"),
      validProfileRequest(volunteerA, { operationId: "profile_second_pending_operation" }),
    ),
  );
  await expectDenied(
    "other volunteer cannot read pending profile request lock",
    () => getDoc(doc(volunteerB.db, "profileUpdateRequestPending", volunteerA.uid)),
  );
  await expectDenied(
    "volunteer cannot delete own pending profile request lock",
    () => deleteDoc(profilePendingLockRef),
  );
  await expectAllowed(
    "volunteer reads own profile request",
    () => getDoc(profileRequestRef),
  );
  await expectDenied(
    "volunteer cannot read another volunteer profile request",
    () => getDoc(doc(volunteerB.db, "profileUpdateRequests", profileRequestRef.id)),
  );
  const ownProfileQuery = query(
    collection(volunteerA.db, "profileUpdateRequests"),
    where("volunteerAuthUid", "==", volunteerA.uid),
    orderBy("createdAt", "desc"),
    limit(20),
  );
  const ownProfileRequests = await expectAllowed(
    "volunteer lists own profile requests",
    () => getDocs(ownProfileQuery),
  );
  assert.equal(ownProfileRequests.size, 1);
  const ownPendingProfileQuery = query(
    collection(volunteerA.db, "profileUpdateRequests"),
    where("volunteerAuthUid", "==", volunteerA.uid),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc"),
    limit(1),
  );
  const ownPendingProfileRequests = await expectAllowed(
    "volunteer loads own pending request state",
    () => getDocs(ownPendingProfileQuery),
  );
  assert.equal(ownPendingProfileRequests.size, 1);
  await expectAllowed("admin processes request and releases pending lock", async () => {
    const reviewedAt = Timestamp.now();
    const batch = writeBatch(admin.db);
    batch.update(doc(admin.db, "profileUpdateRequests", profileRequestRef.id), {
      status: "approved",
      reviewedAt,
      expiresAt: Timestamp.fromMillis(reviewedAt.toMillis() + (62 * 24 * 60 * 60 * 1000)),
      reviewedBy: admin.uid,
      adminResponse: "Updated",
    });
    batch.delete(doc(admin.db, "profileUpdateRequestPending", volunteerA.uid));
    await batch.commit();
  });
  await expectDenied(
    "volunteer cannot forge linked volunteer id",
    () => commitProfileRequest(
      doc(volunteerA.db, "profileUpdateRequests", "profile_forged_volunteer"),
      validProfileRequest(volunteerA, {
        volunteerId: "volunteer-b",
        operationId: "profile_forged_volunteer",
      }),
    ),
  );
  await expectDenied(
    "volunteer cannot forge auth uid",
    () => commitProfileRequest(
      doc(volunteerA.db, "profileUpdateRequests", "profile_forged_auth"),
      validProfileRequest(volunteerA, {
        volunteerAuthUid: volunteerB.uid,
        operationId: "profile_forged_auth",
      }),
    ),
  );
  for (const [label, patch] of [
    ["reviewedBy", { reviewedBy: volunteerA.uid }],
    ["reviewedAt", { reviewedAt: new Date() }],
    ["adminResponse", { adminResponse: "self approved" }],
    ["adminNote", { adminNote: "injected" }],
    ["createdBy", { createdBy: volunteerA.uid }],
    ["status", { status: "approved" }],
  ]) {
    await expectDenied(
      `volunteer cannot create profile request with administrative ${label}`,
      () => commitProfileRequest(
        doc(volunteerA.db, "profileUpdateRequests", `profile_admin_${label}`),
        validProfileRequest(volunteerA, {
          ...patch,
          operationId: `profile_admin_${label}`,
        }),
      ),
    );
  }
  await expectDenied(
    "volunteer cannot modify profile review fields",
    () => updateDoc(profileRequestRef, {
      status: "approved",
      reviewedBy: volunteerA.uid,
      adminResponse: "self approved",
    }),
  );
  await expectAllowed(
    "admin reads profile update request",
    () => getDoc(doc(admin.db, "profileUpdateRequests", profileRequestRef.id)),
  );
  await expectAllowed(
    "admin lists profile update requests",
    () => getDocs(collection(admin.db, "profileUpdateRequests")),
  );
  await expectAllowed(
    "volunteer creates a new request after previous request is processed",
    () => commitProfileRequest(
      doc(volunteerA.db, "profileUpdateRequests", "profile_after_review_operation"),
      validProfileRequest(volunteerA, { operationId: "profile_after_review_operation" }),
    ),
  );

  await seedDocument("volunteerReports/existing-inconsistent", {
    volunteerId: "volunteer-b",
    volunteerAuthUid: volunteerA.uid,
    status: "pending",
  });
  await expectAllowed("legacy own report remains readable", () => getDoc(doc(volunteerA.db, "volunteerReports", "existing-inconsistent")));
  await expectAllowed("admin reads legacy inconsistent report", () => getDoc(doc(admin.db, "volunteerReports", "existing-inconsistent")));

  const normalized = normalizeVolunteerReportInput({ ...validPayload(volunteerA), injected: "drop-me", notes: "x".repeat(2100) });
  assert.equal("injected" in normalized, false);
  assert.equal(normalized.notes.length, 2000);
  assert.throws(() => normalizeVolunteerReportInput({ ...validPayload(volunteerA), reportType: "forged" }));

  assert.equal(planVolunteerReportReconciliation({
    report: { id: "r", ...validPayload(volunteerA), createdAt: "timestamp" },
    user: { linkedVolunteerId: "volunteer-a" },
    volunteer: { id: "volunteer-a" },
    elderly: { id: "elderly-a", volId: "volunteer-a" },
  }).action, "consistent");
  assert.equal(planVolunteerReportReconciliation({
    report: { id: "r", ...validPayload(volunteerA), createdAt: "timestamp", injected: true },
    user: { linkedVolunteerId: "volunteer-b" },
    volunteer: { id: "volunteer-a" },
    elderly: { id: "elderly-a", volId: "volunteer-b" },
  }).action, "review");

  const reconciliation = await runReportReconciliation();
  assert.equal(reconciliation.mode, "dry-run-emulator");
  assert.equal(reconciliation.review >= 2, true);

  console.log(
    "SEC-04: report and profile-request rules passed "
    + "(own create/read/list, cross-user isolation, administrative-field protection, "
    + "Admin workflow, legacy compatibility, and dry-run reconciliation).",
  );
} finally {
  await Promise.all([deleteApp(volunteerA.app), deleteApp(volunteerB.app), deleteApp(admin.app)]);
}
