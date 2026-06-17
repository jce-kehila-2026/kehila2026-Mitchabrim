// Lightweight settings reader. Returns areas (regions) and neighborhoods
// from the same Firestore document the Settings page writes to.
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export async function getSettings() {
  const snap = await getDoc(doc(db, "settings", "general"));
  return snap.exists() ? snap.data() : {};
}

export async function getAreas() {
  const data = await getSettings();
  const areas = Array.isArray(data?.areas) ? data.areas : [];
  // Returns: [{ area, neighborhoods: [] }, ...]
  return areas;
}

export async function getAreaNames() {
  const areas = await getAreas();
  return areas.map((a) => a?.area).filter(Boolean);
}
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Read areas + neighborhoods from the shared `settings/general` document.
 * Returns an array like:
 *   [{ area: "דרום העיר", neighborhoods: ["גילה", "קטמון"] }, ...]
 *
 * This is the single source of truth used by Elderly and Volunteers screens.
 * No hardcoded fallback lists — if the document is missing the caller should
 * show the empty state.
 */
export async function getAreasAndNeighborhoods() {
  const ref = doc(db, "settings", "general");
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const data = snap.data() || {};
  const areas = Array.isArray(data.areas) ? data.areas : [];
  return areas
    .filter((a) => a && a.area)
    .map((a) => ({
      area: a.area,
      neighborhoods: Array.isArray(a.neighborhoods)
        ? a.neighborhoods.filter(Boolean)
        : [],
    }));
}

export async function getAreas() {
  const list = await getAreasAndNeighborhoods();
  return list.map((a) => a.area);
}

export async function getNeighborhoodsByArea(areaName) {
  if (!areaName) return [];
  const list = await getAreasAndNeighborhoods();
  const found = list.find((a) => a.area === areaName);
  return found ? found.neighborhoods : [];
}
