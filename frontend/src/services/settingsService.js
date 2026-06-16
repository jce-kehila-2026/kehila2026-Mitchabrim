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