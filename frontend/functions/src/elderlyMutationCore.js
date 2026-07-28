import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

const OPERATION_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const ASSIGNED_STATUS = "משויך לאזרח ותיק";
const WAITING_STATUS = "ממתין לשיבוץ";
const FINAL_LETTERS = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };

const normalizeText = (value) => String(value || "")
  .normalize("NFKC")
  .toLocaleLowerCase()
  .replace(/[ךםןףץ]/g, (letter) => FINAL_LETTERS[letter])
  .replace(/[^\p{L}\p{N}\s]/gu, " ")
  .trim()
  .replace(/\s+/g, " ");

const normalizeDigits = (value) => String(value || "").replace(/\D/g, "");

function addPrefixes(target, value, normalize = normalizeText) {
  const normalized = normalize(value);
  for (let length = 2; length <= normalized.length; length += 1) {
    target.add(normalized.slice(0, length));
  }
}

function buildSearchFields(data) {
  const searchName = normalizeText(`${data.firstName || ""} ${data.lastName || ""}`);
  const searchPhone = normalizeDigits(data.mobile || data.homePhone);
  const searchIdNumber = normalizeDigits(data.idNum);
  const prefixes = new Set();
  [searchName].filter(Boolean).forEach((value) => {
    const normalized = normalizeText(value);
    addPrefixes(prefixes, normalized);
    normalized.split(" ").filter(Boolean).forEach((token) => addPrefixes(prefixes, token));
    if (normalized.includes(" ")) addPrefixes(prefixes, normalized.replace(/\s/g, ""));
  });
  [data.mobile, data.homePhone, data.idNum]
    .filter(Boolean)
    .forEach((value) => addPrefixes(prefixes, value, normalizeDigits));
  return {
    searchName,
    searchPhone,
    searchIdNumber,
    searchSchemaVersion: 1,
    searchPrefixes: Array.from(prefixes).slice(0, 500),
  };
}

export function validateElderlyData(data) {
  const exactDigits = (field, length, required = false) => {
    const value = data[field];
    if (value == null || value === "") {
      if (required) throw new HttpsError("invalid-argument", `${field} is required.`);
      return;
    }
    if (typeof value !== "string" || !new RegExp(`^\\d{${length}}$`).test(value)) {
      throw new HttpsError("invalid-argument", `${field} must contain exactly ${length} digits.`);
    }
  };
  exactDigits("idNum", 9);
  exactDigits("mobile", 10, true);
  exactDigits("homePhone", 9);
  if (data.birth) {
    if (typeof data.birth !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.birth)) {
      throw new HttpsError("invalid-argument", "birth must be a complete date.");
    }
    const [year, month, day] = data.birth.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1
      || parsed.getUTCDate() !== day || parsed.getTime() > Date.now()) {
      throw new HttpsError("invalid-argument", "birth is invalid or in the future.");
    }
  }
  if (data.languages != null && (
    !Array.isArray(data.languages)
    || data.languages.some((language) => typeof language !== "string" || !language.trim())
  )) {
    throw new HttpsError("invalid-argument", "languages must be a string array.");
  }
}

function validateInput(raw) {
  const action = raw?.action;
  const operationId = typeof raw?.operationId === "string" ? raw.operationId.trim() : "";
  if (!["create", "update", "delete"].includes(action)
    || !OPERATION_ID_PATTERN.test(operationId)) {
    throw new HttpsError("invalid-argument", "Invalid elderly mutation request.");
  }
  const elderlyId = typeof raw?.elderlyId === "string" ? raw.elderlyId.trim() : "";
  if (action !== "create" && !elderlyId) {
    throw new HttpsError("invalid-argument", "An elderly record id is required.");
  }
  const data = raw?.data && typeof raw.data === "object" && !Array.isArray(raw.data)
    ? { ...raw.data }
    : {};
  delete data.id;
  delete data.createdAt;
  delete data.updatedAt;
  delete data.operationId;
  if (JSON.stringify(data).length > 100_000 || Object.keys(data).length > 100) {
    throw new HttpsError("invalid-argument", "The elderly record is too large.");
  }
  return { action, operationId, elderlyId, data };
}

async function assertAdmin(db, callerUid) {
  if (!callerUid) throw new HttpsError("unauthenticated", "Authentication required.");
  const caller = await db.collection("users").doc(callerUid).get();
  if (!caller.exists || caller.data()?.role !== "admin" || caller.data()?.status !== "active") {
    throw new HttpsError("permission-denied", "Administrator access required.");
  }
}

function hasAssignmentAfterMutation({ querySnapshot, targetId, action, newVolId, volunteerId }) {
  const hasOtherAssignment = querySnapshot.docs.some((item) => item.id !== targetId);
  if (hasOtherAssignment) return true;
  if (action === "create") return newVolId === volunteerId;
  if (action === "update") return newVolId === volunteerId;
  return false;
}

export async function elderlyMutationCore({ db, callerUid, data: raw }) {
  await assertAdmin(db, callerUid);
  const input = validateInput(raw);
  const targetId = input.action === "create"
    ? `elderly_${input.operationId}`
    : input.elderlyId;
  const targetRef = db.collection("elderly").doc(targetId);

  return db.runTransaction(async (transaction) => {
    const target = await transaction.get(targetRef);
    if (input.action === "create" && target.exists) {
      if (target.data()?.operationId === input.operationId) {
        return { status: "already-applied", id: targetId };
      }
      throw new HttpsError("already-exists", "The elderly record already exists.");
    }
    if (input.action !== "create" && !target.exists) {
      if (input.action === "delete") return { status: "already-applied", id: targetId };
      throw new HttpsError("not-found", "The elderly record was not found.");
    }

    const previous = target.exists ? target.data() : {};
    const nextData = input.action === "update" ? { ...previous, ...input.data } : input.data;
    if (input.action !== "delete") validateElderlyData(nextData);
    const oldVolId = typeof previous.volId === "string" ? previous.volId : "";
    const newVolId = input.action === "delete" || typeof nextData.volId !== "string"
      ? ""
      : nextData.volId;
    const affectedVolunteerIds = Array.from(new Set([oldVolId, newVolId].filter(Boolean)));

    const assignmentSnapshots = await Promise.all(affectedVolunteerIds.map((volunteerId) => (
      transaction.get(
        db.collection("elderly").where("volId", "==", volunteerId).limit(2),
      )
    )));
    const volunteerSnapshots = await Promise.all(affectedVolunteerIds.map((volunteerId) => (
      transaction.get(db.collection("volunteers").doc(volunteerId))
    )));

    if (newVolId) {
      const newVolunteerIndex = affectedVolunteerIds.indexOf(newVolId);
      if (!volunteerSnapshots[newVolunteerIndex]?.exists) {
        throw new HttpsError("failed-precondition", "The assigned volunteer does not exist.");
      }
    }

    const now = FieldValue.serverTimestamp();
    if (input.action === "create") {
      transaction.create(targetRef, {
        ...input.data,
        ...buildSearchFields(input.data),
        operationId: input.operationId,
        createdAt: now,
        updatedAt: now,
      });
    } else if (input.action === "update") {
      transaction.update(targetRef, {
        ...input.data,
        ...buildSearchFields(nextData),
        lastMutationOperationId: input.operationId,
        updatedAt: now,
      });
    } else {
      transaction.delete(targetRef);
    }

    affectedVolunteerIds.forEach((volunteerId, index) => {
      if (!volunteerSnapshots[index].exists) return;
      const assigned = hasAssignmentAfterMutation({
        querySnapshot: assignmentSnapshots[index],
        targetId,
        action: input.action,
        newVolId,
        volunteerId,
      });
      transaction.update(volunteerSnapshots[index].ref, {
        status: assigned ? ASSIGNED_STATUS : WAITING_STATUS,
        updatedAt: now,
      });
    });

    return { status: "applied", id: targetId };
  });
}

