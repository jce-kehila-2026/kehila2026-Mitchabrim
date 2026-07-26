import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyError,
  retrySafeRead,
  userErrorMessage,
  withTimeout,
} from "../src/utils/errorPolicy.js";
import {
  GALLERY_IMAGE_MAX_BYTES,
  validateGalleryImage,
} from "../src/services/imageStoragePolicy.js";
import { redactTelemetryValue } from "../src/services/telemetry.js";

test("telemetry redacts sensitive keys and PII-like text", () => {
  const value = redactTelemetryValue({
    event: "save_failed",
    email: "person@example.com",
    nested: {
      phone: "050-123-4567",
      detail: "contact person@example.com or 0501234567",
    },
    token: "secret-value",
  });
  assert.equal(value.email, "[redacted]");
  assert.equal(value.nested.phone, "[redacted]");
  assert.equal(value.token, "[redacted]");
  assert.doesNotMatch(value.nested.detail, /person@example|0501234567/);
});

test("error classification does not retry permission or invalid input", async () => {
  assert.equal(classifyError({ code: "firestore/permission-denied" }), "permission");
  assert.equal(classifyError({ code: "invalid-argument" }), "invalid");
  assert.equal(classifyError({ code: "unavailable" }), "transient");
  assert.match(userErrorMessage({ code: "permission-denied" }), /הרשאה/);

  let attempts = 0;
  await assert.rejects(retrySafeRead(async () => {
    attempts += 1;
    const error = new Error("denied");
    error.code = "permission-denied";
    throw error;
  }, { retries: 3, delay: async () => {} }));
  assert.equal(attempts, 1);
});

test("safe reads retry transient errors with bounded attempts", async () => {
  let attempts = 0;
  const result = await retrySafeRead(async () => {
    attempts += 1;
    if (attempts < 3) {
      const error = new Error("offline");
      error.code = "unavailable";
      throw error;
    }
    return "ok";
  }, { retries: 2, delay: async () => {}, timeoutMs: 100 });
  assert.equal(result, "ok");
  assert.equal(attempts, 3);
});

test("timeouts are classified as transient", async () => {
  await assert.rejects(
    withTimeout(new Promise(() => {}), { timeoutMs: 5, label: "test" }),
    (error) => error.name === "TimeoutError" && classifyError(error) === "transient",
  );
});

test("gallery validation accepts 5MB exactly and rejects 5MB plus one byte", () => {
  assert.equal(validateGalleryImage({ type: "image/webp", size: GALLERY_IMAGE_MAX_BYTES - 1 }).valid, true);
  assert.equal(validateGalleryImage({ type: "image/webp", size: GALLERY_IMAGE_MAX_BYTES }).valid, true);
  assert.deepEqual(
    validateGalleryImage({ type: "image/webp", size: GALLERY_IMAGE_MAX_BYTES + 1 }),
    { valid: false, reason: "size" },
  );
  assert.deepEqual(
    validateGalleryImage({ type: "application/pdf", size: 100 }),
    { valid: false, reason: "type" },
  );
});
