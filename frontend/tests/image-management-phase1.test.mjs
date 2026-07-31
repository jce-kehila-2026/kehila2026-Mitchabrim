import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { planImageGalleryVisibilityBackfill } from "../scripts/image-gallery-visibility-backfill.mjs";

const mediaSource = readFileSync(new URL("../src/admin/Media.jsx", import.meta.url), "utf8");
const serviceSource = readFileSync(new URL("../src/services/imagesService.js", import.meta.url), "utf8");

const bool = (value) => ({ booleanValue: value });
const string = (value) => ({ stringValue: value });
const imageDoc = (id, fields) => ({
  name: `projects/demo/databases/(default)/documents/images/${id}`,
  fields,
  updateTime: "2026-01-01T00:00:00Z",
});

test("backfill preserves legacy gallery behavior and skips explicit documents", () => {
  const documents = [
    imageDoc("gallery", { isPublic: bool(true), category: string("קהילה") }),
    imageDoc("promotional", {
      isPublic: bool(true),
      category: string("תמונות אתר פרסומי"),
    }),
    imageDoc("private", { isPublic: bool(false), category: string("קהילה") }),
    imageDoc("explicit", {
      isPublic: bool(true),
      category: string("קהילה"),
      showInGallery: bool(false),
    }),
  ];
  const result = planImageGalleryVisibilityBackfill(documents);
  assert.equal(result.summary.scanned, 4);
  assert.equal(result.summary.planned, 3);
  assert.equal(result.summary.alreadyExplicit, 1);
  assert.deepEqual(
    result.plans.map(({ showInGallery }) => showInGallery),
    [true, false, false],
  );
});

test("admin UI separates public, gallery, copy and delete actions", () => {
  assert.match(mediaSource, /הפוך לציבורית/);
  assert.match(mediaSource, /הוסף לגלריה/);
  assert.match(mediaSource, /העתקת קישור/);
  assert.match(mediaSource, /מחיקה/);
  assert.match(mediaSource, /IMAGE_ACTION_COPY/);
  assert.match(mediaSource, /pendingImageIds/);
});

test("category changes no longer mutate image visibility", () => {
  assert.doesNotMatch(
    mediaSource,
    /category:\s*e\.target\.value,\s*isPublic:/,
  );
});

test("admin image list is incrementally loaded", () => {
  assert.match(mediaSource, /getImagesPage/);
  assert.match(mediaSource, /טען תמונות נוספות/);
  assert.doesNotMatch(mediaSource, /getAllImages/);
});

test("service persists explicit gallery state and rejects private gallery writes", () => {
  assert.match(serviceSource, /showInGallery:\s*galleryFlag/);
  assert.match(serviceSource, /images\/private-gallery-conflict/);
  assert.match(serviceSource, /isPublic === true \? "make-public" : "make-private"/);
  assert.match(serviceSource, /callImageMutation\(imageOrId,\s*"publish-and-add-gallery"\)/);
});
