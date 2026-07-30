import assert from "node:assert/strict";
import test from "node:test";
import {
  getCategoryItems,
  IMAGE_CATEGORIES_TITLE,
  hasExplicitGalleryVisibility,
  isProtectedCategory,
  isPublicGalleryImage,
  LINK_CATEGORIES_TITLE,
  normalizeCategoryGroups,
  normalizeImageVisibility,
  PROMOTIONAL_IMAGE_CATEGORY,
} from "../src/utils/categorySettings.js";

test("normalizes current settings and injects the protected promotional image category", () => {
  const groups = normalizeCategoryGroups([
    { title: IMAGE_CATEGORIES_TITLE, items: ["אירועים", "אירועים", " "] },
    { title: LINK_CATEGORIES_TITLE, items: ["מסמכים מותאמים"] },
    { title: "קבוצה ישנה", items: ["לא בשימוש"] },
  ]);

  assert.deepEqual(getCategoryItems(groups, IMAGE_CATEGORIES_TITLE), [
    "אירועים",
    PROMOTIONAL_IMAGE_CATEGORY,
  ]);
  assert.deepEqual(getCategoryItems(groups, LINK_CATEGORIES_TITLE), ["מסמכים מותאמים"]);
  assert.equal(groups.length, 2);
});

test("supports the legacy object category schema", () => {
  const groups = normalizeCategoryGroups({
    images: ["קהילה"],
    links: ["טפסים חדשים"],
  });

  assert.deepEqual(getCategoryItems(groups, IMAGE_CATEGORIES_TITLE), [
    "קהילה",
    PROMOTIONAL_IMAGE_CATEGORY,
  ]);
  assert.deepEqual(getCategoryItems(groups, LINK_CATEGORIES_TITLE), ["טפסים חדשים"]);
});

test("marks only the reserved image category as protected", () => {
  assert.equal(
    isProtectedCategory(IMAGE_CATEGORIES_TITLE, PROMOTIONAL_IMAGE_CATEGORY),
    true,
  );
  assert.equal(isProtectedCategory(IMAGE_CATEGORIES_TITLE, "אירועים"), false);
  assert.equal(
    isProtectedCategory(LINK_CATEGORIES_TITLE, PROMOTIONAL_IMAGE_CATEGORY),
    false,
  );
});

test("keeps legacy promotional images out of gallery presentation", () => {
  const promotional = {
    isPublic: true,
    category: PROMOTIONAL_IMAGE_CATEGORY,
  };
  assert.equal(promotional.isPublic, true);
  assert.equal(isPublicGalleryImage(promotional), false);
  assert.equal(isPublicGalleryImage({ isPublic: true, category: "קהילה" }), true);
  assert.equal(isPublicGalleryImage({ isPublic: false, category: "קהילה" }), false);
});

test("explicit gallery visibility is independent from category and requires public access", () => {
  assert.equal(isPublicGalleryImage({
    isPublic: true,
    category: PROMOTIONAL_IMAGE_CATEGORY,
    showInGallery: true,
  }), true);
  assert.equal(isPublicGalleryImage({
    isPublic: true,
    category: "קהילה",
    showInGallery: false,
  }), false);
  assert.equal(isPublicGalleryImage({
    isPublic: false,
    category: "קהילה",
    showInGallery: true,
  }), false);
});

test("normalizes legacy visibility without hiding migration state", () => {
  const legacy = normalizeImageVisibility({ isPublic: true, category: "קהילה" });
  assert.equal(legacy.showInGallery, true);
  assert.equal(legacy.galleryVisibilityLegacy, true);
  const current = normalizeImageVisibility({
    isPublic: true,
    category: "קהילה",
    showInGallery: false,
  });
  assert.equal(current.showInGallery, false);
  assert.equal(current.galleryVisibilityLegacy, false);
  assert.equal(hasExplicitGalleryVisibility(current), true);
});
