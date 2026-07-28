import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("media exposes URL copying only for public images with a persistent URL", () => {
  const source = readFileSync(
    resolve(import.meta.dirname, "../src/admin/Media.jsx"),
    "utf8",
  );
  assert.match(source, /\{img\.isPublic && img\.url && \(/);
  assert.match(source, /navigator\.clipboard\.writeText\(image\.url\)/);
  assert.match(source, /copyPublicImageUrl\(e, img\)/);
  assert.match(source, /העתקת קישור התמונה/);
  assert.doesNotMatch(source, /document\.execCommand\(["']copy/);
});

