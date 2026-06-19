// Lightweight settings reader.
// Reads areas and neighborhoods from Firestore document: settings/general

import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export async function getSettings() {
  const ref = doc(db, "settings", "general");
  const snap = await getDoc(ref);

  return snap.exists() ? snap.data() : {};
}

/**
 * Read areas + neighborhoods from the shared `settings/general` document.
 * Returns an array like:
 * [
 *   { area: "דרום העיר", neighborhoods: ["גילה", "קטמון"] }
 * ]
 */
export async function getAreasAndNeighborhoods() {
  const data = await getSettings();

  const areas = Array.isArray(data?.areas) ? data.areas : [];

  return areas
    .filter((item) => item && item.area)
    .map((item) => ({
      area: item.area,
      neighborhoods: Array.isArray(item.neighborhoods)
        ? item.neighborhoods.filter(Boolean)
        : [],
    }));
}

/**
 * Returns full areas objects:
 * [
 *   { area: "...", neighborhoods: [...] }
 * ]
 */
export async function getAreas() {
  return await getAreasAndNeighborhoods();
}

/**
 * Returns only area names:
 * ["דרום העיר", "צפון העיר"]
 */
export async function getAreaNames() {
  const areas = await getAreasAndNeighborhoods();
  return areas.map((item) => item.area).filter(Boolean);
}

/**
 * Returns neighborhoods for a specific area.
 */
export async function getNeighborhoodsByArea(areaName) {
  if (!areaName) return [];

  const areas = await getAreasAndNeighborhoods();
  const found = areas.find((item) => item.area === areaName);

  return found ? found.neighborhoods : [];
}