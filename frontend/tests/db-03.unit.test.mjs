import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import { submitJoinRequestCore } from "../functions/src/joinRequestCore.js";
import {
  classifyDocument,
  TTL_COLLECTIONS,
} from "../scripts/db-03-backfill-expires-at.mjs";

const DAY_MS = 86_400_000;

class MemoryDb {
  constructor() {
    this.docs = new Map();
  }

  collection(name) {
    return { doc: (id) => ({ path: `${name}/${id}`, id }) };
  }

  async runTransaction(worker) {
    const tx = {
      get: async (ref) => ({
        exists: this.docs.has(ref.path),
        data: () => this.docs.get(ref.path),
      }),
      create: (ref, data) => {
        if (this.docs.has(ref.path)) throw new Error("already exists");
        this.docs.set(ref.path, data);
      },
      set: (ref, data, options) => {
        const current = options?.merge ? (this.docs.get(ref.path) || {}) : {};
        const next = { ...current, ...data };
        if (data.count && typeof data.count === "object") {
          next.count = Number(current.count || 0) + 1;
        }
        this.docs.set(ref.path, next);
      },
    };
    return worker(tx);
  }
}

const request = (key = "db03_idempotency_key_0001") => ({
  fullName: "TTL Test",
  phone: "0501234567",
  email: "ttl@example.test",
  type: "אחר",
  message: "TTL test",
  idempotencyKey: key,
});

test("only the three proven operational collection groups are TTL candidates", () => {
  assert.deepEqual(
    TTL_COLLECTIONS.map(({ name }) => name),
    [
      "joinRequestIdempotency",
      "joinRequestDuplicates",
      "joinRequestRateLimits",
    ],
  );
  const root = resolve(import.meta.dirname, "..");
  const source = readFileSync(resolve(root, "functions/src/joinRequestCore.js"), "utf8");
  const writers = [...source.matchAll(/expiresAt:/g)];
  assert.equal(writers.length, 4);
  assert.match(source, /Timestamp\.fromMillis/);
});

test("join request expiration fields are Firestore Timestamps with intended retention", async () => {
  const db = new MemoryDb();
  const now = 1_800_000_000_000;
  const result = await submitJoinRequestCore({
    db,
    data: request(),
    appCheckToken: "app-check",
    ip: "127.0.0.1",
    pepper: "db03-secret",
    now,
  });
  assert.equal(result.status, "submitted");

  const byCollection = (name) => [...db.docs.entries()]
    .filter(([path]) => path.startsWith(`${name}/`))
    .map(([, value]) => value);
  const idempotency = byCollection("joinRequestIdempotency")[0];
  const duplicate = byCollection("joinRequestDuplicates")[0];
  const rateLimits = byCollection("joinRequestRateLimits");
  assert.equal(idempotency.expiresAt.toMillis() - now, DAY_MS);
  assert.equal(duplicate.expiresAt.toMillis() - now, DAY_MS);
  assert.deepEqual(
    rateLimits.map((item) => item.expiresAt.toMillis() - now).sort((a, b) => a - b),
    [1_200_000, 172_800_000],
  );
});

test("expired idempotency and duplicate documents do not depend on delayed TTL deletion", async () => {
  const db = new MemoryDb();
  const firstNow = 1_800_000_000_000;
  const context = {
    db,
    data: request(),
    appCheckToken: "app-check",
    ip: "127.0.0.1",
    pepper: "db03-secret",
  };
  const first = await submitJoinRequestCore({ ...context, now: firstNow });
  const replay = await submitJoinRequestCore({ ...context, now: firstNow + 1_000 });
  assert.equal(replay.status, "duplicate");
  assert.equal(replay.requestId, first.requestId);

  const afterExpiration = await submitJoinRequestCore({
    ...context,
    now: firstNow + DAY_MS + 1,
  });
  assert.equal(afterExpiration.status, "submitted");
  assert.notEqual(afterExpiration.requestId, first.requestId);
  assert.equal(
    [...db.docs.keys()].filter((path) => path.startsWith("joinRequests/")).length,
    2,
  );
});

test("backfill classification updates only missing derivable timestamps", () => {
  const idempotency = TTL_COLLECTIONS[0];
  const valid = classifyDocument({
    name: "projects/demo/databases/(default)/documents/joinRequestIdempotency/a",
    fields: { expiresAt: { timestampValue: "2026-01-02T00:00:00.000Z" } },
  }, idempotency);
  assert.equal(valid.status, "valid");

  const missing = classifyDocument({
    name: "projects/demo/databases/(default)/documents/joinRequestIdempotency/b",
    fields: { createdAt: { timestampValue: "2026-01-01T00:00:00.000Z" } },
  }, idempotency);
  assert.equal(missing.status, "missing-repairable");
  assert.equal(missing.expiration.toISOString(), "2026-01-02T00:00:00.000Z");

  const invalid = classifyDocument({
    name: "projects/demo/databases/(default)/documents/joinRequestIdempotency/c",
    fields: { expiresAt: { stringValue: "2026-01-02" } },
  }, idempotency);
  assert.equal(invalid.status, "invalid");
});

