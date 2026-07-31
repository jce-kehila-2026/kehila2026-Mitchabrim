import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  loadInitialVolunteerTasks,
  mergeUniqueNewestFirst,
  sortNewestFirst,
} from "../src/utils/perf02Records.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [
  elderlyPage,
  volunteersPage,
  dashboard,
  reportsHistory,
  volunteerTasks,
  elderlyService,
  volunteersService,
  reportsService,
  tasksService,
  joinRequestsService,
  paginationHook,
  indexes,
] = await Promise.all([
  read("src/admin/Elderly.jsx"),
  read("src/admin/Volunteers.jsx"),
  read("src/admin/Dashboard.jsx"),
  read("src/volunteer/VolunteerReportsHistory.jsx"),
  read("src/volunteer/VolunteerTasks.jsx"),
  read("src/services/elderlyService.js"),
  read("src/services/volunteersService.js"),
  read("src/services/reportsService.js"),
  read("src/services/tasksService.js"),
  read("src/services/joinRequestsService.js"),
  read("src/hooks/useFirestorePagination.js"),
  read("firestore.indexes.json"),
]);

// Normal admin list views must use bounded Firestore cursor queries.
assert.match(elderlyPage, /getElderlyPage\(\{ pageSize: PAGE_SIZE, cursor, criteria: queryCriteria \}\)/);
assert.match(volunteersPage, /getVolunteersPage\(\{ pageSize: PAGE_SIZE, cursor, criteria: queryCriteria \}\)/);
for (const service of [elderlyService, volunteersService]) {
  assert.match(service, /limit\(pageSize \+ 1\)/);
  assert.match(service, /startAfter\(cursor\)/);
  assert.match(service, /getCountFromServer/);
}

// Full collection reads are explicit-action caches, never automatic mount work.
assert.match(elderlyPage, /if \(fullDataCacheRef\.current\) return fullDataCacheRef\.current/);
assert.match(elderlyPage, /if \(fullDataRequestRef\.current\) return fullDataRequestRef\.current/);
assert.match(volunteersPage, /if \(fullVolunteers\) return \{ vols: fullVolunteers \}/);
assert.match(volunteersPage, /if \(fullRequestRef\.current\) return fullRequestRef\.current/);
assert.match(volunteersPage, /const \[showCharts, setShowCharts\] = useState\(false\)/);
assert.doesNotMatch(elderlyPage, /useEffect\([\s\S]{0,300}ensureFullData\(\)/);
assert.doesNotMatch(volunteersPage, /useEffect\([\s\S]{0,300}ensureFull\(\)/);

// Invalidated or unmounted requests must not repopulate stale caches/state.
for (const page of [elderlyPage, volunteersPage]) {
  assert.match(page, /useEffect\(\(\) => \{\s*mountedRef\.current = true/);
  assert.match(page, /mountedRef\.current = false/);
}
assert.match(elderlyPage, /fullDataVersionRef\.current \+= 1/);
assert.match(elderlyPage, /version === fullDataVersionRef\.current/);
assert.match(volunteersPage, /fullRequestVersionRef\.current \+= 1/);
assert.match(volunteersPage, /version === fullRequestVersionRef\.current/);
assert.match(volunteersPage, /invalidateFullCache\(\)/);
assert.match(paginationHook, /return \(\) => \{\s*requestVersion\.current \+= 1/);

// Chart/print behavior: close immediately, open only after the shared request,
// and keep a failed request retryable instead of silently opening empty UI.
assert.match(elderlyPage, /const handleToggleCharts = async \(\) => \{[\s\S]*if \(showCharts\)[\s\S]*setShowCharts\(false\)[\s\S]*await ensureFullData\(\)[\s\S]*setShowCharts\(true\)/);
assert.match(volunteersPage, /const handleToggleCharts = async \(\) => \{[\s\S]*if \(showCharts\)[\s\S]*setShowCharts\(false\)[\s\S]*await ensureFull\(\)[\s\S]*setShowCharts\(true\)/);
assert.match(elderlyPage, /const handleOpenPrint = async \(\) => \{[\s\S]*await ensureFullData\(\);\s*setShowPrint\(true\)/);
assert.match(volunteersPage, /const handleOpenPrint = async \(\) => \{[\s\S]*await ensureFull\(\);\s*setShowPrint\(true\)/);
assert.match(elderlyPage, /if \(fullDataRequestRef\.current === request\) fullDataRequestRef\.current = null/);
assert.match(volunteersPage, /if \(fullRequestRef\.current === request\) fullRequestRef\.current = null/);
assert.match(elderlyPage, /\.catch\(\(err\) => \{[\s\S]{0,500}throw err/);
assert.match(volunteersPage, /\.catch\(\(err\) => \{[\s\S]{0,500}throw err/);

// Dashboard uses counts and a bounded recent-requests list.
assert.match(dashboard, /getElderlyCount\(\)/);
assert.match(dashboard, /getVolunteersCount\(\)/);
assert.match(dashboard, /getJoinRequestsCount\(\)/);
assert.match(dashboard, /getRecentJoinRequests\(50\)/);
assert.match(dashboard, /if \(cancelled\) return/);
assert.match(joinRequestsService, /limit\(Math\.max\(1, max\)\)/);
assert.match(joinRequestsService, /getCountFromServer/);

// Volunteer history/tasks load 20+1 pages, expose load-more, and reject stale
// load-more responses after identity changes or unmount.
assert.match(reportsHistory, /getReportsForAuthUidPage\(\{ authUid: user\.uid, pageSize: 20 \}\)/);
assert.match(reportsHistory, /const loadMore = async/);
assert.match(reportsHistory, /version !== requestVersion\.current/);
assert.match(volunteerTasks, /loadInitialVolunteerTasks\(\{/);
assert.match(volunteerTasks, /getVolunteerPage: getTasksForVolunteerPage/);
assert.match(volunteerTasks, /getAuthPage: getTasksForAuthUidPage/);
assert.match(volunteerTasks, /queryMode === "volunteerId"[\s\S]*getTasksForVolunteerPage[\s\S]*getTasksForAuthUidPage/);
assert.match(volunteerTasks, /const loadMore = async/);
assert.match(volunteerTasks, /version !== requestVersion\.current/);
for (const service of [reportsService, tasksService]) {
  assert.match(service, /limit\(pageSize \+ 1\)/);
  assert.match(service, /startAfter\(cursor\)/);
  assert.match(service, /getCountFromServer/);
  assert.match(service, /orderBy\(documentId\(\)\)/);
}

// Identity fallback, consistent source selection, legacy timestamps, and
// duplicate-free load-more behavior are exercised without Firebase writes.
const volunteerPage = async () => ({
  items: [{ id: "task-v", createdAt: { seconds: 3 } }],
  lastVisible: "cursor-v",
  hasNextPage: true,
});
let authPageCalls = 0;
const authPage = async () => {
  authPageCalls += 1;
  return {
    items: [{ id: "task-a", createdAt: null }],
    lastVisible: "cursor-a",
    hasNextPage: false,
  };
};
const byVolunteer = await loadInitialVolunteerTasks({
  volunteerId: "vol-1",
  authUid: "auth-1",
  getVolunteerPage: volunteerPage,
  getVolunteerCount: async () => 1,
  getAuthPage: authPage,
  getAuthCount: async () => 9,
});
assert.equal(byVolunteer.mode, "volunteerId");
assert.equal(byVolunteer.count, 1);
assert.equal(authPageCalls, 0);

const byAuth = await loadInitialVolunteerTasks({
  volunteerId: "vol-1",
  authUid: "auth-1",
  getVolunteerPage: async () => ({
    items: [],
    lastVisible: null,
    hasNextPage: false,
  }),
  getVolunteerCount: async () => 0,
  getAuthPage: authPage,
  getAuthCount: async () => 1,
});
assert.equal(byAuth.mode, "authUid");
assert.equal(byAuth.count, 1);
assert.deepEqual(byAuth.pageResult.items.map((item) => item.id), ["task-a"]);

await assert.rejects(() => loadInitialVolunteerTasks({
  volunteerId: "vol-1",
  authUid: "auth-1",
  getVolunteerPage: async () => { throw new Error("permission-denied"); },
  getVolunteerCount: async () => 0,
  getAuthPage: authPage,
  getAuthCount: async () => 1,
}), /permission-denied/);

assert.deepEqual(
  mergeUniqueNewestFirst(
    [{ id: "old", createdAt: null }, { id: "same", createdAt: { seconds: 1 } }],
    [{ id: "same", createdAt: { seconds: 2 } }, { id: "new", createdAt: { seconds: 3 } }],
  ).map((item) => item.id),
  ["new", "same", "old"],
);
assert.deepEqual(
  sortNewestFirst([{ id: "legacy" }, { id: "dated", createdAt: { seconds: 1 } }])
    .map((item) => item.id),
  ["dated", "legacy"],
);

const parsedPerf02Indexes = JSON.parse(indexes);
const hasIndex = (collectionGroup, identityField) =>
  parsedPerf02Indexes.indexes.some((index) =>
    index.collectionGroup === collectionGroup &&
    index.fields.some((field) => field.fieldPath === identityField && field.order === "ASCENDING") &&
    index.fields.some((field) => field.fieldPath === "createdAt" && field.order === "DESCENDING"));
assert.ok(hasIndex("volunteerReports", "volunteerAuthUid"));
assert.ok(hasIndex("volunteerTasks", "volunteerId"));
assert.ok(hasIndex("volunteerTasks", "volunteerAuthUid"));

console.log("PERF-02 regression checks passed.");
