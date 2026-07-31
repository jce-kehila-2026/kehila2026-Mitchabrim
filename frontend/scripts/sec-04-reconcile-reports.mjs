import { pathToFileURL } from "node:url";
import { VOLUNTEER_REPORT_CREATE_FIELDS } from "../src/services/volunteerReportPolicy.js";

function decodeValue(value = {}) {
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("timestampValue" in value) return value.timestampValue;
  if ("integerValue" in value) return Number(value.integerValue);
  return undefined;
}

function decodeFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

async function listCollection(host, projectId, collectionName) {
  const base = `http://${host}/v1/projects/${projectId}/databases/(default)/documents/${collectionName}`;
  const records = [];
  let pageToken = "";
  do {
    const url = new URL(base);
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers: { Authorization: "Bearer owner" } });
    if (!response.ok) throw new Error(`Failed to list emulator ${collectionName}: ${response.status}`);
    const body = await response.json();
    records.push(...(body.documents || []).map((document) => ({
      id: document.name.split("/").at(-1),
      ...decodeFields(document.fields),
    })));
    pageToken = body.nextPageToken || "";
  } while (pageToken);
  return records;
}

export function planVolunteerReportReconciliation({ report = {}, user, volunteer, elderly } = {}) {
  const reasons = [];
  const keys = Object.keys(report).filter((key) => key !== "id");
  const extraFields = keys.filter((key) => !VOLUNTEER_REPORT_CREATE_FIELDS.includes(key));
  const missingFields = VOLUNTEER_REPORT_CREATE_FIELDS.filter((key) => !keys.includes(key));

  if (extraFields.length) reasons.push("unexpected-fields");
  if (missingFields.length) reasons.push("missing-fields");
  if (!user) reasons.push("missing-user");
  if (!volunteer) reasons.push("missing-volunteer");
  if (!elderly) reasons.push("missing-elderly");
  if (user && user.linkedVolunteerId !== report.volunteerId) reasons.push("volunteer-link-mismatch");
  if (volunteer && volunteer.id !== report.volunteerId) reasons.push("volunteer-document-mismatch");
  if (elderly && elderly.volId !== report.volunteerId) reasons.push("elderly-assignment-mismatch");
  if (report.status !== "pending" && report.status !== "approved" && report.status !== "rejected") {
    reasons.push("invalid-status");
  }

  return {
    action: reasons.length ? "review" : "consistent",
    reasons,
    extraFields,
    missingFields,
  };
}

export async function runReportReconciliation() {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "demo-sec04";
  if (!host) {
    throw new Error("Refusing to run: FIRESTORE_EMULATOR_HOST is required; production is never supported.");
  }

  const [reports, users, volunteers, elderlyRecords] = await Promise.all([
    listCollection(host, projectId, "volunteerReports"),
    listCollection(host, projectId, "users"),
    listCollection(host, projectId, "volunteers"),
    listCollection(host, projectId, "elderly"),
  ]);
  const usersById = new Map(users.map((item) => [item.id, item]));
  const volunteersById = new Map(volunteers.map((item) => [item.id, item]));
  const elderlyById = new Map(elderlyRecords.map((item) => [item.id, item]));
  const summary = { mode: "dry-run-emulator", consistent: 0, review: 0 };

  for (const report of reports) {
    const plan = planVolunteerReportReconciliation({
      report,
      user: usersById.get(report.volunteerAuthUid),
      volunteer: volunteersById.get(report.volunteerId),
      elderly: elderlyById.get(report.elderlyId),
    });
    summary[plan.action] += 1;
    console.log(JSON.stringify({ id: report.id, ...plan }));
  }
  console.log(JSON.stringify(summary));
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runReportReconciliation().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
