import { pathToFileURL } from "node:url";

const OPTIONAL_ELDERLY_FILTERS = Object.freeze([
  ["area", "EQUAL"],
  ["neighborhood", "EQUAL"],
  ["marital", "EQUAL"],
  ["volStatus", "EQUAL"],
  ["searchPrefixes", "ARRAY_CONTAINS"],
]);

const OPTIONAL_VOLUNTEER_FILTERS = Object.freeze([
  ["area", "EQUAL"],
  ["neighborhood", "EQUAL"],
  ["status", "EQUAL"],
  ["insuranceKey", "EQUAL"],
  ["searchPrefixes", "ARRAY_CONTAINS"],
]);

const valueFor = (fieldPath) => (
  fieldPath === "searchPrefixes"
    ? { stringValue: "__db04_search_prefix__" }
    : { stringValue: `__db04_${fieldPath}__` }
);

const fieldFilter = (fieldPath, op = "EQUAL", value = valueFor(fieldPath)) => ({
  fieldFilter: {
    field: { fieldPath },
    op,
    value,
  },
});

function allSubsets(definitions, { includeEmpty = true } = {}) {
  const subsets = [];
  for (let mask = 0; mask < (1 << definitions.length); mask += 1) {
    if (!includeEmpty && mask === 0) continue;
    subsets.push(definitions.filter((_, index) => mask & (1 << index)));
  }
  return subsets;
}

function matrixCases() {
  const elderly = allSubsets(OPTIONAL_ELDERLY_FILTERS).map((subset) => ({
    name: `elderly:${subset.map(([field]) => field).join("+") || "status-only"}`,
    collectionId: "elderly",
    filters: [
      fieldFilter("status", "EQUAL", { stringValue: "__db04_active__" }),
      ...subset.map(([field, op]) => fieldFilter(field, op)),
    ],
    page: true,
    count: true,
    pagination: true,
  }));

  const volunteers = allSubsets(OPTIONAL_VOLUNTEER_FILTERS).map((subset) => ({
    name: `volunteers:${subset.map(([field]) => field).join("+") || "unfiltered"}`,
    collectionId: "volunteers",
    filters: subset.map(([field, op]) => fieldFilter(field, op)),
    orderBy: subset.length === 0
      ? [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }]
      : [],
    page: true,
    count: true,
    pagination: true,
  }));

  return [...elderly, ...volunteers];
}

function staticCases(projectId) {
  const ref = (path) => ({
    referenceValue: `projects/${projectId}/databases/(default)/documents/${path}`,
  });
  const equalityAndCreatedAt = [
    ["volunteerReports", "volunteerId"],
    ["volunteerReports", "volunteerAuthUid"],
    ["volunteerTasks", "volunteerId"],
    ["volunteerTasks", "volunteerAuthUid"],
    ["profileUpdateRequests", "volunteerAuthUid"],
    ["volunteerNotifications", "volunteerAuthUid"],
  ].map(([collectionId, field]) => ({
    name: `${collectionId}:${field}+createdAt-desc`,
    collectionId,
    filters: [fieldFilter(field)],
    orderBy: [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }],
    page: true,
  }));

  return [
    ...equalityAndCreatedAt,
    {
      name: "volunteerNotifications:volunteerAuthUid+read",
      collectionId: "volunteerNotifications",
      filters: [
        fieldFilter("volunteerAuthUid"),
        fieldFilter("read", "EQUAL", { booleanValue: false }),
      ],
      page: true,
    },
    {
      name: "elderlyContactLinks:contactId+elderlyId",
      collectionId: "elderlyContactLinks",
      filters: [fieldFilter("contactId"), fieldFilter("elderlyId")],
      page: true,
    },
    {
      name: "login_sessions:userId+isActive",
      collectionId: "login_sessions",
      filters: [
        fieldFilter("userId"),
        fieldFilter("isActive", "EQUAL", { booleanValue: true }),
      ],
      page: true,
    },
    {
      name: "elderly:status+volStatus-count",
      collectionId: "elderly",
      filters: [fieldFilter("status"), fieldFilter("volStatus")],
      count: true,
    },
    {
      name: "elderly:status+searchSchemaVersion-count",
      collectionId: "elderly",
      filters: [
        fieldFilter("status"),
        fieldFilter("searchSchemaVersion", "EQUAL", { integerValue: "1" }),
      ],
      count: true,
    },
    {
      name: "elderly:volId-in",
      collectionId: "elderly",
      filters: [{
        fieldFilter: {
          field: { fieldPath: "volId" },
          op: "IN",
          value: { arrayValue: { values: [{ stringValue: "__db04_volunteer__" }] } },
        },
      }],
      page: true,
    },
    {
      name: "volunteerReports:auth-page",
      collectionId: "volunteerReports",
      filters: [fieldFilter("volunteerAuthUid")],
      page: true,
      count: true,
      pagination: true,
    },
    {
      name: "volunteerTasks:volunteer-page",
      collectionId: "volunteerTasks",
      filters: [fieldFilter("volunteerId")],
      page: true,
      count: true,
      pagination: true,
    },
    {
      name: "volunteerTasks:auth-page",
      collectionId: "volunteerTasks",
      filters: [fieldFilter("volunteerAuthUid")],
      page: true,
      count: true,
      pagination: true,
    },
    {
      name: "projectGroups:project-descendants",
      collectionId: "projectGroups",
      allDescendants: true,
      filters: [
        fieldFilter("__name__", "GREATER_THAN_OR_EQUAL", ref("projects/\u0000/projectGroups/\u0000")),
        fieldFilter("__name__", "LESS_THAN_OR_EQUAL", ref("projects/\uf8ff/projectGroups/\uf8ff")),
      ],
      page: true,
    },
    {
      name: "participants:parliament-descendants",
      collectionId: "participants",
      allDescendants: true,
      filters: [
        fieldFilter("__name__", "GREATER_THAN_OR_EQUAL", ref("parliaments/\u0000/participants/\u0000")),
        fieldFilter("__name__", "LESS_THAN_OR_EQUAL", ref("parliaments/\uf8ff/participants/\uf8ff")),
      ],
      page: true,
    },
  ];
}

export function buildDb04QueryCases(projectId = "demo-db04") {
  return [...matrixCases(), ...staticCases(projectId)];
}

function whereClause(filters) {
  if (!filters?.length) return undefined;
  if (filters.length === 1) return filters[0];
  return { compositeFilter: { op: "AND", filters } };
}

export function structuredQueryFor(testCase, { cursor = false, count = false, projectId } = {}) {
  const query = {
    from: [{
      collectionId: testCase.collectionId,
      ...(testCase.allDescendants ? { allDescendants: true } : {}),
    }],
  };
  const where = whereClause(testCase.filters);
  if (where) query.where = where;
  if (!count) {
    query.orderBy = testCase.orderBy?.length
      ? testCase.orderBy
      : [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }];
    query.limit = 1;
    if (cursor) {
      const firstOrderField = query.orderBy[0]?.field?.fieldPath;
      query.startAt = {
        before: false,
        values: firstOrderField === "createdAt"
          ? [{ timestampValue: "9999-01-01T00:00:00.000Z" }]
          : [{
            referenceValue: `projects/${projectId}/databases/(default)/documents/`
              + `${testCase.collectionId}/db04_cursor_probe`,
          }],
      };
    }
  }
  return query;
}

async function postJson(url, token, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (response.ok) return;
  const payload = await response.json().catch(() => ({}));
  const details = payload.error || payload[0]?.error || {};
  const error = new Error(details.message || `HTTP ${response.status}`);
  error.code = details.status || `HTTP_${response.status}`;
  throw error;
}

export async function probeDb04Queries({
  projectId = process.env.GCLOUD_PROJECT,
  token = process.env.FIRESTORE_ACCESS_TOKEN,
  apiRoot = "https://firestore.googleapis.com",
} = {}) {
  if (!projectId) throw new Error("GCLOUD_PROJECT is required.");
  if (!token) throw new Error("FIRESTORE_ACCESS_TOKEN is required.");
  const base = `${apiRoot}/v1/projects/${projectId}`
    + "/databases/(default)/documents";
  const failures = [];
  let checks = 0;
  for (const testCase of buildDb04QueryCases(projectId)) {
    const variants = [];
    if (testCase.page) variants.push(["page", false, false]);
    if (testCase.pagination) variants.push(["pagination", true, false]);
    if (testCase.count) variants.push(["count", false, true]);
    for (const [variant, cursor, count] of variants) {
      checks += 1;
      const structuredQuery = structuredQueryFor(testCase, {
        cursor,
        count,
        projectId,
      });
      const url = count ? `${base}:runAggregationQuery` : `${base}:runQuery`;
      const body = count
        ? {
          structuredAggregationQuery: {
            structuredQuery,
            aggregations: [{ alias: "db04_count", count: {} }],
          },
        }
        : { structuredQuery };
      try {
        // Intentionally sequential to avoid a burst of production reads.
        // eslint-disable-next-line no-await-in-loop
        await postJson(url, token, body);
      } catch (error) {
        failures.push({
          case: testCase.name,
          variant,
          code: error.code,
          requiresIndex: /requires an index|FAILED_PRECONDITION/i.test(
            `${error.code} ${error.message}`,
          ),
          message: String(error.message).replace(/https:\/\/\S+/g, "[index-link]"),
        });
      }
    }
  }
  const result = {
    targetProject: projectId,
    mode: apiRoot.startsWith("http://") ? "emulator-read-only" : "production-read-only",
    queryCases: buildDb04QueryCases(projectId).length,
    checks,
    failures,
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

export const probeDb04Production = probeDb04Queries;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  probeDb04Queries().then((result) => {
    if (result.failures.length) process.exitCode = 2;
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
