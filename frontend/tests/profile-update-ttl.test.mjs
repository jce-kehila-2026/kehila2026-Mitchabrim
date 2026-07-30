import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { profileUpdateCleanupCore } from "../functions/src/profileUpdateCleanupCore.js";
import { planProfileUpdateExpirations } from "../scripts/profile-update-expiration-backfill.mjs";
import {
  PROFILE_UPDATE_RETENTION_MONTHS,
  profileUpdateRequestExpiryDate,
} from "../src/utils/profileUpdateRequestRetention.js";

const service = readFileSync(
  new URL("../src/services/profileUpdateRequestsService.js", import.meta.url),
  "utf8",
);
const indexes = JSON.parse(readFileSync(
  new URL("../firestore.indexes.json", import.meta.url),
  "utf8",
));

test("completed request expiration is exactly two calendar months after reviewedAt", () => {
  assert.equal(PROFILE_UPDATE_RETENTION_MONTHS, 2);
  assert.equal(
    profileUpdateRequestExpiryDate(new Date("2026-01-31T12:34:56.789Z")).toISOString(),
    "2026-03-31T12:34:56.789Z",
  );
  assert.equal(
    profileUpdateRequestExpiryDate(new Date("2024-12-31T00:00:00.000Z")).toISOString(),
    "2025-02-28T00:00:00.000Z",
  );
});

test("decision writes reviewedAt and expiresAt from the same timestamp", () => {
  assert.match(service, /const reviewedAt = Timestamp\.now\(\)/);
  assert.match(service, /reviewedAt,\s*expiresAt: Timestamp\.fromDate\(/);
  assert.match(service, /profileUpdateRequestExpiryDate\(reviewedAt\.toDate\(\)\)/);
  assert.doesNotMatch(
    service,
    /status: "pending"[\s\S]{0,250}expiresAt:/,
  );
});

test("legacy backfill sets eligible expirations and clears unsafe legacy expirations", () => {
  const document = (id, fields) => ({
    name: `projects/demo/databases/(default)/documents/profileUpdateRequests/${id}`,
    fields,
  });
  const timestamp = (value) => ({ timestampValue: value });
  const string = (value) => ({ stringValue: value });
  const { plans, summary } = planProfileUpdateExpirations([
    document("pending", {
      status: string("pending"),
      reviewedAt: timestamp("2026-01-01T00:00:00.000Z"),
    }),
    document("unsafe-pending", {
      status: string("pending"),
      expiresAt: timestamp("2026-03-01T00:00:00.000Z"),
    }),
    document("missing-review", {
      status: string("approved"),
      expiresAt: timestamp("2026-03-01T00:00:00.000Z"),
    }),
    document("existing", {
      status: string("rejected"),
      reviewedAt: timestamp("2026-01-01T00:00:00.000Z"),
      expiresAt: timestamp("2026-03-01T00:00:00.000Z"),
    }),
    document("eligible", {
      status: string("approved"),
      reviewedAt: timestamp("2026-01-31T12:00:00.000Z"),
    }),
  ]);
  assert.equal(plans.length, 3);
  const expirationPlan = plans.find((plan) => plan.action === "set");
  assert.match(expirationPlan.document.name, /eligible$/);
  assert.equal(expirationPlan.expiresAt.toISOString(), "2026-03-31T12:00:00.000Z");
  assert.equal(plans.filter((plan) => plan.action === "clear").length, 2);
  assert.equal(summary.pendingSkipped, 2);
  assert.equal(summary.missingReviewedAtSkipped, 1);
  assert.equal(summary.existingExpirationSkipped, 1);
  assert.equal(summary.unsafeExpirationClears, 2);
});

test("Firestore TTL is enabled only through expiresAt and cleanup removes references", async () => {
  const ttl = indexes.fieldOverrides.find(
    (override) => override.collectionGroup === "profileUpdateRequests",
  );
  assert.equal(ttl?.fieldPath, "expiresAt");
  assert.equal(ttl?.ttl, true);

  const deleted = [];
  const db = {
    collection(name) {
      return { doc: (id) => ({ path: `${name}/${id}` }) };
    },
    runTransaction(worker) {
      return worker({
        get: async () => ({
          exists: true,
          data: () => ({ requestId: "request-a" }),
        }),
        delete: (ref) => deleted.push(ref.path),
      });
    },
  };
  await profileUpdateCleanupCore({
    db,
    requestId: "request-a",
    data: { volunteerAuthUid: "volunteer-a" },
  });
  assert.deepEqual(deleted.sort(), [
    "notifications/profile_request_request-a",
    "profileUpdateRequestPending/volunteer-a",
    "volunteerNotifications/profile_response_request-a",
  ]);
});
