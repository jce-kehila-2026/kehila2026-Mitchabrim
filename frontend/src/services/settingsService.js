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
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getCategoryItems, normalizeCategoryGroups } from "../utils/categorySettings";
import {
  locationNameKey,
  normalizeLocationName,
  updateAreasModel,
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
    if (!import.meta.env.DEV) {
      throw new Error("App Check is required for location updates");
    }
    return updateLocationSettingsLocally(change);
  }
  const result = await httpsCallable(functions, "updateLocationSettings")(change);
  return result.data;
}

async function updateLocationSettingsLocally(change) {
  const settings = await getSettingsGeneral();
  const areas = updateAreasModel(settings?.areas || [], change);
  const writes = new Map();
  const addPatch = (snapshot, patch, belongsToSource = () => true) => {
    snapshot.docs.forEach((item) => {
      if (!belongsToSource(item.data())) return;
      const current = writes.get(item.ref.path) || { ref: item.ref, patch: {} };
      current.patch = { ...current.patch, ...patch, updatedAt: serverTimestamp() };
      writes.set(item.ref.path, current);
    });
  };
  const matchesSourceArea = (record) => (
    !record.area || locationNameKey(record.area) === locationNameKey(change.oldArea)
  );

  if (change.type === "renameArea") {
    const rootNames = ["elderly", "volunteers", "parliaments"];
    const snapshots = await Promise.all([
      ...rootNames.map((name) => getDocs(query(
        collection(db, name),
        where("area", "==", change.oldArea),
      ))),
      getDocs(collectionGroup(db, "elderlyParticipants")),
      getDocs(collectionGroup(db, "participants")),
      getDocs(query(collection(db, "elderlyContacts"), where("elderlyArea", "==", change.oldArea))),
    ]);
    snapshots.slice(0, 3).forEach((snapshot) => addPatch(snapshot, { area: change.newArea }));
    snapshots.slice(3, 5).forEach((snapshot) => addPatch(
      snapshot,
      { area: change.newArea },
      (record) => locationNameKey(record.area) === locationNameKey(change.oldArea),
    ));
    addPatch(snapshots.at(-1), { elderlyArea: change.newArea });
  } else {
    const neighborhood = change.type === "renameNeighborhood"
      ? change.newNeighborhood
      : change.oldNeighborhood;
    const area = change.type === "moveNeighborhood" ? change.targetArea : change.oldArea;
    const snapshots = await Promise.all([
      getDocs(query(collection(db, "elderly"), where("neighborhood", "==", change.oldNeighborhood))),
      getDocs(query(collection(db, "volunteers"), where("neighborhood", "==", change.oldNeighborhood))),
      getDocs(query(collection(db, "parliaments"), where("neighborhood", "==", change.oldNeighborhood))),
      getDocs(collectionGroup(db, "elderlyParticipants")),
      getDocs(collectionGroup(db, "participants")),
      getDocs(query(collection(db, "elderlyContacts"), where("elderlyNeighborhood", "==", change.oldNeighborhood))),
    ]);
    snapshots.slice(0, 3).forEach((snapshot) => addPatch(
      snapshot,
      { area, neighborhood },
      matchesSourceArea,
    ));
    snapshots.slice(3, 5).forEach((snapshot) => addPatch(
      snapshot,
      { area, neighborhood },
      (record) => locationNameKey(record.neighborhood) === locationNameKey(change.oldNeighborhood)
        && matchesSourceArea(record),
    ));
    addPatch(
      snapshots.at(-1),
      { elderlyArea: area, elderlyNeighborhood: neighborhood },
      (record) => !record.elderlyArea
        || locationNameKey(record.elderlyArea) === locationNameKey(change.oldArea),
    );
  }

  const pendingWrites = [...writes.values()];
  for (let offset = 0; offset < pendingWrites.length; offset += 400) {
    const batch = writeBatch(db);
    pendingWrites.slice(offset, offset + 400).forEach(({ ref, patch }) => batch.update(ref, patch));
    await batch.commit();
  }
  await setDoc(doc(db, COLLECTION, DOC_ID), { areas, updatedAt: serverTimestamp() }, { merge: true });
  return { areas, updatedReferences: writes.size, mode: "development-direct" };
}

export async function getSettingsCategoryItems(groupTitle) {
  const data = await getSettingsGeneral();
  return getCategoryItems(normalizeCategoryGroups(data?.categories), groupTitle);
}
