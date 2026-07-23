import { sanitizeText } from "../utils/sanitize.js";

export const VOLUNTEER_REPORT_TYPES = Object.freeze([
  "ביקור בית",
  "שיחת טלפון",
  "ליווי",
  "חלוקת חבילה",
  "מפגש פרלמנט",
  "אחר",
]);

export const VOLUNTEER_REPORT_CREATE_FIELDS = Object.freeze([
  "volunteerId",
  "volunteerAuthUid",
  "volunteerName",
  "volunteerEmail",
  "elderlyId",
  "elderlyName",
  "reportDate",
  "reportType",
  "notes",
  "status",
  "reviewedAt",
  "reviewedBy",
  "adminNote",
  "createdAt",
]);

function requiredText(value, field, maxLength) {
  const clean = sanitizeText(value, maxLength);
  if (!clean) throw new Error(`${field} is required`);
  return clean;
}

export function normalizeVolunteerReportInput(reportData = {}) {
  const reportDate = requiredText(reportData.reportDate, "reportDate", 10);
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(reportDate)) {
    throw new Error("reportDate must use YYYY-MM-DD");
  }

  const reportType = requiredText(reportData.reportType, "reportType", 100);
  if (!VOLUNTEER_REPORT_TYPES.includes(reportType)) {
    throw new Error("reportType is not supported");
  }

  return {
    volunteerId: requiredText(reportData.volunteerId, "volunteerId", 200),
    volunteerAuthUid: requiredText(reportData.volunteerAuthUid, "volunteerAuthUid", 200),
    volunteerName: requiredText(reportData.volunteerName, "volunteerName", 200),
    volunteerEmail: requiredText(reportData.volunteerEmail, "volunteerEmail", 320),
    elderlyId: requiredText(reportData.elderlyId, "elderlyId", 200),
    elderlyName: requiredText(reportData.elderlyName, "elderlyName", 200),
    reportDate,
    reportType,
    notes: sanitizeText(reportData.notes, 2000),
  };
}
