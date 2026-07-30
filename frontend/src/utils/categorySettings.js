export const IMAGE_CATEGORIES_TITLE = "קטגוריות תמונות";
export const LINK_CATEGORIES_TITLE = "קטגוריות קישורים";
export const PROMOTIONAL_IMAGE_CATEGORY = "תמונות אתר פרסומי";

export const DEFAULT_IMAGE_CATEGORIES = [
  "פרלמנטים",
  "מתנדבים",
  "חגים",
  "שיווק",
  "כרטיסי ברכה",
  PROMOTIONAL_IMAGE_CATEGORY,
];

export const DEFAULT_LINK_CATEGORIES = [
  "טפסים",
  "מסמכים",
  "תקשורת",
  "קישורים חיצוניים",
];

const cleanItems = (items) => (
  [...new Set((Array.isArray(items) ? items : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean))]
);

export function normalizeCategoryGroups(rawCategories) {
  let groups = [];
  if (Array.isArray(rawCategories)) {
    groups = rawCategories;
  } else if (rawCategories && typeof rawCategories === "object") {
    groups = Object.entries(rawCategories).map(([key, items]) => ({
      title: key === "images"
        ? IMAGE_CATEGORIES_TITLE
        : key === "links"
          ? LINK_CATEGORIES_TITLE
          : key,
      items,
    }));
  }

  const byTitle = new Map(groups.map((group) => [group?.title, group]));
  const imageGroupExists = byTitle.has(IMAGE_CATEGORIES_TITLE);
  const linkGroupExists = byTitle.has(LINK_CATEGORIES_TITLE);
  const imageItems = cleanItems(
    imageGroupExists ? byTitle.get(IMAGE_CATEGORIES_TITLE)?.items : DEFAULT_IMAGE_CATEGORIES,
  );

  if (!imageItems.includes(PROMOTIONAL_IMAGE_CATEGORY)) {
    imageItems.push(PROMOTIONAL_IMAGE_CATEGORY);
  }

  return [
    { title: IMAGE_CATEGORIES_TITLE, items: imageItems },
    {
      title: LINK_CATEGORIES_TITLE,
      items: cleanItems(
        linkGroupExists ? byTitle.get(LINK_CATEGORIES_TITLE)?.items : DEFAULT_LINK_CATEGORIES,
      ),
    },
  ];
}

export function getCategoryItems(groups, title) {
  return groups.find((group) => group.title === title)?.items || [];
}

export function isProtectedCategory(groupTitle, item) {
  return groupTitle === IMAGE_CATEGORIES_TITLE && item === PROMOTIONAL_IMAGE_CATEGORY;
}

export function isPublicGalleryImage(image) {
  if (image?.isPublic !== true) return false;
  if (typeof image?.showInGallery === "boolean") return image.showInGallery;
  // Compatibility for documents created before showInGallery existed.
  return image?.category !== PROMOTIONAL_IMAGE_CATEGORY;
}

export function hasExplicitGalleryVisibility(image) {
  return typeof image?.showInGallery === "boolean";
}

export function normalizeImageVisibility(image) {
  return {
    ...image,
    showInGallery: isPublicGalleryImage(image),
    galleryVisibilityLegacy: !hasExplicitGalleryVisibility(image),
  };
}
