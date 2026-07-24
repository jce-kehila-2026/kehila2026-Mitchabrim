import { useMemo, useSyncExternalStore } from "react";
import { getAreasAndNeighborhoods } from "../services/settingsService";

const INITIAL_SNAPSHOT = { areas: [], loading: true, error: "" };
let currentSnapshot = INITIAL_SNAPSHOT;
let requestGeneration = 0;
let requestInFlight = null;
let teardownTimer = null;
const consumers = new Set();

function emit() {
  consumers.forEach((consumer) => consumer());
}

function loadAreas() {
  if (requestInFlight) return;
  const generation = requestGeneration;
  currentSnapshot = { ...currentSnapshot, loading: true, error: "" };

  requestInFlight = getAreasAndNeighborhoods()
    .then((areas) => {
      if (generation !== requestGeneration) return;
      currentSnapshot = { areas, loading: false, error: "" };
      emit();
    })
    .catch((err) => {
      console.error("Failed to load areas/neighborhoods:", err);
      if (generation !== requestGeneration) return;
      currentSnapshot = {
        areas: [],
        loading: false,
        error: "אירעה שגיאה בטעינת האזורים",
      };
      emit();
    })
    .finally(() => {
      if (generation === requestGeneration) requestInFlight = null;
    });
}

function subscribe(consumer) {
  consumers.add(consumer);
  if (teardownTimer) {
    clearTimeout(teardownTimer);
    teardownTimer = null;
  }
  loadAreas();

  return () => {
    consumers.delete(consumer);
    if (consumers.size !== 0) return;
    teardownTimer = setTimeout(() => {
      if (consumers.size !== 0) return;
      requestGeneration += 1;
      requestInFlight = null;
      currentSnapshot = INITIAL_SNAPSHOT;
      teardownTimer = null;
    }, 0);
  };
}

function getSnapshot() {
  return currentSnapshot;
}

/**
 * Loads areas and neighborhoods once for all consumers mounted on the current
 * screen. The snapshot is discarded after the last consumer leaves, so later
 * navigation reads fresh settings instead of retaining a broad cache.
 */
export default function useAreasAndNeighborhoods() {
  const { areas, loading, error } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot,
  );

  const areaNames = useMemo(() => areas.map((a) => a.area), [areas]);
  const allNeighborhoods = useMemo(
    () => Array.from(new Set(areas.flatMap((a) => a.neighborhoods || []))),
    [areas],
  );

  const getNeighborhoods = (areaName) => {
    if (!areaName) return allNeighborhoods;
    const found = areas.find((a) => a.area === areaName);
    return found ? found.neighborhoods : [];
  };

  return {
    areas,
    areaNames,
    allNeighborhoods,
    getNeighborhoods,
    loading,
    error,
    isEmpty: !loading && !error && areas.length === 0,
  };
}
