import assert from "node:assert/strict";
import test from "node:test";
import {
  getCategoryItems,
  IMAGE_CATEGORIES_TITLE,
  isProtectedCategory,
  isPublicGalleryImage,
  LINK_CATEGORIES_TITLE,
  normalizeCategoryGroups,
  PROMOTIONAL_IMAGE_CATEGORY,
  shouldImageBePublic,
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

test("keeps promotional images publicly readable but out of gallery presentation", () => {
  const promotional = {
    isPublic: true,
    category: PROMOTIONAL_IMAGE_CATEGORY,
  };
  assert.equal(promotional.isPublic, true);
  assert.equal(isPublicGalleryImage(promotional), false);
  assert.equal(isPublicGalleryImage({ isPublic: true, category: "קהילה" }), true);
  assert.equal(isPublicGalleryImage({ isPublic: false, category: "קהילה" }), false);
  assert.equal(shouldImageBePublic(PROMOTIONAL_IMAGE_CATEGORY, false), true);
  assert.equal(shouldImageBePublic("קהילה", false), false);
});
