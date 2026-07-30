import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboard = readFileSync(
  new URL("../src/admin/Dashboard.jsx", import.meta.url),
  "utf8",
);
const requestsPage = readFileSync(
  new URL("../src/admin/ProfileUpdateRequests.jsx", import.meta.url),
  "utf8",
);
const modal = readFileSync(
  new URL("../src/components/admin/ProfileUpdateRequestModal.jsx", import.meta.url),
  "utf8",
);

test("dashboard opens profile update requests in-place instead of navigating", () => {
  assert.match(dashboard, /onOpen=\{setSelectedProfileRequest\}/);
  assert.match(dashboard, /selectedProfileRequest && \(\s*<ProfileUpdateRequestModal/);
  assert.doesNotMatch(dashboard, /profile-update-requests\?id=/);
});

test("standalone requests page remains available and uses the shared modal", () => {
  assert.match(requestsPage, /<AdminLayout title=/);
  assert.match(requestsPage, /<ProfileUpdateRequestModal/);
  assert.match(requestsPage, /useSearchParams/);
});

test("shared modal preserves the current decision flow and responsive RTL behavior", () => {
  assert.match(modal, /decideProfileUpdateRequest\(\{/);
  assert.match(modal, /decision,\s*response,/);
  assert.match(modal, /direction: "rtl"/);
  assert.match(modal, /maxWidth: "100%"/);
  assert.match(modal, /maxHeight: "calc\(100dvh - 32px\)"/);
  assert.match(modal, /document\.body\.style\.overflow = "hidden"/);
  assert.match(modal, /role="dialog"/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /decide\("rejected"\)/);
  assert.match(modal, /decide\("approved"\)/);
});
