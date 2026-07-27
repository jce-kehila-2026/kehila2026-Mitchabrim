import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  digitsInput,
  normalizeLanguages,
  sortElderlyRecords,
  updateAreasModel,
  validateBirthDate,
  validateElderlyNumbers,
} from "../src/utils/elderlyFormModel.js";
import { validateElderlyData } from "../functions/src/elderlyMutationCore.js";

test("elderly identifiers enforce exact lengths and preserve leading zeroes", () => {
  assert.deepEqual(validateElderlyNumbers({
    idNum: "012345678",
    mobile: "0501234567",
    homePhone: "021234567",
  }), {});
  assert.equal(digitsInput("0a50-12", 10), "05012");
  for (const length of [8, 10, 11]) {
    assert.ok(validateElderlyNumbers({
      idNum: "1".repeat(length),
      mobile: "0".repeat(10),
    }).idNum);
  }
  for (const length of [8, 9, 11]) {
    assert.ok(validateElderlyNumbers({
      idNum: "0".repeat(9),
      mobile: "1".repeat(length),
    }).mobile);
  }
  for (const length of [8, 10, 11]) {
    assert.ok(validateElderlyNumbers({
      idNum: "0".repeat(9),
      mobile: "0".repeat(10),
      homePhone: "2".repeat(length),
    }).homePhone);
  }
});

test("birth dates reject impossible, incomplete and future values", () => {
  const today = new Date(2026, 6, 27);
  assert.equal(validateBirthDate("1940-02-29", today), "");
  assert.ok(validateBirthDate("2025-02-29", today));
  assert.ok(validateBirthDate("2026-7-2", today));
  assert.ok(validateBirthDate("2027-01-01", today));
});

test("server mutation validation enforces the same string formats", () => {
  assert.doesNotThrow(() => validateElderlyData({
    idNum: "012345678",
    mobile: "0501234567",
    homePhone: "021234567",
    birth: "1940-02-29",
    languages: ["עברית", "ערבית"],
  }));
  assert.throws(() => validateElderlyData({ mobile: "501234567" }));
  assert.throws(() => validateElderlyData({ mobile: "0501234567", homePhone: "0212345678" }));
  assert.throws(() => validateElderlyData({ mobile: "0501234567", birth: "2999-01-01" }));
});

test("legacy single language and new multiple languages normalize without duplicates", () => {
  assert.deepEqual(normalizeLanguages({ language: "עברית" }), ["עברית"]);
  assert.deepEqual(
    normalizeLanguages({ languages: [" עברית ", "ערבית", "עברית"] }),
    ["עברית", "ערבית"],
  );
});

test("elderly records sort by Hebrew name, neighborhood and latest contact", () => {
  const records = [
    { id: "1", firstName: "שרה", lastName: "כהן", neighborhood: "רחביה", lastContact: "" },
    { id: "2", firstName: "אברהם", lastName: "לוי", neighborhood: "גילה", lastContact: "2026-01-10" },
    { id: "3", firstName: "מרים", lastName: "אדרי", neighborhood: "גילה", lastContact: "2026-06-20" },
  ];
  assert.deepEqual(
    sortElderlyRecords(records, "לפי האלף-בית").map((item) => item.id),
    ["2", "3", "1"],
  );
  assert.deepEqual(
    sortElderlyRecords(records, "לפי שכונות").map((item) => item.id),
    ["2", "3", "1"],
  );
  assert.deepEqual(
    sortElderlyRecords(records, "לפי קשר אחרון").map((item) => item.id),
    ["3", "2", "1"],
  );
  assert.deepEqual(
    sortElderlyRecords(records, "צפיות אחרונות", ["1", "3"]).map((item) => item.id),
    ["1", "3", "2"],
  );
});

const areas = [
  { area: "מרכז", neighborhoods: ["רחביה", "קטמון"] },
  { area: "דרום", neighborhoods: ["גילה"] },
];

test("area and neighborhood names can be renamed without losing children", () => {
  const renamedArea = updateAreasModel(areas, {
    type: "renameArea", oldArea: "מרכז", newArea: "מרכז העיר",
  });
  assert.deepEqual(
    renamedArea.find((area) => area.area === "מרכז העיר").neighborhoods,
    ["קטמון", "רחביה"],
  );
  const renamedNeighborhood = updateAreasModel(areas, {
    type: "renameNeighborhood",
    oldArea: "מרכז",
    oldNeighborhood: "רחביה",
    newNeighborhood: "רחביה החדשה",
  });
  assert.ok(renamedNeighborhood.some((area) => area.neighborhoods.includes("רחביה החדשה")));
});

test("neighborhood moves between areas and duplicates are rejected", () => {
  const moved = updateAreasModel(areas, {
    type: "moveNeighborhood",
    oldArea: "מרכז",
    oldNeighborhood: "קטמון",
    targetArea: "דרום",
  });
  assert.equal(moved.find((area) => area.area === "מרכז").neighborhoods.includes("קטמון"), false);
  assert.equal(moved.find((area) => area.area === "דרום").neighborhoods.includes("קטמון"), true);
  assert.throws(() => updateAreasModel(areas, {
    type: "renameArea", oldArea: "מרכז", newArea: " דרום ",
  }));
});

test("forms and callable use the shared validation and safe reference update flow", () => {
  const root = resolve(import.meta.dirname, "..");
  const elderly = readFileSync(resolve(root, "src/admin/Elderly.jsx"), "utf8");
  const settings = readFileSync(resolve(root, "src/admin/Settings.jsx"), "utf8");
  const settingsService = readFileSync(resolve(root, "src/services/settingsService.js"), "utf8");
  const functionsIndex = readFileSync(resolve(root, "functions/index.js"), "utf8");
  assert.match(elderly, /validateElderlyNumbers/);
  assert.match(elderly, /validateBirthDate/);
  assert.match(elderly, /languages\.join\(", "\)/);
  assert.match(elderly, /handleAddLanguage/);
  const elderlyPage = elderly.slice(
    elderly.indexOf("export default function Elderly"),
    elderly.indexOf("function ElderlyFormModal"),
  );
  const elderlyForm = elderly.slice(elderly.indexOf("function ElderlyFormModal"));
  assert.match(elderlyPage, /const markElderlyViewed =/);
  assert.doesNotMatch(elderlyForm, /const markElderlyViewed =/);
  assert.match(elderlyPage, /const usingClientSort = Boolean\(sortMode && fullData\)/);
  assert.match(settingsService, /transaction\.set\(ref, \{ languages: next \}/);
  assert.match(settingsService, /if \(!import\.meta\.env\.DEV\)/);
  assert.match(settingsService, /updateLocationSettingsLocally/);
  assert.match(settingsService, /offset \+= 400/);
  assert.doesNotMatch(
    settingsService,
    /collectionGroup\(db, "participants"\), where\("(?:area|neighborhood)"/,
  );
  assert.match(settings, /updateLocationSettings/);
  assert.match(settings, /requestMoveNeighborhood/);
  assert.match(settings, /EllipsisVertical/);
  assert.match(settings, /label: "העברה"/);
  assert.match(functionsIndex, /export const updateLocationSettings = onCall/);
});
