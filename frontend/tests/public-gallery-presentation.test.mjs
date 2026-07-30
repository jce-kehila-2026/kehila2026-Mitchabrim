import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/pages/PublicGallery.jsx", import.meta.url),
  "utf8",
);

test("public gallery uses the exact Hebrew title", () => {
  assert.match(source, />\s*גלריית תמונות\s*</);
  assert.doesNotMatch(source, /גلריית/);
});

test("gallery cards render only the image without metadata", () => {
  assert.match(source, /objectFit:\s*"cover"/);
  assert.doesNotMatch(source, /\{img\.title\}|\{img\.displayDate\}|\{img\.notes\}/);
});

test("category filters and public image loading remain present", () => {
  assert.match(source, /getPublicGalleryImages/);
  assert.match(source, /handleCategoryChange/);
  assert.match(source, /categories\.map/);
});
