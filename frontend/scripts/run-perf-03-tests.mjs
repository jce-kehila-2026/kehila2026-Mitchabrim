import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [
  adminNotifications,
  volunteerNotifications,
  financialService,
  financialPage,
  adminTopbar,
  heroTopbar,
  volunteerHeader,
  projectsService,
  projectsPage,
  parliamentsService,
  parliamentsPage,
  reportsPage,
] = await Promise.all([
  read("src/services/notificationsService.js"),
  read("src/services/volunteerNotificationsService.js"),
  read("src/services/financialService.js"),
  read("src/admin/Financial.jsx"),
  read("src/components/admin/AdminTopbar.jsx"),
  read("src/components/admin/HeroTopbar.jsx"),
  read("src/components/volunteer/VolunteerHeader.jsx"),
  read("src/services/projectsService.js"),
  read("src/admin/Projects.jsx"),
  read("src/services/parliamentsService.js"),
  read("src/admin/Parliaments.jsx"),
  read("src/admin/Reports.jsx"),
]);

assert.match(adminNotifications, /fbLimit\(max\)/);
assert.match(adminNotifications, /where\("read", "==", false\)/);
assert.match(adminNotifications, /unsubscribeRecent\(\)[\s\S]*unsubscribeUnread\(\)/);
assert.doesNotMatch(adminNotifications, /pruneAdminNotifications|deleteDoc|getDocs/);

assert.match(volunteerNotifications, /fbLimit\(maxRecent\)/);
assert.match(volunteerNotifications, /where\("volunteerAuthUid", "==", volunteerAuthUid\)/);
assert.match(volunteerNotifications, /where\("read", "==", false\)/);
assert.match(volunteerNotifications, /unsubscribeRecent\(\)[\s\S]*unsubscribeUnread\(\)/);

assert.doesNotMatch(financialService, /onSnapshot|subscribeFinancialTransactions/);
assert.match(financialService, /getFinancialTransactions/);
assert.match(financialPage, /createAndStoreTransaction/);
assert.match(financialPage, /updateAndStoreTransaction/);
assert.match(financialPage, /deleteAndStoreTransaction/);
assert.doesNotMatch(financialPage, /refreshTransactions/);

for (const component of [adminTopbar, heroTopbar, volunteerHeader]) {
  assert.match(component, /return \(\) => unsub\(\)/);
  assert.match(component, /meta\?\.unreadCount/);
}

assert.match(projectsService, /getElderlyParticipantsByProject[\s\S]*projectChildrenQuery\("elderlyParticipants"\)/);
assert.match(projectsService, /getProjectGroupsByProject[\s\S]*projectChildrenQuery\("projectGroups"\)/);
assert.match(projectsService, /where\(documentId\(\), ">=", doc\(db, "projects"/);
assert.match(projectsPage, /getElderlyParticipantsByProject\(\)/);
assert.doesNotMatch(projectsPage, /list\.map\(async \(p\).*getElderlyParticipants/s);

assert.match(parliamentsService, /getParticipantsByParliament[\s\S]*parliamentChildrenQuery\("participants"\)/);
assert.match(parliamentsService, /getMeetingsByParliament[\s\S]*parliamentChildrenQuery\("meetings"\)/);
assert.match(parliamentsService, /getMeetingAggregates[\s\S]*descendantsOfParliamentQuery\(parliamentId, "attendance"\)/);
assert.match(parliamentsService, /where\(documentId\(\), ">=", doc\(db, "parliaments"/);
assert.match(parliamentsPage, /getParticipantsByParliament\(\)/);
assert.match(parliamentsPage, /getMeetingsByParliament\(\)/);
assert.match(parliamentsPage, /getMeetingAggregates\(parl\.id\)/);
assert.doesNotMatch(parliamentsPage, /\(list \|\| \[\]\)\.map\(async \(p\)/);
assert.doesNotMatch(parliamentsPage, /list\.map\(async \(m\)/);
assert.match(parliamentsPage, /requestId !== aggregateRequestRef\.current/);

assert.match(reportsPage, /getProjectGroupsByProject\(\)/);
assert.doesNotMatch(reportsPage, /projs\.map\(async \(p\)/);
assert.doesNotMatch(reportsPage, /getProjectGroups\(p\.id\)/);

console.log("PERF-03 regression checks passed.");
