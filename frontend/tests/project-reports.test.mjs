import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildProjectReports,
  filterProjectReports,
  INDEPENDENT_GROUP_VALUE,
  projectPrintSections,
  sortProjectReportsChronologically,
} from "../src/utils/projectReportModel.js";
import { openSafePrintReport } from "../src/utils/safePrint.js";
import {
  neighborhoodNoteEntries,
  participantStats,
} from "../src/utils/projectParticipantStats.js";

const baseData = () => ({
  projects: [
    { id: "p1", name: "פרויקט א", type: "חלוקה", year: 2026, status: "פעיל" },
    { id: "p2", name: "פרויקט ב", year: 2025, status: "הסתיים" },
    { id: "p3", name: "פרויקט ריק", year: 2026, status: "פעיל" },
  ],
  participantsByProject: {
    p1: [
      { id: "e1", elderlyId: "e1", receives: "כן", delivery: "נמסר", assignedGroupId: "g1" },
      { id: "duplicate", elderlyId: "e1", receives: "כן" },
      { id: "e2", elderlyId: "e2", receives: "לא", delivery: "לא נמסר", assignedVolunteerId: "v2" },
    ],
    p2: [{ id: "e3", elderlyId: "e3", receives: "כן", delivery: "ממתין למסירה" }],
  },
  groupsByProject: {
    p1: [{ id: "g1", volunteerIds: ["v1", "v1", "missing"] }],
    p2: [{ id: "g2", volunteerIds: [] }],
  },
  elderly: [
    {
      id: "e1",
      firstName: "שרה",
      lastName: "כהן",
      mobile: "0501",
      neighborhood: "מרכז",
      volId: "v3",
      volName: "מתנדבת קבועה",
    },
    { id: "e2", firstName: "דוד", lastName: "לוי", address: "<img onerror=alert(1)>" },
    { id: "e3", firstName: "רחל", lastName: "אברהם" },
  ],
  groups: [{ id: "g1", name: "קבוצה א" }, { id: "g2", name: "קבוצה ב" }],
  volunteers: [
    { id: "v1", firstName: "מתנדב", lastName: "אחד" },
    { id: "v2", firstName: "מתנדב", lastName: "עצמאי" },
    { id: "v3", firstName: "שם", lastName: "מהמאגר" },
  ],
});

test("project report joins participants, groups and volunteers without duplicates or cross-project leakage", () => {
  const reports = buildProjectReports(baseData());
  const first = reports.find((project) => project.id === "p1");
  assert.equal(first.participants.length, 2);
  assert.equal(first.participants[0].fullName, "שרה כהן");
  assert.equal(first.projectGroups.length, 1);
  assert.equal(first.projectGroups[0].volunteers.length, 1);
  assert.equal(first.projectGroups[0].assignedElderly, 1);
  assert.equal(first.elderly, 2);
  assert.equal(first.packages, 1);
  assert.equal(first.delivered, 1);
  assert.equal(first.notDelivered, 1);
  assert.equal(first.independentCount, 1);
  assert.equal(first.participants[1].assignmentLabel, "עצמאיים");
  assert.equal(first.participants[1].assignedVolunteerName, "מתנדב עצמאי");
  assert.equal(first.participants[0].regularVolunteerId, "v3");
  assert.equal(first.participants[0].regularVolunteer, "מתנדבת קבועה");
  assert.ok(!first.participants.some((participant) => participant.elderlyId === "e3"));
});

test("empty projects and missing relationships remain renderable", () => {
  const reports = buildProjectReports(baseData());
  const empty = reports.find((project) => project.id === "p3");
  assert.deepEqual(empty.participants, []);
  assert.deepEqual(empty.projectGroups, []);
  assert.equal(empty.progress, 0);
  assert.equal(projectPrintSections(empty)[1].rows.length, 0);
});

test("projects with only elderly or only groups are represented independently", () => {
  const data = baseData();
  data.groupsByProject.p1 = [];
  data.participantsByProject.p2 = [];
  const reports = buildProjectReports(data);
  assert.equal(reports.find((project) => project.id === "p1").participants.length, 2);
  assert.equal(reports.find((project) => project.id === "p1").projectGroups.length, 0);
  assert.equal(reports.find((project) => project.id === "p2").participants.length, 0);
  assert.equal(reports.find((project) => project.id === "p2").projectGroups.length, 1);
});

test("large participant collections are aggregated linearly and deduplicated", () => {
  const data = baseData();
  data.projects = [{ id: "large", name: "גדול" }];
  data.participantsByProject = {
    large: Array.from({ length: 1200 }, (_, index) => ({
      id: `e${index}`,
      elderlyId: `e${index}`,
      receives: index % 2 ? "כן" : "לא",
    })),
  };
  data.groupsByProject = {};
  const [report] = buildProjectReports(data);
  assert.equal(report.participants.length, 1200);
  assert.equal(report.packages, 600);
});

test("project filters use expanded group relationships and preserve the current result set", () => {
  const reports = buildProjectReports(baseData());
  assert.deepEqual(
    filterProjectReports(reports, { projectGroup: "group:g1" }).map((item) => item.id),
    ["p1"],
  );
  const independent = filterProjectReports(reports, {
    projectId: "p1",
    projectGroup: INDEPENDENT_GROUP_VALUE,
  });
  assert.equal(independent.length, 1);
  assert.deepEqual(independent[0].participants.map((item) => item.elderlyId), ["e2"]);
  assert.equal(independent[0].delivered, 0);
  assert.deepEqual(
    filterProjectReports(reports, { year: "2026", status: "פעיל" }).map((item) => item.id),
    ["p1", "p3"],
  );
});

test("project chart order is chronological and missing dates are stable at the end", () => {
  const ordered = sortProjectReportsChronologically([
    { id: "new", name: "חדש", date: "2026-04-01" },
    { id: "unknown", name: "ללא תאריך" },
    { id: "old", name: "ישן", year: 2022 },
    { id: "middle", name: "אמצע", startDate: "2024-03-02" },
  ]);
  assert.deepEqual(ordered.map((item) => item.id), ["old", "middle", "new", "unknown"]);
});

test("group filtering keeps only residents assigned to that exact project group", () => {
  const [report] = buildProjectReports(baseData());
  const [filtered] = filterProjectReports([report], { projectGroup: "group:g1" });
  assert.deepEqual(filtered.participants.map((item) => item.elderlyId), ["e1"]);
  assert.equal(filtered.delivered, 1);
  assert.equal(filtered.projectGroups.length, 1);
});

class FakeNode {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.textContent = "";
    this.className = "";
  }
  appendChild(child) { this.children.push(child); return child; }
}

test("safe printing treats hostile Firestore values as text and supports repeated previews", () => {
  const created = [];
  const windows = [];
  const windowObject = {
    open() {
      const document = {
        documentElement: {},
        title: "",
        head: new FakeNode("head"),
        body: new FakeNode("body"),
        createElement(tag) {
          const node = new FakeNode(tag);
          created.push(node);
          return node;
        },
      };
      const opened = { document, focus() {}, printCalls: 0, print() { this.printCalls += 1; } };
      windows.push(opened);
      return opened;
    },
    setTimeout(callback) { callback(); },
  };
  const malicious = "<img src=x onerror=alert(1)><script>alert(2)</script>";
  const spec = {
    title: malicious,
    sections: [{ title: "rows", columns: [["name", "שם"]], rows: [{ name: malicious }] }],
    windowObject,
  };
  assert.equal(openSafePrintReport(spec), true);
  assert.equal(openSafePrintReport(spec), true);
  assert.equal(windows.length, 2);
  assert.equal(windows.every((item) => item.printCalls === 1), true);
  assert.ok(created.some((node) => node.textContent === malicious));
  assert.equal(created.some((node) => node.tag === "script" || node.tag === "img"), false);
});

test("project UI routes every project print action through the safe printer", () => {
  const root = resolve(import.meta.dirname, "..");
  const projectsSource = readFileSync(resolve(root, "src/admin/Projects.jsx"), "utf8");
  const reportsSource = readFileSync(resolve(root, "src/admin/Reports.jsx"), "utf8");
  const modelSource = readFileSync(resolve(root, "src/utils/projectReportModel.js"), "utf8");
  const rulesSource = readFileSync(resolve(root, "firestore.rules"), "utf8");
  assert.match(projectsSource, /openSafePrintReport/);
  assert.match(projectsSource, /מספר חבילות ששובץ להן מתנדב/);
  assert.match(projectsSource, /projectTotals\.notes/);
  assert.match(projectsSource, /summary=\{\(filteredRows\)/);
  assert.match(reportsSource, /projectPrintSections/);
  assert.match(reportsSource, /הדפסת דוח מלא/);
  assert.match(reportsSource, /הדפסת אזרחים ותיקים/);
  assert.match(reportsSource, /הדפסת קבוצות/);
  assert.match(reportsSource, /label: "פרויקט"/);
  assert.match(reportsSource, /label: "אזרחים ותיקים"/);
  assert.match(reportsSource, /filterProjectReports/);
  assert.match(reportsSource, /interval=\{0\}/);
  assert.match(reportsSource, /filters\.projectId/);
  assert.match(reportsSource, /selectedProjectPrintSections/);
  assert.match(reportsSource, /kind: "metadata"/);
  assert.match(reportsSource, /entries: selectedEntries/);
  assert.match(reportsSource, /לא מופק דוח משולב לכל הפרויקטים/);
  assert.match(reportsSource, /getElderlyByIds/);
  assert.match(reportsSource, /getVolunteersByIds/);
  assert.match(reportsSource, /getVolunteerGroupsByIds/);
  assert.match(reportsSource, /setLoadError/);
  assert.match(reportsSource, /role="alert"/);
  assert.match(reportsSource, /filteredData\[0\]\.participants\.length/);
  assert.match(
    rulesSource,
    /match \/\{path=\*\*\}\/projectGroups\/\{groupId\} \{\s*allow read: if isAdmin\(\);/,
  );
  assert.match(modelSource, /current\.volName/);
  assert.match(modelSource, /current\.volId/);
  assert.doesNotMatch(
    projectsSource.slice(projectsSource.indexOf("function PrintModal"), projectsSource.indexOf("function AddProjectModal")),
    /document\.write/,
  );
});

test("project participant stats count groups and independent volunteers without duplicates", () => {
  const stats = participantStats([
    { id: "e1", receives: "כן", assignedGroupId: "g1", notes: "" },
    { elderlyId: "e1", receives: "כן", assignedGroupId: "g1", notes: "עודכן" },
    { id: "e2", receives: "כן", assignedVolunteerId: "v1", notes: "  " },
    { id: "e3", receives: "לא", assignedVolunteerId: "", assignedGroupId: "" },
  ]);
  assert.deepEqual(stats, {
    elderly: 3,
    packages: 2,
    delivered: 0,
    assigned: 2,
    notes: 1,
  });
  assert.equal(participantStats([]).assigned, 0);
});

test("special-note counts react to add, edit and delete and stay neighborhood-scoped", () => {
  const base = [
    { id: "e1", first: "א", last: "א", neighborhood: "מרכז", notes: "" },
    { id: "e2", first: "ב", last: "ב", neighborhood: "מרכז", notes: "הערה" },
  ];
  assert.equal(participantStats(base).notes, 1);
  assert.equal(participantStats(base.map((item) => (
    item.id === "e1" ? { ...item, notes: "נוספה" } : item
  ))).notes, 2);
  assert.equal(participantStats(base.map((item) => (
    item.id === "e2" ? { ...item, notes: "נערכה" } : item
  ))).notes, 1);
  assert.equal(participantStats(base.map((item) => (
    item.id === "e2" ? { ...item, notes: "" } : item
  ))).notes, 0);
  assert.deepEqual(neighborhoodNoteEntries(base).map((entry) => entry.id), ["e2"]);
  assert.deepEqual(neighborhoodNoteEntries([]), []);
});
