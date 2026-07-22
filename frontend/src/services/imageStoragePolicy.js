export const PUBLIC_IMAGE_PREFIX = "images/public";
export const PRIVATE_IMAGE_PREFIX = "images/private";
export const LEGACY_IMAGE_PREFIX = "images/";

const safeSegment = (value, fallback = "image") => {
  const cleaned = String(value || "")
    .replace(/[\\/]+/g, "_")
    .replace(/[\u0000-\u001f\u007f]+/g, "_")
    .trim();
  return cleaned || fallback;
};

export function imageStoragePath({ imageId, fileName, isPublic }) {
  const prefix = isPublic ? PUBLIC_IMAGE_PREFIX : PRIVATE_IMAGE_PREFIX;
  return `${prefix}/${safeSegment(imageId, "unassigned")}/${safeSegment(fileName)}`;
}

export function extractFirebaseStoragePath(url) {
  if (typeof url !== "string" || !url) return null;
  if (url.startsWith("gs://")) {
    const slash = url.indexOf("/", 5);
    return slash >= 0 ? decodeURIComponent(url.slice(slash + 1)) : null;
  }
  try {
    const parsed = new URL(url);
    const marker = "/o/";
    const index = parsed.pathname.indexOf(marker);
    return index >= 0 ? decodeURIComponent(parsed.pathname.slice(index + marker.length)) : null;
  } catch {
    return null;
  }
}

export function resolveManagedImagePath(image = {}) {
  const path = typeof image.storagePath === "string" && image.storagePath
    ? image.storagePath
    : extractFirebaseStoragePath(image.url);
  return path?.startsWith(LEGACY_IMAGE_PREFIX) ? path : null;
}

export function isPathPublic(path) {
  return typeof path === "string" && path.startsWith(`${PUBLIC_IMAGE_PREFIX}/`);
}

export function isPathPrivate(path) {
  return typeof path === "string" && path.startsWith(`${PRIVATE_IMAGE_PREFIX}/`);
}

export function planImageMigration(image = {}) {
  const sourcePath = resolveManagedImagePath(image);
  if (!sourcePath) {
    return image.isPublic
      ? { action: "external-public", reason: "external public URL is outside Firebase Storage" }
      : { action: "review", reason: "private metadata points outside managed Firebase Storage" };
  }

  const expectedPublic = image.isPublic === true;
  const pathMatches = expectedPublic ? isPathPublic(sourcePath) : isPathPrivate(sourcePath);
  if (!pathMatches) {
    return { action: "move", sourcePath, targetVisibility: expectedPublic ? "public" : "private" };
  }
  if (!expectedPublic && image.url) {
    return { action: "metadata", sourcePath, patch: { url: "", storagePath: sourcePath } };
  }
  if (image.storagePath !== sourcePath) {
    return { action: "metadata", sourcePath, patch: { storagePath: sourcePath } };
  }
  return { action: "unchanged", sourcePath };
}
