import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { getFlowTrackLength } from "../src/utils/partnersWave.js";

const root = resolve(import.meta.dirname, "..");

test("flow track stays long enough for different viewports and partner counts", () => {
  const cases = [
    { count: 1, spacing: 200, width: 375 },
    { count: 3, spacing: 250, width: 753 },
    { count: 10, spacing: 300, width: 1425 },
    { count: 24, spacing: 300, width: 1920 },
  ];

  for (const { count, spacing, width } of cases) {
    const total = getFlowTrackLength(count, spacing, width);
    assert.ok(Number.isFinite(total));
    assert.ok(total >= width + spacing * 2);
    assert.ok(total >= count * spacing);
  }
});

test("partners wave is full-width, overdraws SVG edges, and clips horizontal overflow", () => {
  const css = readFileSync(resolve(root, "src/styles/public.css"), "utf8");
  const component = readFileSync(
    resolve(root, "src/components/public/PartnersSection.jsx"),
    "utf8",
  );

  assert.match(css, /\.partners-section\s*\{[\s\S]*?overflow-x:\s*clip/);
  assert.match(css, /\.partners-wave-wrap\s*\{[\s\S]*?width:\s*100%/);
  assert.doesNotMatch(css, /\.partners-wave-wrap\s*\{[\s\S]*?max-width:\s*1180px/);
  assert.match(css, /\.partners-wave-svg\s*\{[\s\S]*?left:\s*-2px[\s\S]*?width:\s*calc\(100% \+ 4px\)/);
  assert.match(
    component,
    /className="container"[\s\S]*?partners-header[\s\S]*?<\/div>\s*<\/div>\s*<div\s+className="partners-wave-wrap/,
  );
});
