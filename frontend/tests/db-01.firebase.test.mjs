import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { initializeApp as initializeClientApp, deleteApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore as getClientFirestore,
  runTransaction,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { elderlyMutationCore } from "../functions/src/elderlyMutationCore.js";
import { locationSettingsCore } from "../functions/src/locationSettingsCore.js";

const requireFromFunctions = createRequire(resolve(import.meta.dirname, "../functions/package.json"));
const { initializeApp: initializeAdminApp, deleteApp: deleteAdminApp } = requireFromFunctions("firebase-admin/app");
const { getFirestore: getAdminFirestore } = requireFromFunctions("firebase-admin/firestore");

const projectId = process.env.GCLOUD_PROJECT || "demo-db01";
const [firestoreHost, firestorePort] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
const [authHost, authPort] = process.env.FIREBASE_AUTH_EMULATOR_HOST.split(":");
const adminApp = initializeAdminApp({ projectId }, "db01-admin");
const adminDb = getAdminFirestore(adminApp);

function createClient(label) {
  const app = initializeClientApp({
    apiKey: "demo",
    authDomain: `${projectId}.firebaseapp.com`,
    projectId,
  }, label);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${authHost}:${authPort}`, { disableWarnings: true });
  const db = getClientFirestore(app);
  connectFirestoreEmulator(db, firestoreHost, Number(firestorePort));
  return { app, auth, db };
}

async function userClient(label, role, linkedVolunteerId = null) {
  const client = createClient(label);
  const email = `${label}@example.test`;
  const credential = await createUserWithEmailAndPassword(
    client.auth,
    email,
    "LocalTest!12345",
  );
  await adminDb.collection("users").doc(credential.user.uid).set({
    email,
    role,
    status: "active",
    active: true,
    linkedVolunteerId,
  });
  return { ...client, uid: credential.user.uid };
}

async function mustReject(worker, message) {
  let rejected = false;
  try {
    await worker();
  } catch {
    rejected = true;
  }
  assert.equal(rejected, true, message);
}

const admin = await userClient("db01-admin-user", "admin");
const volunteer = await userClient("db01-volunteer-user", "volunteer", "vol-rules");

try {
  await adminDb.collection("volunteers").doc("vol-rules").set({
    name: "Rules Volunteer",
    status: "ממתין לשיבוץ",
    authUid: volunteer.uid,
  });

  // A forbidden second write rejects the entire batch under the real rules.
  const forbiddenBatch = writeBatch(volunteer.db);
  forbiddenBatch.set(doc(volunteer.db, "profileUpdateRequests", "db01-rollback"), {
    volunteerId: "vol-rules",
    volunteerAuthUid: volunteer.uid,
    volunteerName: "Rules Volunteer",
    message: "Must not remain",
    status: "pending",
    createdAt: serverTimestamp(),
  });
  forbiddenBatch.set(doc(volunteer.db, "volunteerTasks", "db01-forbidden"), {
    volunteerId: "vol-rules",
    title: "Forbidden",
  });
  await mustReject(() => forbiddenBatch.commit(), "unauthorized mixed batch succeeded");
  assert.equal(
    (await getDoc(doc(admin.db, "profileUpdateRequests", "db01-rollback"))).exists(),
    false,
    "the first write survived a denied batch",
  );

  // Deterministic ids make an admin retry converge on one task/notification pair.
  const writeTaskPair = async () => {
    const batch = writeBatch(admin.db);
    batch.set(doc(admin.db, "volunteerTasks", "task_db01_retry"), {
      volunteerId: "vol-rules",
      volunteerAuthUid: volunteer.uid,
      operationId: "db01_retry_operation",
      title: "Atomic task",
      status: "open",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(admin.db, "volunteerNotifications", "task_assigned_task_db01_retry"), {
      volunteerId: "vol-rules",
      volunteerAuthUid: volunteer.uid,
      type: "task_assigned",
      title: "Atomic task",
      message: "Atomic task",
      taskId: "task_db01_retry",
      read: false,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  };
  await writeTaskPair();
  await writeTaskPair();
  assert.equal((await getDoc(doc(admin.db, "volunteerTasks", "task_db01_retry"))).exists(), true);
  assert.equal(
    (await getDoc(doc(admin.db, "volunteerNotifications", "task_assigned_task_db01_retry"))).exists(),
    true,
  );

  // Group count and volunteer creation commit together; replay leaves count unchanged.
  await setDoc(doc(admin.db, "volunteerGroups", "group-db01"), {
    name: "DB01 group",
    volunteerCount: 0,
  });
  const createVolunteerAtomically = () => runTransaction(admin.db, async (transaction) => {
    const volunteerRef = doc(admin.db, "volunteers", "volunteer_db01_group_retry");
    const groupRef = doc(admin.db, "volunteerGroups", "group-db01");
    const [volunteerSnap, groupSnap] = await Promise.all([
      transaction.get(volunteerRef),
      transaction.get(groupRef),
    ]);
    if (volunteerSnap.exists()) return;
    transaction.set(volunteerRef, {
      name: "Atomic volunteer",
      groupId: "group-db01",
      operationId: "db01_group_operation",
    });
    transaction.update(groupRef, {
      volunteerCount: Number(groupSnap.data()?.volunteerCount || 0) + 1,
    });
  });
  await createVolunteerAtomically();
  await createVolunteerAtomically();
  assert.equal(
    (await getDoc(doc(admin.db, "volunteerGroups", "group-db01"))).data().volunteerCount,
    1,
  );

  // Callable core: authorization and missing relationship failures leave no partial data.
  await assert.rejects(
    elderlyMutationCore({
      db: adminDb,
      callerUid: volunteer.uid,
      data: {
        action: "create",
        operationId: "unauthorized_db01_operation",
        data: { firstName: "Denied" },
      },
    }),
    (error) => error.code === "permission-denied",
  );
  await assert.rejects(elderlyMutationCore({
    db: adminDb,
    callerUid: admin.uid,
    data: {
      action: "create",
      operationId: "missing_volunteer_operation",
      data: { firstName: "No partial", volId: "does-not-exist" },
    },
  }));
  assert.equal(
    (await adminDb.collection("elderly").doc("elderly_missing_volunteer_operation").get()).exists,
    false,
  );

  await adminDb.collection("volunteers").doc("vol-elderly").set({
    name: "Assigned volunteer",
    status: "ממתין לשיבוץ",
    untouched: "preserve",
  });
  const createResult = await elderlyMutationCore({
    db: adminDb,
    callerUid: admin.uid,
    data: {
      action: "create",
      operationId: "elderly_create_operation",
      data: {
        firstName: "שרה",
        lastName: "כהן",
        idNum: "123456789",
        mobile: "0501234567",
        volId: "vol-elderly",
        unrelated: "preserve",
      },
    },
  });
  assert.equal(createResult.status, "applied");
  const replay = await elderlyMutationCore({
    db: adminDb,
    callerUid: admin.uid,
    data: {
      action: "create",
      operationId: "elderly_create_operation",
      data: {
        firstName: "שרה",
        lastName: "כהן",
        idNum: "123456789",
        mobile: "0501234567",
        volId: "vol-elderly",
        unrelated: "preserve",
      },
    },
  });
  assert.equal(replay.status, "already-applied");
  const elderlyCreated = await adminDb.collection("elderly")
    .doc("elderly_elderly_create_operation").get();
  assert.equal(elderlyCreated.data().searchSchemaVersion, 1);
  assert.equal(elderlyCreated.data().unrelated, "preserve");
  assert.equal(
    (await adminDb.collection("volunteers").doc("vol-elderly").get()).data().status,
    "משויך לאזרח ותיק",
  );

  // Legacy records (without operation metadata) remain updateable and preserve fields.
  await adminDb.collection("elderly").doc("legacy-elderly-id").set({
    firstName: "Legacy",
    lastName: "Record",
    mobile: "0507654321",
    volId: "vol-elderly",
    legacyField: "keep",
  });
  await elderlyMutationCore({
    db: adminDb,
    callerUid: admin.uid,
    data: {
      action: "update",
      elderlyId: "legacy-elderly-id",
      operationId: "legacy_update_operation",
      data: { mobile: "0501234567" },
    },
  });
  const legacy = await adminDb.collection("elderly").doc("legacy-elderly-id").get();
  assert.equal(legacy.id, "legacy-elderly-id");
  assert.equal(legacy.data().legacyField, "keep");
  assert.equal(legacy.data().searchSchemaVersion, 1);

  // Concurrent deletes must converge on the status calculated from the final state.
  await Promise.all([
    elderlyMutationCore({
      db: adminDb,
      callerUid: admin.uid,
      data: {
        action: "delete",
        elderlyId: "elderly_elderly_create_operation",
        operationId: "concurrent_delete_one",
      },
    }),
    elderlyMutationCore({
      db: adminDb,
      callerUid: admin.uid,
      data: {
        action: "delete",
        elderlyId: "legacy-elderly-id",
        operationId: "concurrent_delete_two",
      },
    }),
  ]);
  assert.equal(
    (await adminDb.collection("volunteers").doc("vol-elderly").get()).data().status,
    "ממתין לשיבוץ",
  );

  // Location settings: all environments use the authenticated callable core.
  // Reference changes and settings are atomic; linked locations cannot be deleted.
  await adminDb.collection("settings").doc("general").set({
    areas: [
      { area: "Area A", neighborhoods: ["Linked", "Empty"] },
      { area: "Area B", neighborhoods: [] },
    ],
  });
  await adminDb.collection("elderly").doc("location-elderly").set({
    firstName: "Location",
    mobile: "0501234567",
    area: "Area A",
    neighborhood: "Linked",
  });
  await adminDb.collection("volunteers").doc("location-legacy").set({
    name: "Legacy location without area",
    neighborhood: "Linked",
  });
  await assert.rejects(
    locationSettingsCore({
      db: adminDb,
      callerUid: volunteer.uid,
      data: {
        type: "renameNeighborhood",
        oldArea: "Area A",
        oldNeighborhood: "Linked",
        newNeighborhood: "Denied",
      },
    }),
    (error) => error.code === "permission-denied",
  );
  await locationSettingsCore({
    db: adminDb,
    callerUid: admin.uid,
    data: {
      type: "renameNeighborhood",
      oldArea: "Area A",
      oldNeighborhood: "Linked",
      newNeighborhood: "Renamed",
    },
  });
  assert.equal(
    (await adminDb.collection("elderly").doc("location-elderly").get()).data().neighborhood,
    "Renamed",
  );
  const renamedLegacyLocation = await adminDb.collection("volunteers").doc("location-legacy").get();
  assert.equal(renamedLegacyLocation.data().area, "Area A");
  assert.equal(renamedLegacyLocation.data().neighborhood, "Renamed");
  await locationSettingsCore({
    db: adminDb,
    callerUid: admin.uid,
    data: {
      type: "moveNeighborhood",
      oldArea: "Area A",
      oldNeighborhood: "Renamed",
      targetArea: "Area B",
    },
  });
  const movedLocation = await adminDb.collection("elderly").doc("location-elderly").get();
  assert.equal(movedLocation.data().area, "Area B");
  assert.equal(movedLocation.data().neighborhood, "Renamed");
  assert.equal(
    (await adminDb.collection("volunteers").doc("location-legacy").get()).data().area,
    "Area B",
  );

  await assert.rejects(
    locationSettingsCore({
      db: adminDb,
      callerUid: admin.uid,
      data: {
        type: "deleteNeighborhood",
        oldArea: "Area B",
        oldNeighborhood: "Renamed",
      },
    }),
    (error) => error.code === "failed-precondition"
      && error.details?.reason === "location-in-use",
  );
  const afterBlockedDelete = await adminDb.collection("settings").doc("general").get();
  assert.ok(
    afterBlockedDelete.data().areas
      .find((area) => area.area === "Area B")
      .neighborhoods.includes("Renamed"),
  );
  await locationSettingsCore({
    db: adminDb,
    callerUid: admin.uid,
    data: {
      type: "deleteNeighborhood",
      oldArea: "Area A",
      oldNeighborhood: "Empty",
    },
  });
  await locationSettingsCore({
    db: adminDb,
    callerUid: admin.uid,
    data: { type: "deleteArea", oldArea: "Area A" },
  });
  const finalLocations = await adminDb.collection("settings").doc("general").get();
  assert.equal(finalLocations.data().areas.some((area) => area.area === "Area A"), false);
  await assert.rejects(
    locationSettingsCore({
      db: adminDb,
      callerUid: admin.uid,
      data: { type: "unsupported", oldArea: "Area B" },
    }),
    (error) => error.code === "invalid-argument",
  );

  console.log(
    "DB-01 Emulator: rules rollback, deterministic replay, transactional counters, "
    + "callable authorization, failure rollback, legacy data, concurrency, and atomic "
    + "location rename/move/delete passed.",
  );
} finally {
  await Promise.all([deleteApp(admin.app), deleteApp(volunteer.app)]);
  await deleteAdminApp(adminApp);
}

