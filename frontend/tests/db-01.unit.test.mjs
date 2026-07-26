import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import { createOperationId, requireOperationId } from "../src/utils/operationId.js";

const root = resolve(import.meta.dirname, "..");
const source = (path) => readFileSync(resolve(root, path), "utf8");

test("operation ids are stable Firestore-safe idempotency keys", () => {
  const operationId = createOperationId();
  assert.equal(requireOperationId(operationId), operationId);
  assert.throws(() => requireOperationId("short"), /operation id/i);
  assert.throws(() => requireOperationId("x".repeat(129)), /operation id/i);
  assert.throws(() => requireOperationId("not/allowed operation id"), /operation id/i);
});

test("task and profile request paired writes use transactions and deterministic ids", () => {
  const tasks = source("src/services/tasksService.js");
  assert.match(tasks, /runTransaction\(db/);
  assert.match(tasks, /`task_\$\{safeOperationId\}`/);
  assert.match(tasks, /`task_assigned_\$\{docRef\.id\}`/);

  const requests = source("src/services/profileUpdateRequestsService.js");
  assert.match(requests, /runTransaction\(db/);
  assert.match(requests, /`profile_\$\{safeOperationId\}`/);
  assert.match(requests, /decision-conflict/);
});

test("volunteer/group counters and linked-user deletion are transactional", () => {
  const volunteers = source("src/services/volunteersService.js");
  assert.match(volunteers, /createVolunteer[\s\S]*runTransaction\(db/);
  assert.match(volunteers, /updateVolunteerWithGroupAccounting/);
  assert.match(volunteers, /deleteVolunteer[\s\S]*runTransaction\(db/);
  assert.doesNotMatch(volunteers, /export async function increaseGroupCount/);

  const users = source("src/services/allowedUsersService.js");
  assert.match(users, /deleteAllowedUser[\s\S]*runTransaction\(db/);
  const settings = source("src/admin/Settings.jsx");
  assert.doesNotMatch(settings, /unlinkVolunteerAuthUid/);
});

test("financial receipt moves are atomic and retry keys survive Storage/Firestore handoff", () => {
  const financial = source("src/services/financialService.js");
  assert.match(financial, /moveReceiptLinkage/);
  assert.match(financial, /runTransaction\(db/);
  assert.match(financial, /receiptMoveOperationId/);
  assert.match(financial, /\$\{RECEIPTS_STORAGE_PREFIX\}\/\$\{requireOperationId\(operationId\)\}_/);
});

test("project and parliament aggregate creation publishes parent last", () => {
  const projects = source("src/services/projectsService.js");
  assert.match(projects, /createProjectWithRelations/);
  assert.match(projects, /operations\.push\(\(batch\) => batch\.set\(projectRef/);
  assert.match(projects, /commitBatchOperations/);

  const parliaments = source("src/services/parliamentsService.js");
  assert.match(parliaments, /addMeetingWithAttendance/);
  assert.match(parliaments, /removeParticipantWithAttendance/);
  assert.match(parliaments, /operations\.push\(\(batch\) => batch\.set\(meetingRef/);
});

test("elderly relationship mutation is callable-only and no sequential status sync remains", () => {
  const elderlyPage = source("src/admin/Elderly.jsx");
  assert.doesNotMatch(elderlyPage, /syncVolunteerStatus/);
  assert.doesNotMatch(elderlyPage, /editVolunteer/);

  const elderlyService = source("src/services/elderlyService.js");
  assert.match(elderlyService, /httpsCallable\(functions, "mutateElderly"\)/);
  assert.doesNotMatch(elderlyService, /addDoc\(elderlyCollection/);

  const functionsIndex = source("functions/index.js");
  assert.match(functionsIndex, /export const mutateElderly = onCall/);
  const core = source("functions/src/elderlyMutationCore.js");
  assert.match(core, /db\.runTransaction/);
  assert.match(core, /permission-denied/);
  assert.match(core, /where\("volId", "==", volunteerId\)\.limit\(2\)/);
});
