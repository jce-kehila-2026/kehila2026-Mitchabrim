import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildElderlySearchFields,
  buildElderlyQueryCriteria,
  buildVolunteerQueryCriteria,
  buildVolunteerSearchFields,
  getEffectiveSearchTerm,
  normalizeSearchText,
  normalizeSearchTerm,
} from "../src/utils/firestoreSearch.js";
import {
  getChangedFieldNames,
  toFirestoreFields,
} from "./perf-05-backfill-search-fields.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [elderlyPage, volunteersPage, elderlyService, volunteersService, paginationHook, debounceHook, indexes, firebaseConfig] =
  await Promise.all([
    read("src/admin/Elderly.jsx"),
    read("src/admin/Volunteers.jsx"),
    read("src/services/elderlyService.js"),
    read("src/services/volunteersService.js"),
    read("src/hooks/useFirestorePagination.js"),
    read("src/hooks/useDebouncedValue.js"),
    read("firestore.indexes.json"),
    read("firebase.json"),
  ]);

assert.match(elderlyPage, /getElderlyPage\(\{ pageSize: PAGE_SIZE, cursor, criteria: queryCriteria \}\)/);
assert.doesNotMatch(elderlyPage, /hasFiltersOrSearch[\s\S]{0,200}ensureFullData/);
assert.match(volunteersPage, /getVolunteersPage\(\{ pageSize: PAGE_SIZE, cursor, criteria: queryCriteria \}\)/);
assert.doesNotMatch(volunteersPage, /getElderly\s*[,}]/);
assert.doesNotMatch(volunteersPage, /visibleVolunteers|filterPageItems|fullElderly/);

for (const service of [elderlyService, volunteersService]) {
  assert.match(service, /startAfter\(cursor\)/);
  assert.match(service, /limit\(pageSize \+ 1\)/);
  assert.match(service, /getCountFromServer/);
  assert.match(service, /where\("searchPrefixes", "array-contains", normalized\.searchTerm\)/);
}

assert.match(elderlyPage, /useDebouncedValue\(search, 300\)/);
assert.match(volunteersPage, /useDebouncedValue\(search, 300\)/);
assert.match(elderlyPage, /getEffectiveSearchTerm\(debouncedSearch\)/);
assert.match(volunteersPage, /getEffectiveSearchTerm\(debouncedSearch\)/);
assert.match(debounceHook, /setTimeout/);
assert.match(elderlyPage, /deps: \[statsVersion, queryKey\]/);
assert.match(volunteersPage, /deps: \[statsVersion, queryKey\]/);
assert.match(paginationHook, /requestVersion/);
assert.match(paginationHook, /version !== requestVersion\.current/);

assert.equal(normalizeSearchTerm(""), "");
assert.equal(normalizeSearchTerm(" 050-123 4567 "), "0501234567");
assert.equal(getEffectiveSearchTerm("א"), "");
assert.equal(getEffectiveSearchTerm("אב"), "אב");
assert.equal(normalizeSearchText("  שרה,   לוי! "), normalizeSearchText("שרה לוי"));
assert.equal(normalizeSearchText("כהן"), normalizeSearchText("כהנ"));
const elderlyFields = buildElderlySearchFields({
  firstName: " מרים ",
  lastName: "לוי",
  mobile: "050-1234567",
  homePhone: "02-555 6677",
  idNum: "012345678",
});
assert.equal(elderlyFields.searchName, normalizeSearchText("מרים לוי"));
assert.ok(elderlyFields.searchPrefixes.includes(normalizeSearchTerm("מר")));
assert.ok(elderlyFields.searchPrefixes.includes(normalizeSearchTerm("לוי")));
assert.ok(elderlyFields.searchPrefixes.includes(normalizeSearchTerm("מריםלוי")));
assert.ok(elderlyFields.searchPrefixes.includes("050"));
assert.ok(elderlyFields.searchPrefixes.includes("02555"));
assert.ok(elderlyFields.searchPrefixes.includes("012345678"));
assert.equal(elderlyFields.searchSchemaVersion, 1);
const volunteerFields = buildVolunteerSearchFields({
  name: "דנה כהן",
  phone: "052-0000000",
  idNum: "987-654-321",
  group: "סטודנטים",
  neighborhood: "רחביה",
  area: "מרכז",
});
assert.ok(volunteerFields.searchPrefixes.includes("דנה"));
assert.ok(volunteerFields.searchPrefixes.includes("סטו"));
assert.ok(volunteerFields.searchPrefixes.includes(normalizeSearchTerm("כהן")));
assert.ok(volunteerFields.searchPrefixes.includes(normalizeSearchTerm("רחביה")));
assert.ok(volunteerFields.searchPrefixes.includes(normalizeSearchTerm("מרכז")));
assert.ok(volunteerFields.searchPrefixes.includes("052000"));
assert.ok(volunteerFields.searchPrefixes.includes("987654321"));
assert.equal(volunteerFields.insuranceKey, "לא");
assert.equal(volunteerFields.searchSchemaVersion, 1);
assert.deepEqual(buildElderlyQueryCriteria({
  area: "מרכז",
  neighborhood: "רחביה",
  marital: "נשוי/אה",
  volStatus: "כן",
  search: "  כהן, ",
}), {
  status: "פעיל",
  area: "מרכז",
  neighborhood: "רחביה",
  marital: "נשוי/אה",
  volStatus: "כן",
  searchTerm: normalizeSearchTerm("כהן"),
});
assert.deepEqual(buildVolunteerQueryCriteria({
  area: "מרכז",
  neighborhood: "רחביה",
  status: "ממתין לשיבוץ",
  insurance: "לא",
  search: " 052-123 ",
}), {
  area: "מרכז",
  neighborhood: "רחביה",
  status: "ממתין לשיבוץ",
  insurance: "לא",
  searchTerm: "052123",
});
assert.equal(buildVolunteerQueryCriteria({ search: "א" }).searchTerm, "");
assert.equal(buildVolunteerQueryCriteria({ search: "" }).searchTerm, "");
assert.match(volunteersService, /where\("insuranceKey", "==", normalized\.insurance\)/);
assert.match(elderlyService, /where\("area", "==", normalized\.area\)/);
assert.match(volunteersService, /where\("area", "==", normalized\.area\)/);

for (const service of [elderlyService, volunteersService]) {
  assert.match(service, /where\("searchSchemaVersion", "==", 1\)/);
}
assert.match(elderlyPage, /stats\.total > stats\.searchIndexed/);
assert.match(volunteersPage, /stats\.total > stats\.searchIndexed/);
assert.doesNotMatch(elderlyPage, /#eef4ff|החיפוש מתבצע ב-Firebase/);
assert.doesNotMatch(volunteersPage, /#eef4ff|החיפוש והסינון מתבצעים ב-Firebase/);
assert.deepEqual(toFirestoreFields({ searchSchemaVersion: 1 }).searchSchemaVersion, { integerValue: "1" });
const expectedRestFields = toFirestoreFields(volunteerFields);
const matchingDocument = { fields: { ...expectedRestFields, unrelated: { stringValue: "preserve-me" } } };
assert.deepEqual(getChangedFieldNames(matchingDocument, volunteerFields), []);
assert.deepEqual(
  getChangedFieldNames(
    { fields: { ...expectedRestFields, searchName: { stringValue: "stale" } } },
    volunteerFields,
  ),
  ["searchName"],
);

for (const service of [elderlyService, volunteersService]) {
  assert.match(service, /\.\.\.searchFields/);
  assert.match(service, /build\w+SearchFields/);
}

const parsedIndexes = JSON.parse(indexes);
assert.ok(parsedIndexes.indexes.some((index) =>
  index.collectionGroup === "elderly" &&
  index.fields.some((field) => field.fieldPath === "searchPrefixes" && field.arrayConfig === "CONTAINS")
));
assert.equal(JSON.parse(firebaseConfig).firestore.indexes, "firestore.indexes.json");

console.log("PERF-05 regression checks passed.");
