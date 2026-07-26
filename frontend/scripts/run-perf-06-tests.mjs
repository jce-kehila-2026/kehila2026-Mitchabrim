import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [siteHook, areasHook, volunteers, heroTopbar] = await Promise.all([
  read("src/hooks/useSiteContent.js"),
  read("src/hooks/useAreasAndNeighborhoods.js"),
  read("src/admin/Volunteers.jsx"),
  read("src/components/admin/HeroTopbar.jsx"),
]);

assert.match(siteHook, /useSyncExternalStore/);
assert.equal(
  (siteHook.match(/subscribeSiteContent\(/g) || []).length,
  1,
  "site content hook must create the Firestore listener in one shared location",
);
assert.match(siteHook, /consumers\.size !== 0/);
assert.match(siteHook, /firestoreUnsubscribe\?\.\(\)/);

assert.match(areasHook, /useSyncExternalStore/);
assert.equal(
  (areasHook.match(/getAreasAndNeighborhoods\(/g) || []).length,
  1,
  "area consumers must share one settings request",
);
assert.match(areasHook, /requestGeneration \+= 1/);
assert.match(areasHook, /currentSnapshot = INITIAL_SNAPSHOT/);

assert.doesNotMatch(
  volunteers,
  /\bgetVolunteersCount\b/,
  "Volunteers must reuse the total returned by getVolunteersStatusCounts",
);
assert.match(volunteers, /setTotalCount\(s\.total\)/);

assert.doesNotMatch(heroTopbar, /\bgetUserByEmail\b/);
assert.doesNotMatch(heroTopbar, /\bauth\.onAuthStateChanged\b/);
assert.match(heroTopbar, /useAuth\(\)/);

console.log("PERF-06 static regression checks passed.");
