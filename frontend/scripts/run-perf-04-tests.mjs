import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import { glob } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const heroNames = [
  "dashboard_hero",
  "elderly-hero-bg",
  "elderly_contacts_hero",
  "finance_hero",
  "gallery_hero",
  "links_hero",
  "main_website_hero",
  "organizations_hero",
  "parliaments_hero",
  "projects_hero",
  "reports_hero",
  "setting_hero",
  "volunteer_reports_tasks_hero",
  "volunteers_hero",
];

for (const name of heroNames) {
  for (const suffix of [".webp", "-mobile.webp"]) {
    const path = `public/admin-heroes/${name}${suffix}`;
    await access(new URL(path, root));
    const info = await stat(new URL(path, root));
    assert.ok(info.size < 60_000, `${path} should stay below 60 KB`);
  }
}

const logo = await stat(new URL("public/logo.webp", root));
assert.ok(logo.size < 100_000, "optimized logo should stay below 100 KB");

let source = "";
for await (const path of glob("src/**/*.{js,jsx,css,json}", { cwd: new URL("..", import.meta.url) })) {
  source += await read(path.replaceAll("\\", "/"));
}

assert.doesNotMatch(source, /admin-heroes\/[^"'()]+\.png/);
assert.doesNotMatch(source, /(?:src=|from )["'][^"']*logo\.png/);
assert.doesNotMatch(
  source,
  /__l5e|assets-v1|\.asset\.json/,
  "Legacy Lovable asset identifiers and runtime metadata references must not remain",
);
assert.match(source, /--admin-hero-mobile-image/);
assert.match(source, /loading="lazy"/);

console.log("PERF-04 asset and loading regression checks passed.");
