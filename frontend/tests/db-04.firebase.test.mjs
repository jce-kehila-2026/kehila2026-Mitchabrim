import assert from "node:assert/strict";
import {
  buildDb04QueryCases,
  probeDb04Queries,
  structuredQueryFor,
} from "../scripts/db-04-query-matrix.mjs";

const projectId = process.env.GCLOUD_PROJECT || "demo-db04";
const apiRoot = `http://${process.env.FIRESTORE_EMULATOR_HOST}`;
const documentsRoot = `${apiRoot}/v1/projects/${projectId}/databases/(default)/documents`;
const headers = {
  Authorization: "Bearer owner",
  "Content-Type": "application/json",
};

const string = (stringValue) => ({ stringValue });
const timestamp = (timestampValue = "2026-07-26T00:00:00.000Z") => ({ timestampValue });

async function seed(path, fields) {
  const response = await fetch(`${documentsRoot}/${path}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ fields }),
  });
  assert.equal(response.ok, true, `seed failed for ${path}: ${response.status}`);
}

await seed("elderly/match_elderly", {
  status: string("__db04_active__"),
  area: string("__db04_area__"),
  neighborhood: string("__db04_neighborhood__"),
  marital: string("__db04_marital__"),
  volStatus: string("__db04_volStatus__"),
  searchPrefixes: { arrayValue: { values: [string("__db04_search_prefix__")] } },
  volId: string("__db04_volunteer__"),
  searchSchemaVersion: { integerValue: "1" },
  createdAt: timestamp(),
});
await seed("volunteers/match_volunteer", {
  area: string("__db04_area__"),
  neighborhood: string("__db04_neighborhood__"),
  status: string("__db04_status__"),
  insuranceKey: string("__db04_insuranceKey__"),
  searchPrefixes: { arrayValue: { values: [string("__db04_search_prefix__")] } },
  createdAt: timestamp(),
});
await seed("volunteerReports/match_report", {
  volunteerId: string("__db04_volunteerId__"),
  volunteerAuthUid: string("__db04_volunteerAuthUid__"),
  createdAt: timestamp(),
});
await seed("volunteerTasks/match_task", {
  volunteerId: string("__db04_volunteerId__"),
  volunteerAuthUid: string("__db04_volunteerAuthUid__"),
  createdAt: timestamp(),
});
await seed("profileUpdateRequests/match_request", {
  volunteerAuthUid: string("__db04_volunteerAuthUid__"),
  createdAt: timestamp(),
});
await seed("volunteerNotifications/match_notification", {
  volunteerAuthUid: string("__db04_volunteerAuthUid__"),
  read: { booleanValue: false },
  createdAt: timestamp(),
});
await seed("elderlyContactLinks/match_link", {
  contactId: string("__db04_contactId__"),
  elderlyId: string("__db04_elderlyId__"),
});
await seed("login_sessions/match_session", {
  userId: string("__db04_userId__"),
  isActive: { booleanValue: true },
});
await seed("projects/project_a/projectGroups/group_a", {
  createdAt: timestamp(),
});
await seed("parliaments/parliament_a/participants/participant_a", {
  createdAt: timestamp(),
});

const result = await probeDb04Queries({
  projectId,
  token: "owner",
  apiRoot,
});
assert.equal(result.queryCases, 81);
assert.equal(result.checks, 215);
assert.deepEqual(result.failures, []);

async function runQuery(testCase, options = {}) {
  const response = await fetch(`${documentsRoot}:runQuery`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      structuredQuery: structuredQueryFor(testCase, {
        projectId,
        ...options,
      }),
    }),
  });
  assert.equal(response.ok, true, `${testCase.name} query failed: ${response.status}`);
  return response.json();
}

async function runCount(testCase) {
  const response = await fetch(`${documentsRoot}:runAggregationQuery`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      structuredAggregationQuery: {
        structuredQuery: structuredQueryFor(testCase, {
          projectId,
          count: true,
        }),
        aggregations: [{ alias: "db04_count", count: {} }],
      },
    }),
  });
  assert.equal(response.ok, true, `${testCase.name} count failed: ${response.status}`);
  return response.json();
}

const cases = buildDb04QueryCases(projectId);
for (const name of [
  "elderly:area+neighborhood+marital+volStatus+searchPrefixes",
  "volunteers:area+neighborhood+status+insuranceKey+searchPrefixes",
]) {
  const testCase = cases.find((entry) => entry.name === name);
  const page = await runQuery(testCase);
  assert.ok(page.some((entry) => entry.document), `${name} returned no seeded document`);
  await runQuery(testCase, { cursor: true });
  const count = await runCount(testCase);
  assert.equal(
    count[0]?.result?.aggregateFields?.db04_count?.integerValue,
    "1",
    `${name} count did not use the same constraints`,
  );
}

console.log(
  "DB-04 Emulator: all supported filter combinations, search, count, and "
  + "cursor variants executed without FAILED_PRECONDITION or index errors.",
);
