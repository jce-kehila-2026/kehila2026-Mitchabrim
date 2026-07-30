import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { createSubmissionGuard } from "../src/utils/submissionGuard.js";

const root = resolve(import.meta.dirname, "..");

test("submission guard allows only one activation for a confirmation", () => {
  const guard = createSubmissionGuard();

  assert.equal(guard.tryAcquire(), true);
  assert.equal(guard.tryAcquire(), false);
});

test("location confirmation uses the synchronous guard and disables both buttons", () => {
  const settingsSource = readFileSync(
    resolve(root, "src/admin/Settings.jsx"),
    "utf8",
  );

  assert.match(settingsSource, /const submissionGuard = createSubmissionGuard\(\)/);
  assert.match(settingsSource, /submissionGuard\.tryAcquire\(\)/);
  assert.equal(
    (settingsSource.match(/disabled=\{isLocationChangePending\}/g) || []).length,
    2,
  );
  assert.match(settingsSource, /type="button"/);
  assert.match(settingsSource, /isLocationChangePending \? "שומר\.\.\."/);
});
