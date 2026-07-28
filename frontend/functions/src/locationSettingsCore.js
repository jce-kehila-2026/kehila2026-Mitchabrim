import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

const MAX_ATOMIC_REFERENCE_WRITES = 450;
const AREA_ACTIONS = new Set(["renameArea", "deleteArea"]);
const LOCATION_ACTIONS = new Set([
  "renameArea",
  "renameNeighborhood",
  "moveNeighborhood",
  "deleteArea",
  "deleteNeighborhood",
]);

const clean = (value) => String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ");
const key = (value) => clean(value).toLocaleLowerCase("he");

export function updateAreas(areas, input) {
  const next = (areas || []).map((area) => ({
    area: clean(area.area),
    neighborhoods: (area.neighborhoods || []).map(clean).filter(Boolean),
  }));
  const sourceIndex = next.findIndex((area) => key(area.area) === key(input.oldArea));
  const source = next[sourceIndex];
  if (!source) throw new HttpsError("not-found", "Source area was not found.");

  if (input.type === "renameArea") {
    if (!input.newArea || next.some((area) => area !== source && key(area.area) === key(input.newArea))) {
      throw new HttpsError("already-exists", "Area name is empty or already exists.");
    }
    source.area = input.newArea;
  } else if (input.type === "deleteArea") {
    next.splice(sourceIndex, 1);
  } else {
    const index = source.neighborhoods.findIndex((name) => key(name) === key(input.oldNeighborhood));
    if (index < 0) throw new HttpsError("not-found", "Neighborhood was not found.");
    if (input.type === "renameNeighborhood") {
      const duplicate = next.some((area) => area.neighborhoods.some(
        (name) => key(name) === key(input.newNeighborhood) && key(name) !== key(input.oldNeighborhood),
      ));
      if (!input.newNeighborhood || duplicate) {
        throw new HttpsError("already-exists", "Neighborhood name is empty or already exists.");
      }
      source.neighborhoods[index] = input.newNeighborhood;
    } else if (input.type === "moveNeighborhood") {
      const target = next.find((area) => key(area.area) === key(input.targetArea));
      if (!target || target === source) throw new HttpsError("invalid-argument", "Target area is invalid.");
      if (target.neighborhoods.some((name) => key(name) === key(input.oldNeighborhood))) {
        throw new HttpsError("already-exists", "Neighborhood already exists in target area.");
      }
      source.neighborhoods.splice(index, 1);
      target.neighborhoods.push(input.oldNeighborhood);
    } else {
      source.neighborhoods.splice(index, 1);
    }
  }

  return next
    .sort((a, b) => a.area.localeCompare(b.area, "he"))
    .map((area) => ({
      ...area,
      neighborhoods: area.neighborhoods.sort((a, b) => a.localeCompare(b, "he")),
    }));
}

export function normalizedInput(raw) {
  const input = {
    type: raw?.type,
    oldArea: clean(raw?.oldArea),
    newArea: clean(raw?.newArea),
    oldNeighborhood: clean(raw?.oldNeighborhood),
    newNeighborhood: clean(raw?.newNeighborhood),
    targetArea: clean(raw?.targetArea),
  };
  if (!LOCATION_ACTIONS.has(input.type)) {
    throw new HttpsError("invalid-argument", "Unknown location change.");
  }
  if (!input.oldArea) throw new HttpsError("invalid-argument", "Source area is required.");
  if (!AREA_ACTIONS.has(input.type) && !input.oldNeighborhood) {
    throw new HttpsError("invalid-argument", "Source neighborhood is required.");
  }
  return input;
}

function locationQueries(db, input) {
  if (AREA_ACTIONS.has(input.type)) {
    return [
      ...["elderly", "volunteers", "parliaments"].map((name) => db.collection(name)),
      db.collectionGroup("elderlyParticipants"),
      db.collectionGroup("participants"),
      db.collection("elderlyContacts"),
    ];
  }
  return [
    ...["elderly", "volunteers", "parliaments"]
      .map((name) => db.collection(name).where("neighborhood", "==", input.oldNeighborhood)),
    db.collectionGroup("elderlyParticipants"),
    db.collectionGroup("participants"),
    db.collection("elderlyContacts").where("elderlyNeighborhood", "==", input.oldNeighborhood),
  ];
}

function buildReferenceWrites(snapshots, input) {
  const writes = new Map();
  const addPatch = (snapshot, patch, belongsToSource = () => true) => snapshot.docs.forEach((item) => {
    if (!belongsToSource(item.data())) return;
    const current = writes.get(item.ref.path) || { ref: item.ref, patch: {} };
    current.patch = { ...current.patch, ...patch, updatedAt: FieldValue.serverTimestamp() };
    writes.set(item.ref.path, current);
  });

  if (AREA_ACTIONS.has(input.type)) {
    const sourceNeighborhoods = new Set(input.sourceNeighborhoods.map(key));
    const belongsToArea = (record) => key(record.area) === key(input.oldArea)
      || (!record.area && sourceNeighborhoods.has(key(record.neighborhood)));
    const contactBelongsToArea = (record) => key(record.elderlyArea) === key(input.oldArea)
      || (!record.elderlyArea && sourceNeighborhoods.has(key(record.elderlyNeighborhood)));
    snapshots.slice(0, 3).forEach(
      (snapshot) => addPatch(snapshot, { area: input.newArea }, belongsToArea),
    );
    snapshots.slice(3, 5).forEach((snapshot) => addPatch(
      snapshot,
      { area: input.newArea },
      belongsToArea,
    ));
    addPatch(snapshots.at(-1), { elderlyArea: input.newArea }, contactBelongsToArea);
    return writes;
  }

  const newNeighborhood = input.type === "renameNeighborhood"
    ? input.newNeighborhood
    : input.oldNeighborhood;
  const newArea = input.type === "moveNeighborhood" ? input.targetArea : input.oldArea;
  const belongsToSource = (record) => !record.area || key(record.area) === key(input.oldArea);
  snapshots.slice(0, 3).forEach((snapshot) => addPatch(
    snapshot,
    { area: newArea, neighborhood: newNeighborhood },
    belongsToSource,
  ));
  snapshots.slice(3, 5).forEach((snapshot) => addPatch(
    snapshot,
    { area: newArea, neighborhood: newNeighborhood },
    (record) => key(record.neighborhood) === key(input.oldNeighborhood) && belongsToSource(record),
  ));
  addPatch(
    snapshots.at(-1),
    { elderlyArea: newArea, elderlyNeighborhood: newNeighborhood },
    (record) => !record.elderlyArea || key(record.elderlyArea) === key(input.oldArea),
  );
  return writes;
}

export async function locationSettingsCore({ db, callerUid, data }) {
  if (!callerUid) throw new HttpsError("unauthenticated", "Authentication required.");
  const input = normalizedInput(data);
  const settingsRef = db.collection("settings").doc("general");
  const userRef = db.collection("users").doc(callerUid);

  return db.runTransaction(async (transaction) => {
    const [user, settings, ...snapshots] = await Promise.all([
      transaction.get(userRef),
      transaction.get(settingsRef),
      ...locationQueries(db, input).map((query) => transaction.get(query)),
    ]);
    if (!user.exists || user.data()?.role !== "admin" || user.data()?.status !== "active") {
      throw new HttpsError("permission-denied", "Administrator access required.");
    }
    if (!settings.exists) throw new HttpsError("not-found", "Location settings were not found.");

    const currentAreas = settings.data()?.areas || [];
    const sourceArea = currentAreas.find((area) => key(area.area) === key(input.oldArea));
    const areas = updateAreas(currentAreas, input);
    const writes = buildReferenceWrites(snapshots, {
      ...input,
      sourceNeighborhoods: sourceArea?.neighborhoods || [],
    });
    const isDelete = input.type === "deleteArea" || input.type === "deleteNeighborhood";
    if (isDelete && writes.size > 0) {
      throw new HttpsError(
        "failed-precondition",
        "The location still has linked records.",
        { reason: "location-in-use", referenceCount: writes.size },
      );
    }
    if (writes.size > MAX_ATOMIC_REFERENCE_WRITES) {
      throw new HttpsError(
        "failed-precondition",
        "The location change exceeds the atomic update limit.",
        { reason: "too-many-references", referenceCount: writes.size },
      );
    }

    if (!isDelete) {
      writes.forEach(({ ref, patch }) => transaction.update(ref, patch));
    }
    transaction.set(
      settingsRef,
      { areas, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return { areas, updatedReferences: writes.size };
  });
}
