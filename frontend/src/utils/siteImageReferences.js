const MANAGED_IMAGE_KEYS = new Set(["imageId", "imageUrl"]);

export function isManagedSiteImageReference(value) {
  return Boolean(
    value
      && typeof value === "object"
      && !Array.isArray(value)
      && typeof value.imageId === "string"
      && value.imageId.trim()
      && typeof value.imageUrl === "string",
  );
}

export function resolveSiteImageUrl(value) {
  if (typeof value === "string") return value.trim();
  if (isManagedSiteImageReference(value)) return value.imageUrl.trim();
  return "";
}

export function makeSiteImageReference(imageId, imageUrl) {
  return {
    imageId: String(imageId || "").trim(),
    imageUrl: String(imageUrl || "").trim(),
  };
}

export function isSiteImageReferenceShape(value) {
  if (!isManagedSiteImageReference(value)) return false;
  return Object.keys(value).every((key) => MANAGED_IMAGE_KEYS.has(key));
}

