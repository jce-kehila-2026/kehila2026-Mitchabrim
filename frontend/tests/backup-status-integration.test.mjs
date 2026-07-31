import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { backupStatusCore } from "../functions/src/backupStatusCore.js";

const root = resolve(import.meta.dirname, "..");

const fakeDb = ({ role = "admin", status = "active", exists = true } = {}) => ({
  collection(name) {
    assert.equal(name, "users");
    return {
      doc(uid) {
        assert.ok(uid);
        return {
          async get() {
            return { exists, data: () => ({ role, status }) };
          },
        };
      },
    };
  },
});

test("backup status requires an authenticated active administrator", async () => {
  const requestJson = async () => {
    throw new Error("Cloud API must not be called");
  };

  await assert.rejects(
    backupStatusCore({
      db: fakeDb(),
      callerUid: null,
      projectId: "example-project",
      requestJson,
    }),
    (error) => error.code === "unauthenticated",
  );
  await assert.rejects(
    backupStatusCore({
      db: fakeDb({ role: "volunteer" }),
      callerUid: "volunteer",
      projectId: "example-project",
      requestJson,
    }),
    (error) => error.code === "permission-denied",
  );
  await assert.rejects(
    backupStatusCore({
      db: fakeDb({ status: "inactive" }),
      callerUid: "inactive-admin",
      projectId: "example-project",
      requestJson,
    }),
    (error) => error.code === "permission-denied",
  );
});

test("backup status returns only the safe managed-backup summary", async () => {
  const databaseName = "projects/example-project/databases/(default)";
  const requestJson = async (path) => {
    if (path === `/v1/${databaseName}`) {
      return {
        locationId: "us-east1",
        pointInTimeRecoveryEnablement: "POINT_IN_TIME_RECOVERY_DISABLED",
        uid: "must-not-be-returned",
      };
    }
    if (path.endsWith("/backupSchedules")) {
      return {
        backupSchedules: [{
          name: `${databaseName}/backupSchedules/private-id`,
          retention: "1209600s",
          dailyRecurrence: {},
        }],
      };
    }
    if (path.endsWith("/locations/-/backups")) {
      return {
        backups: [
          {
            name: "projects/example-project/locations/us-east1/backups/private-1",
            database: databaseName,
            databaseUid: "must-not-be-returned",
            state: "READY",
            snapshotTime: "2026-07-29T20:48:24Z",
            expireTime: "2026-08-12T20:48:24Z",
          },
          {
            name: "projects/example-project/locations/us-east1/backups/private-2",
            database: databaseName,
            state: "READY",
            snapshotTime: "2026-07-28T20:41:18Z",
            expireTime: "2026-08-11T20:41:18Z",
          },
        ],
      };
    }
    throw new Error(`Unexpected path: ${path}`);
  };

  const result = await backupStatusCore({
    db: fakeDb(),
    callerUid: "admin",
    projectId: "example-project",
    requestJson,
  });

  assert.equal(result.available, true);
  assert.equal(result.enabled, true);
  assert.equal(result.type, "firestore-managed-backups");
  assert.equal(result.schedule, "daily");
  assert.equal(result.retentionDays, 14);
  assert.equal(result.location, "us-east1");
  assert.equal(result.latestBackup.state, "READY");
  assert.equal(result.latestBackup.snapshotTime, "2026-07-29T20:48:24Z");
  assert.equal(result.readyBackupsCount, 2);
  assert.equal(result.pitrEnabled, false);
  assert.equal(JSON.stringify(result).includes("private-"), false);
  assert.equal(JSON.stringify(result).includes("databaseUid"), false);
});

test("settings UI refreshes status and contains no fixed backup result", () => {
  const settings = readFileSync(resolve(root, "src/admin/Settings.jsx"), "utf8");
  const service = readFileSync(resolve(root, "src/services/settingsService.js"), "utf8");
  const functionsIndex = readFileSync(resolve(root, "functions/index.js"), "utf8");

  assert.match(settings, /onClick=\{refreshBackupStatus\}/);
  assert.match(settings, /backupLoadState === "loading"/);
  assert.match(settings, /backupLoadState === "success"/);
  assert.match(settings, /backupLoadState === "failure"/);
  assert.match(settings, /backupLoadState === "unavailable"/);
  assert.doesNotMatch(settings, /28\.05\.2026|29 ביולי 2026|14 גיבויים/);
  assert.match(service, /getAuthenticatedFunctions\(\)/);
  assert.match(service, /httpsCallable\(functions, "getBackupStatus"\)/);
  assert.match(
    functionsIndex,
    /export const getBackupStatus = onCall\(\{[\s\S]*?invoker: "public"[\s\S]*?enforceAppCheck: false/,
  );
});
