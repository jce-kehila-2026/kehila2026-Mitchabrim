import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { planPendingLocks } from "../scripts/profile-update-pending-locks.mjs";

const read = (relativePath) => readFileSync(
  new URL(`../${relativePath}`, import.meta.url),
  "utf8",
);

const service = read("src/services/profileUpdateRequestsService.js");
const volunteerProfile = read("src/volunteer/VolunteerProfile.jsx");
const adminPage = read("src/admin/ProfileUpdateRequests.jsx");
const rules = read("firestore.rules");
const indexes = JSON.parse(read("firestore.indexes.json"));

test("profile request creation uses a per-volunteer atomic pending lock", () => {
  assert.match(service, /PENDING_LOCKS_COLLECTION = "profileUpdateRequestPending"/);
  assert.match(
    service,
    /createProfileUpdateRequest[\s\S]*batch\.set\(reqRef[\s\S]*batch\.set\(pendingLockRef[\s\S]*batch\.commit\(\)/,
  );
  assert.match(service, /profile-update\/pending-exists/);
  assert.match(
    service,
    /decideProfileUpdateRequest[\s\S]*transaction\.delete\(pendingLockRef\)/,
  );
  assert.match(
    service,
    /deleteProfileUpdateRequest[\s\S]*transaction\.delete\(pendingLockRef\)/,
  );
});

test("rules require the matching lock and do not let volunteers release it", () => {
  assert.match(rules, /profileUpdateRequestHasPendingLock\(reqId\)/);
  assert.match(rules, /match \/profileUpdateRequestPending\/\{volunteerAuthUid\}/);
  assert.match(rules, /allow update: if false;/);
  assert.match(rules, /allow delete: if isAdmin\(\);/);
  assert.match(rules, /existsAfter\([\s\S]*profileUpdateRequests/);
});

test("volunteer and admin history use bounded cursor pages", () => {
  assert.match(service, /PROFILE_REQUEST_PAGE_SIZE = 20/);
  assert.match(service, /startAfter\(cursor\)/);
  assert.match(service, /fbLimit\(safePageSize \+ 1\)/);
  assert.match(volunteerProfile, /getProfileUpdateRequestsPageForVolunteer/);
  assert.match(volunteerProfile, /טעינת בקשות נוספות/);
  assert.match(adminPage, /useState\("pending"\)/);
  assert.match(adminPage, /getProfileUpdateRequestsPageForAdmin/);
  assert.match(adminPage, /טעינת בקשות נוספות/);
  assert.doesNotMatch(adminPage, /getAllProfileUpdateRequests/);
});

test("required status pagination indexes coexist with completed-request TTL", () => {
  const signatures = indexes.indexes.map((index) => (
    `${index.collectionGroup}|${index.fields.map((field) => (
      `${field.fieldPath}:${field.order || field.arrayConfig}`
    )).join(",")}`
  ));
  assert.ok(signatures.includes(
    "profileUpdateRequests|status:ASCENDING,createdAt:DESCENDING",
  ));
  assert.ok(signatures.includes(
    "profileUpdateRequests|volunteerAuthUid:ASCENDING,status:ASCENDING,createdAt:DESCENDING",
  ));
  const ttl = indexes.fieldOverrides.find(
    (override) => override.collectionGroup === "profileUpdateRequests",
  );
  assert.equal(ttl?.fieldPath, "expiresAt");
  assert.equal(ttl?.ttl, true);
});

test("legacy reconciliation plans one lock per volunteer and reports existing duplicates", () => {
  const request = (id, uid, createdAt, status = "pending") => ({
    name: `projects/demo/databases/(default)/documents/profileUpdateRequests/${id}`,
    fields: {
      volunteerAuthUid: { stringValue: uid },
      status: { stringValue: status },
      createdAt: { timestampValue: createdAt },
    },
  });
  const lock = (uid) => ({
    name: `projects/demo/databases/(default)/documents/profileUpdateRequestPending/${uid}`,
    fields: {},
  });
  const plan = planPendingLocks([
    request("old-a", "uid-a", "2026-01-01T00:00:00.000Z"),
    request("new-a", "uid-a", "2026-02-01T00:00:00.000Z"),
    request("done-b", "uid-b", "2026-03-01T00:00:00.000Z", "approved"),
    request("pending-c", "uid-c", "2026-04-01T00:00:00.000Z"),
  ], [lock("uid-c")]);

  assert.deepEqual(plan.plans.map(({ volunteerAuthUid, requestId }) => (
    { volunteerAuthUid, requestId }
  )), [{ volunteerAuthUid: "uid-a", requestId: "new-a" }]);
  assert.deepEqual(plan.duplicates, [{
    volunteerAuthUid: "uid-a",
    requestIds: ["new-a", "old-a"],
  }]);
});
