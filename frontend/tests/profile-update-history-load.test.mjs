import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const profile = readFileSync(
  new URL("../src/volunteer/VolunteerProfile.jsx", import.meta.url),
  "utf8",
);
const service = readFileSync(
  new URL("../src/services/profileUpdateRequestsService.js", import.meta.url),
  "utf8",
);
const indexes = JSON.parse(readFileSync(
  new URL("../firestore.indexes.json", import.meta.url),
  "utf8",
));

test("history page and pending-state check cannot fail as one combined promise", () => {
  assert.match(profile, /Promise\.allSettled\(\[/);
  assert.match(profile, /pageResult\.status === "rejected"/);
  assert.match(profile, /pendingResult\.status === "rejected"/);
  assert.doesNotMatch(
    profile,
    /const \[page, pending\] = await Promise\.all\(/,
  );
});

test("a failed pending check blocks new submissions but does not hide loaded history", () => {
  assert.match(profile, /setPendingCheckError\(/);
  assert.match(
    profile,
    /disabled=\{pendingCheckLoading \|\| !!pendingRequest \|\| !!pendingCheckError\}/,
  );
  assert.match(profile, /setRequests\(\(current\) => reset \? page\.items/);
});

test("volunteer history keeps bounded cursor pagination and its required index", () => {
  assert.match(
    service,
    /getProfileUpdateRequestsPageForVolunteer[\s\S]*where\("volunteerAuthUid", "==", volunteerAuthUid\)[\s\S]*orderBy\("createdAt", "desc"\)/,
  );
  assert.match(service, /startAfter\(cursor\)/);
  assert.match(service, /fbLimit\(safePageSize \+ 1\)/);

  const signature = indexes.indexes.map((index) => (
    `${index.collectionGroup}|${index.fields.map((field) => (
      `${field.fieldPath}:${field.order || field.arrayConfig}`
    )).join(",")}`
  ));
  assert.ok(signature.includes(
    "profileUpdateRequests|volunteerAuthUid:ASCENDING,createdAt:DESCENDING",
  ));
});
