import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import {
  buildDb04QueryCases,
  structuredQueryFor,
} from "../scripts/db-04-query-matrix.mjs";

const root = resolve(import.meta.dirname, "..");
const indexes = JSON.parse(readFileSync(resolve(root, "firestore.indexes.json"), "utf8"));

const fieldSignature = (field) => (
  `${field.fieldPath}:${field.order || field.arrayConfig}`
);
const indexSignature = (index) => (
  `${index.collectionGroup}|${index.queryScope}|${index.fields.map(fieldSignature).join(",")}`
);

const REQUIRED_COMPOSITE_INDEXES = Object.freeze([
  ["elderly", "status:ASCENDING", "searchPrefixes:CONTAINS"],
  ["volunteerReports", "volunteerAuthUid:ASCENDING", "createdAt:DESCENDING"],
  ["volunteerReports", "volunteerId:ASCENDING", "createdAt:DESCENDING"],
  ["volunteerTasks", "volunteerId:ASCENDING", "createdAt:DESCENDING"],
  ["volunteerTasks", "volunteerAuthUid:ASCENDING", "createdAt:DESCENDING"],
  ["profileUpdateRequests", "volunteerAuthUid:ASCENDING", "createdAt:DESCENDING"],
  ["profileUpdateRequests", "volunteerAuthUid:ASCENDING", "status:ASCENDING", "createdAt:DESCENDING"],
  ["profileUpdateRequests", "status:ASCENDING", "createdAt:DESCENDING"],
  ["volunteerNotifications", "volunteerAuthUid:ASCENDING", "createdAt:DESCENDING"],
]);
const DB04_ADDITIONS = Object.freeze([
  ["volunteerReports", "volunteerId:ASCENDING", "createdAt:DESCENDING"],
  ["profileUpdateRequests", "volunteerAuthUid:ASCENDING", "createdAt:DESCENDING"],
  ["volunteerNotifications", "volunteerAuthUid:ASCENDING", "createdAt:DESCENDING"],
]);

test("DB-04 query catalog covers all UI filter combinations and operational queries", () => {
  const cases = buildDb04QueryCases("demo-db04");
  const elderlyMatrix = cases.filter((item) => item.name.startsWith("elderly:"))
    .filter((item) => !item.name.endsWith("-count") && item.name !== "elderly:volId-in");
  const volunteerMatrix = cases.filter((item) => item.name.startsWith("volunteers:"));
  assert.equal(elderlyMatrix.length, 32);
  assert.equal(volunteerMatrix.length, 32);
  assert.equal(cases.length, 82);

  const checks = cases.reduce(
    (total, item) => total + Number(Boolean(item.page))
      + Number(Boolean(item.pagination)) + Number(Boolean(item.count)),
    0,
  );
  assert.equal(checks, 216);
  for (const item of elderlyMatrix) {
    assert.ok(item.filters.some((filter) => (
      filter.fieldFilter?.field?.fieldPath === "status"
    )), `${item.name} must preserve the mandatory active-status filter`);
  }
  assert.ok(cases.some((item) => item.name === "volunteerReports:volunteerId+createdAt-desc"));
  assert.ok(cases.some((item) => item.name === "profileUpdateRequests:volunteerAuthUid+createdAt-desc"));
  assert.ok(cases.some((item) => item.name === "profileUpdateRequests:status+createdAt-desc"));
  assert.ok(cases.some((item) => item.name === "profileUpdateRequests:volunteerAuthUid+status+createdAt-desc"));
  assert.ok(cases.some((item) => item.name === "volunteerNotifications:volunteerAuthUid+createdAt-desc"));
});

test("firestore.indexes.json contains exactly the nine proven composite indexes without duplicates", () => {
  const actual = indexes.indexes.map(indexSignature);
  assert.equal(new Set(actual).size, actual.length, "duplicate composite index definition");
  assert.equal(actual.length, REQUIRED_COMPOSITE_INDEXES.length);
  for (const [collectionGroup, ...fields] of REQUIRED_COMPOSITE_INDEXES) {
    const expected = `${collectionGroup}|COLLECTION|${fields.join(",")}`;
    assert.ok(actual.includes(expected), `missing ${expected}`);
  }
});

test("the three DB-04 additions are necessary and were absent from the previous local set", () => {
  const previous = indexes.indexes.filter((index) => ![
    "volunteerReports|volunteerId:ASCENDING,createdAt:DESCENDING",
    "profileUpdateRequests|volunteerAuthUid:ASCENDING,createdAt:DESCENDING",
    "volunteerNotifications|volunteerAuthUid:ASCENDING,createdAt:DESCENDING",
  ].includes(
    `${index.collectionGroup}|${index.fields.map(fieldSignature).join(",")}`,
  ));
  const previousSignatures = previous.map(indexSignature);
  for (const [collectionGroup, ...fields] of DB04_ADDITIONS) {
    const expected = `${collectionGroup}|COLLECTION|${fields.join(",")}`;
    assert.ok(!previousSignatures.includes(expected), `fixture unexpectedly covers ${expected}`);
  }
});

test("index deployment configuration preserves operational TTL policies", () => {
  assert.deepEqual(
    indexes.fieldOverrides.map((override) => (
      `${override.collectionGroup}|${override.fieldPath}|${override.ttl}`
    )).sort(),
    [
      "joinRequestDuplicates|expiresAt|true",
      "joinRequestIdempotency|expiresAt|true",
      "joinRequestRateLimits|expiresAt|true",
      "profileUpdateRequests|expiresAt|true",
    ],
  );
  for (const override of indexes.fieldOverrides) {
    const expectedIndexes = override.collectionGroup === "profileUpdateRequests"
      ? ["ASCENDING", "DESCENDING"]
      : ["ASCENDING", "DESCENDING", "CONTAINS"];
    assert.deepEqual(
      override.indexes.map((entry) => entry.order || entry.arrayConfig),
      expectedIndexes,
    );
    assert.ok(override.indexes.every((entry) => entry.queryScope === "COLLECTION"));
  }
});

test("cursor and count variants preserve the same filters", () => {
  const cases = buildDb04QueryCases("demo-db04");
  for (const item of cases.filter((entry) => entry.pagination && entry.count)) {
    const page = structuredQueryFor(item, { projectId: "demo-db04" });
    const cursor = structuredQueryFor(item, {
      cursor: true,
      projectId: "demo-db04",
    });
    const count = structuredQueryFor(item, {
      count: true,
      projectId: "demo-db04",
    });
    assert.deepEqual(cursor.where, page.where, `${item.name} cursor changed filters`);
    assert.deepEqual(count.where, page.where, `${item.name} count changed filters`);
    assert.ok(cursor.startAt, `${item.name} has no cursor`);
    assert.equal(count.limit, undefined);
  }
});
