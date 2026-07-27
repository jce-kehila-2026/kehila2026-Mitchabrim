import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

const clean = (value) => String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ");
const key = (value) => clean(value).toLocaleLowerCase("he");

function updateAreas(areas, input) {
  const next = (areas || []).map((area) => ({
    area: clean(area.area),
    neighborhoods: (area.neighborhoods || []).map(clean).filter(Boolean),
  }));
  const source = next.find((area) => key(area.area) === key(input.oldArea));
  if (!source) throw new HttpsError("not-found", "Source area was not found.");
  if (input.type === "renameArea") {
    if (!input.newArea || next.some((area) => area !== source && key(area.area) === key(input.newArea))) {
      throw new HttpsError("already-exists", "Area name is empty or already exists.");
    }
    source.area = input.newArea;
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
    }
  }
  return next
    .sort((a, b) => a.area.localeCompare(b.area, "he"))
    .map((area) => ({
      ...area,
      neighborhoods: area.neighborhoods.sort((a, b) => a.localeCompare(b, "he")),
    }));
}

async function assertAdmin(db, callerUid) {
  if (!callerUid) throw new HttpsError("unauthenticated", "Authentication required.");
  const user = await db.collection("users").doc(callerUid).get();
  if (!user.exists || user.data()?.role !== "admin" || user.data()?.status !== "active") {
    throw new HttpsError("permission-denied", "Administrator access required.");
  }
}

const normalizedInput = (raw) => {
  const input = {
    type: raw?.type,
    oldArea: clean(raw?.oldArea),
    newArea: clean(raw?.newArea),
    oldNeighborhood: clean(raw?.oldNeighborhood),
    newNeighborhood: clean(raw?.newNeighborhood),
    targetArea: clean(raw?.targetArea),
  };
  if (!["renameArea", "renameNeighborhood", "moveNeighborhood"].includes(input.type)) {
    throw new HttpsError("invalid-argument", "Unknown location change.");
  }
  return input;
};

export async function locationSettingsCore({ db, callerUid, data }) {
  await assertAdmin(db, callerUid);
  const input = normalizedInput(data);
  const settingsRef = db.collection("settings").doc("general");
  const settings = await settingsRef.get();
  const areas = updateAreas(settings.data()?.areas || [], input);
  const writes = new Map();
  const addPatch = (snapshot, patch, belongsToSource = () => true) => snapshot.docs.forEach((item) => {
    if (!belongsToSource(item.data())) return;
    const current = writes.get(item.ref.path) || { ref: item.ref, patch: {} };
    current.patch = { ...current.patch, ...patch, updatedAt: FieldValue.serverTimestamp() };
    writes.set(item.ref.path, current);
  });

  if (input.type === "renameArea") {
    const collections = ["elderly", "volunteers", "parliaments"];
    const snapshots = await Promise.all([
      ...collections.map((name) => db.collection(name).where("area", "==", input.oldArea).get()),
      db.collectionGroup("elderlyParticipants").get(),
      db.collectionGroup("participants").get(),
      db.collection("elderlyContacts").where("elderlyArea", "==", input.oldArea).get(),
    ]);
    snapshots.slice(0, 3).forEach((snapshot) => addPatch(snapshot, { area: input.newArea }));
    snapshots.slice(3, 5).forEach((snapshot) => addPatch(
      snapshot,
      { area: input.newArea },
      (record) => key(record.area) === key(input.oldArea),
    ));
    addPatch(snapshots.at(-1), { elderlyArea: input.newArea });
  } else {
    const newNeighborhood = input.type === "renameNeighborhood"
      ? input.newNeighborhood
      : input.oldNeighborhood;
    const newArea = input.type === "moveNeighborhood" ? input.targetArea : input.oldArea;
    const [elderly, volunteers, parliaments, projectParticipants, parliamentParticipants, contacts] = await Promise.all([
      db.collection("elderly").where("neighborhood", "==", input.oldNeighborhood).get(),
      db.collection("volunteers").where("neighborhood", "==", input.oldNeighborhood).get(),
      db.collection("parliaments").where("neighborhood", "==", input.oldNeighborhood).get(),
      db.collectionGroup("elderlyParticipants").get(),
      db.collectionGroup("participants").get(),
      db.collection("elderlyContacts").where("elderlyNeighborhood", "==", input.oldNeighborhood).get(),
    ]);
    const belongsToSource = (record) => !record.area || key(record.area) === key(input.oldArea);
    [elderly, volunteers, parliaments].forEach(
      (snapshot) => addPatch(
        snapshot,
        { area: newArea, neighborhood: newNeighborhood },
        belongsToSource,
      ),
    );
    [projectParticipants, parliamentParticipants].forEach((snapshot) => addPatch(
      snapshot,
      { area: newArea, neighborhood: newNeighborhood },
      (record) => key(record.neighborhood) === key(input.oldNeighborhood)
        && belongsToSource(record),
    ));
    addPatch(
      contacts,
      { elderlyArea: newArea, elderlyNeighborhood: newNeighborhood },
      (record) => !record.elderlyArea || key(record.elderlyArea) === key(input.oldArea),
    );
  }

  const writer = db.bulkWriter();
  writes.forEach(({ ref, patch }) => writer.update(ref, patch));
  await writer.close();
  await settingsRef.set({ areas, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { areas, updatedReferences: writes.size };
}
