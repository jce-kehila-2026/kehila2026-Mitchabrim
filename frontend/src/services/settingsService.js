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

import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

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
