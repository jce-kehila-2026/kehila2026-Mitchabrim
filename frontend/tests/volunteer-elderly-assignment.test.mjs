import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ASSIGNED_VOLUNTEER_STATUS,
  WAITING_VOLUNTEER_STATUS,
  ARCHIVED_VOLUNTEER_STATUS,
  deriveVolunteerAssignment,
} from "../src/utils/volunteerAssignments.js";

test("volunteer status is derived from authoritative elderly assignments", () => {
  const unassigned = deriveVolunteerAssignment(
    { id: "v1", status: ASSIGNED_VOLUNTEER_STATUS },
    [],
  );
  assert.equal(unassigned.status, WAITING_VOLUNTEER_STATUS);
  assert.deepEqual(unassigned.assignedElderly, []);

  const assigned = deriveVolunteerAssignment(
    { id: "v1", status: WAITING_VOLUNTEER_STATUS },
    [{ id: "e1", name: "שרה כהן" }],
  );
  assert.equal(assigned.status, ASSIGNED_VOLUNTEER_STATUS);
  assert.deepEqual(assigned.assignedElderly.map((item) => item.name), ["שרה כהן"]);
});

test("multiple elderly assignments are sorted and archived volunteers stay archived", () => {
  const multiple = deriveVolunteerAssignment(
    { id: "v2", status: WAITING_VOLUNTEER_STATUS },
    [
      { id: "e2", name: "רחל לוי" },
      { id: "e1", name: "אברהם כהן" },
    ],
  );
  assert.equal(multiple.status, ASSIGNED_VOLUNTEER_STATUS);
  assert.deepEqual(
    multiple.assignedElderly.map((item) => item.name),
    ["אברהם כהן", "רחל לוי"],
  );

  const archived = deriveVolunteerAssignment(
    { id: "v3", status: ARCHIVED_VOLUNTEER_STATUS },
    [{ id: "e3", name: "מרים ישראלי" }],
  );
  assert.equal(archived.status, ARCHIVED_VOLUNTEER_STATUS);
});

test("volunteers table subscribes to elderly.volId and renders derived assignments", () => {
  const root = resolve(import.meta.dirname, "..");
  const page = readFileSync(resolve(root, "src/admin/Volunteers.jsx"), "utf8");
  const service = readFileSync(resolve(root, "src/services/elderlyService.js"), "utf8");

  assert.match(page, /subscribeElderlyForVolunteerIds/);
  assert.match(page, /deriveVolunteerAssignment/);
  assert.match(page, /r\.assignedElderly/);
  assert.match(page, /\+ \$\{extra\} נוספים/);
  assert.match(service, /where\("volId", "in", chunk\)/);
  assert.match(service, /onSnapshot/);
});
