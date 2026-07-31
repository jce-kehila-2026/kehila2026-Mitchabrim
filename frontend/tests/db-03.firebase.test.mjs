import assert from "node:assert/strict";
import { runDb03Backfill } from "../scripts/db-03-backfill-expires-at.mjs";

const projectId = process.env.GCLOUD_PROJECT || "demo-db03";
const base = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents`;

async function seed(path, fields) {
  const response = await fetch(`${base}/${path}`, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer owner",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });
  assert.equal(response.ok, true, `seed ${path} failed`);
}

async function read(path) {
  const response = await fetch(`${base}/${path}`, {
    headers: { Authorization: "Bearer owner" },
  });
  assert.equal(response.ok, true, `read ${path} failed`);
  return response.json();
}

await seed("joinRequestIdempotency/legacy", {
  createdAt: { timestampValue: "2026-01-01T00:00:00.000Z" },
});
await seed("joinRequestDuplicates/valid", {
  createdAt: { timestampValue: "2026-01-01T00:00:00.000Z" },
  expiresAt: { timestampValue: "2026-01-02T00:00:00.000Z" },
});
await seed("joinRequestRateLimits/ip_hash_1000", {
  count: { integerValue: "1" },
});
await seed("joinRequestRateLimits/phone_hash_1000", {
  count: { integerValue: "1" },
  expiresAt: { stringValue: "invalid-legacy-value" },
});
await seed("joinRequestRateLimits/unknown", {
  count: { integerValue: "1" },
});

const dryRun = await runDb03Backfill();
assert.equal(dryRun.writesOccurred, false);
assert.equal(dryRun.requiringUpdates, 2);
assert.equal(
  (await read("joinRequestIdempotency/legacy")).fields?.expiresAt,
  undefined,
  "dry-run wrote a field",
);

const apply = await runDb03Backfill({ apply: true });
assert.equal(apply.updated, 2);
assert.equal(apply.writesOccurred, true);
assert.equal(
  typeof (await read("joinRequestIdempotency/legacy")).fields.expiresAt.timestampValue,
  "string",
);
assert.equal(
  typeof (await read("joinRequestRateLimits/ip_hash_1000")).fields.expiresAt.timestampValue,
  "string",
);

const postApply = await runDb03Backfill();
assert.equal(postApply.requiringUpdates, 0);
assert.equal(
  postApply.collections.joinRequestRateLimits.invalidType,
  1,
  "invalid legacy types must be reported, not guessed",
);
assert.equal(
  postApply.collections.joinRequestRateLimits.missingUnrepairable,
  1,
);

console.log(
  "DB-03 Emulator: dry-run made no writes, bounded apply wrote only derivable "
  + "missing timestamps, and invalid/unknown legacy data was left untouched.",
);

