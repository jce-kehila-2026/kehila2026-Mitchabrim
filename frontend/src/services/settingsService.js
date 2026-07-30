// src/services/settingsService.js
// Admin-only reads/writes for the singleton "settings/general" document.
//
// The document holds site-wide configuration (orgName, address, emails,
// phones, areas, categories) and is edited only from /admin/settings.
// Public website content is stored separately in siteContent/home; public
// components must not depend on this administrative document.
// Firestore rules gate writes to isAdmin() via the admin fallback.
//
// Auth / invite / relink logic lives elsewhere (allowedUsersService) and
// is intentionally NOT touched from this service.

import { db, getSecureFunctions } from "../firebase";
import {
  doc,
  getDoc,
  runTransaction,
  setDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { normalizeErrorCode } from "../utils/errorPolicy";
import { getCategoryItems, normalizeCategoryGroups } from "../utils/categorySettings";
import {
  locationNameKey,
  normalizeLocationName,
} from "../utils/elderlyFormModel";

const COLLECTION = "settings";
const DOC_ID = "general";

/**
 * Fetch the settings/general document.
 * Returns the raw data object or null when the document does not exist.
 */
export async function getSettingsGeneral() {
  const snap = await getDoc(doc(db, COLLECTION, DOC_ID));
  if (!snap.exists()) return null;
  return snap.data();
}

/**
 * Merge-write the settings/general document. Preserves the previous
 * inline behavior: setDoc(..., { merge: true }). Caller supplies the
 * exact field set to write (no field renames, no schema changes).
 */
export async function saveSettingsGeneral(patch) {
  await setDoc(doc(db, COLLECTION, DOC_ID), patch || {}, { merge: true });
}

/**
 * Return the areas array (with nested neighborhoods) from settings/general.
 * Shape: [{ area: string, neighborhoods: string[] }, ...]
 */
export async function getAreasAndNeighborhoods() {
  const data = await getSettingsGeneral();
  if (!data) return [];
  return Array.isArray(data.areas) ? data.areas : [];
}

/**
 * Return just the list of area names from settings/general.
 */
export async function getAreaNames() {
  const areas = await getAreasAndNeighborhoods();
  return areas.map((a) => a.area).filter(Boolean);
}

export async function getCountries(fallback = []) {
  const data = await getSettingsGeneral();
  const configured = Array.isArray(data?.countries) ? data.countries : [];
  return [...new Map([...fallback, ...configured]
    .map(normalizeLocationName)
    .filter(Boolean)
    .map((country) => [locationNameKey(country), country])).values()]
    .sort((a, b) => a.localeCompare(b, "he"));
}

export async function addCountry(country, fallback = []) {
  const normalized = normalizeLocationName(country);
  if (!normalized) throw new Error("יש להזין שם מדינה");
  const ref = doc(db, COLLECTION, DOC_ID);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = Array.isArray(snapshot.data()?.countries) ? snapshot.data().countries : [];
    const countries = [...new Map([...fallback, ...current]
      .map(normalizeLocationName)
      .filter(Boolean)
      .map((item) => [locationNameKey(item), item])).values()];
    if (countries.some((item) => locationNameKey(item) === locationNameKey(normalized))) {
      throw new Error("המדינה כבר קיימת");
    }
    const next = [...countries, normalized].sort((a, b) => a.localeCompare(b, "he"));
    transaction.set(ref, { countries: next }, { merge: true });
    return next;
  });
}

export async function getLanguages(fallback = []) {
  const data = await getSettingsGeneral();
  const configured = Array.isArray(data?.languages) ? data.languages : [];
  return [...new Map([...fallback, ...configured]
    .map(normalizeLocationName)
    .filter(Boolean)
    .map((language) => [locationNameKey(language), language])).values()]
    .sort((a, b) => a.localeCompare(b, "he"));
}

export async function addLanguage(language, fallback = []) {
  const normalized = normalizeLocationName(language);
  if (!normalized) throw new Error("יש להזין שם שפה");
  const ref = doc(db, COLLECTION, DOC_ID);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = Array.isArray(snapshot.data()?.languages) ? snapshot.data().languages : [];
    const languages = [...new Map([...fallback, ...current]
      .map(normalizeLocationName)
      .filter(Boolean)
      .map((item) => [locationNameKey(item), item])).values()];
    if (languages.some((item) => locationNameKey(item) === locationNameKey(normalized))) {
      throw new Error("השפה כבר קיימת");
    }
    const next = [...languages, normalized].sort((a, b) => a.localeCompare(b, "he"));
    transaction.set(ref, { languages: next }, { merge: true });
    return next;
  });
}

export async function updateLocationSettings(change) {
  const functions = await getSecureFunctions();
  if (!functions) {
    const error = new Error("App Check is required for location updates");
    error.code = "location-settings/app-check-required";
    throw error;
  }
  const result = await httpsCallable(functions, "updateLocationSettings")(change);
  return result.data;
}

export async function getBackupStatus() {
  const functions = await getSecureFunctions();
  const result = await httpsCallable(functions, "getBackupStatus")({});
  return result.data;
}

export function backupStatusErrorMessage(error) {
  const code = normalizeErrorCode(error);
  if (code === "unauthenticated") return "ההתחברות פגה. יש להתחבר מחדש.";
  if (code === "permission-denied") return "אין הרשאת מנהל פעילה לצפייה במצב הגיבוי.";
  if (code === "not-found") return "שירות מצב הגיבוי טרם נפרס.";
  if (code.includes("app-check") || code === "failed-precondition") {
    return "אימות אבטחת היישום נכשל. יש לרענן ולנסות שוב.";
  }
  if (code === "unavailable") return "שירות מצב הגיבוי אינו זמין כרגע.";
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "אין חיבור לרשת. לא ניתן לבדוק את מצב הגיבוי.";
  }
  return "בדיקת מצב הגיבוי נכשלה.";
}

export function locationSettingsErrorMessage(error) {
  const code = normalizeErrorCode(error);
  const reason = error?.details?.reason;
  const count = Number(error?.details?.referenceCount || 0);
  if (reason === "location-in-use") {
    return `לא ניתן למחוק: קיימות ${count} רשומות מקושרות. יש להעביר או לעדכן אותן תחילה.`;
  }
  if (reason === "too-many-references") {
    return `לא ניתן להשלים את הפעולה בבטחה: נמצאו ${count} רשומות לעדכון. יש לפנות למנהל המערכת.`;
  }
  if (code === "unauthenticated") return "ההתחברות פגה. יש להתחבר מחדש ולנסות שוב.";
  if (code === "permission-denied") return "אין הרשאת מנהל פעילה לביצוע הפעולה.";
  if (["invalid-argument", "already-exists", "not-found"].includes(code)) {
    return error?.message || "פרטי האזור או השכונה אינם תקינים.";
  }
  if (
    code.includes("app-check")
    || ["failed-precondition", "internal", "unavailable"].includes(code)
  ) {
    return "אימות אבטחת היישום או שירות העדכון נכשל. יש לרענן ולנסות שוב.";
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "אין חיבור לרשת. לא בוצע שינוי.";
  }
  return "עדכון האזור או השכונה נכשל. לא בוצע שינוי.";
}

export async function getSettingsCategoryItems(groupTitle) {
  const data = await getSettingsGeneral();
  return getCategoryItems(normalizeCategoryGroups(data?.categories), groupTitle);
}
