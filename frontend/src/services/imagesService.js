// Gallery metadata and Firebase Storage lifecycle.
// SEC-03: managed files are separated into public/private paths. Private
// metadata never persists a Firebase download-token URL.

import { db, storage, getSecureFunctions } from "../firebase";
import {
  collection,
  getDocs,
  getDoc,
  query,
  where,
  limit,
  orderBy,
  documentId,
  startAfter,
  setDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  getBlob,
  deleteObject,
} from "firebase/storage";
import {
  imageStoragePath,
  resolveManagedImagePath,
  validateGalleryImage,
} from "./imageStoragePolicy";
import { retrySafeRead } from "../utils/errorPolicy";
import {
  isPublicGalleryImage,
  normalizeImageVisibility,
} from "../utils/categorySettings";

const IMAGES_COLLECTION = "images";

const runtimePreviewUrl = (blob) => (
  typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
    ? URL.createObjectURL(blob)
    : ""
);

const normalizeManagedImage = (image) => normalizeImageVisibility({
  ...image,
  status: image?.status || "active",
  siteAsset: image?.siteAsset === true,
  siteAssetLegacy: typeof image?.siteAsset !== "boolean",
  usageRefs: Array.isArray(image?.usageRefs) ? image.usageRefs : [],
  usageCount: Number.isInteger(image?.usageCount)
    ? image.usageCount
    : (Array.isArray(image?.usageRefs) ? image.usageRefs.length : 0),
});

export async function loadAdminImagePreview(image) {
  if (image.isPublic) return image;
  const path = resolveManagedImagePath(image);
  if (!path) return image;
  try {
    const blob = await getBlob(ref(storage, path));
    return { ...image, url: runtimePreviewUrl(blob), previewIsTemporary: true };
  } catch (error) {
    console.warn("Unable to load private image preview:", image.id, error?.code || error?.message);
    return image;
  }
}

export async function getPublicImages({ max = 500 } = {}) {
  const q = query(collection(db, IMAGES_COLLECTION), where("isPublic", "==", true), limit(max));
  const snap = await retrySafeRead(() => getDocs(q));
  const items = [];
  snap.forEach((d) => {
    const image = normalizeManagedImage({ id: d.id, ...d.data() });
    if (image.status === "active") items.push(image);
  });
  items.sort((a, b) => {
    const timeA = a.uploadedAt?.seconds || a.uploadedAt?.toMillis?.() || 0;
    const timeB = b.uploadedAt?.seconds || b.uploadedAt?.toMillis?.() || 0;
    return timeB - timeA;
  });
  return items;
}

export async function getPublicGalleryImages({ max = 200 } = {}) {
  // Keep one bounded public query during the migration window. The visibility
  // normalizer honors explicit showInGallery and preserves the previous
  // category-based behavior only for documents that have not been backfilled.
  const fetchMax = max <= 10 ? Math.min(50, max * 5) : max;
  const items = await getPublicImages({ max: fetchMax });
  return items.filter(isPublicGalleryImage).slice(0, max);
}

export async function getAllImages() {
  const snap = await retrySafeRead(() => getDocs(collection(db, IMAGES_COLLECTION)));
  return snap.docs
    .map((d) => normalizeManagedImage({ id: d.id, ...d.data() }))
    .filter((image) => image.status === "active");
}

export async function getImagesPage({ pageSize = 24, cursor = null, tab = "all" } = {}) {
  const constraints = [];
  if (tab === "gallery") constraints.push(where("showInGallery", "==", true));
  if (tab === "site") constraints.push(where("siteAsset", "==", true));
  constraints.push(orderBy(documentId()));
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(pageSize));
  const snap = await retrySafeRead(() => getDocs(query(
    collection(db, IMAGES_COLLECTION),
    ...constraints,
  )));
  return {
    images: snap.docs
      .map((d) => normalizeManagedImage({ id: d.id, ...d.data() }))
      .filter((image) => image.status === "active"),
    cursor: snap.docs.at(-1) || null,
    hasMore: snap.size === pageSize,
  };
}

export async function uploadImage({
  file,
  title,
  category,
  notes,
  isPublic,
  showInGallery,
}) {
  const validation = validateGalleryImage(file);
  if (!validation.valid) {
    const error = new Error(validation.reason === "size"
      ? "Gallery images must not exceed 5MB"
      : "Only image files can be uploaded");
    error.code = "storage/invalid-argument";
    throw error;
  }
  const imageRef = doc(collection(db, IMAGES_COLLECTION));
  const publicFlag = isPublic === true;
  const galleryFlag = publicFlag && showInGallery === true;
  const storagePath = imageStoragePath({ imageId: imageRef.id, fileName: file.name, isPublic: publicFlag });
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);

  try {
    const url = publicFlag ? await getDownloadURL(storageRef) : "";
    const newImageDoc = {
      title,
      category,
      notes: notes || "",
      url,
      storagePath,
      uploadedAt: serverTimestamp(),
      displayDate: new Date().toLocaleDateString("he-IL"),
      isPublic: publicFlag,
      showInGallery: galleryFlag,
      siteAsset: false,
      usageRefs: [],
      usageCount: 0,
      status: "active",
    };
    await setDoc(imageRef, newImageDoc);
    return normalizeManagedImage({ id: imageRef.id, ...newImageDoc });
  } catch (error) {
    await deleteObject(storageRef).catch(() => {});
    throw error;
  }
}

export async function updateImage(imageId, { title, category, notes }) {
  const imageSnap = await getDoc(doc(db, IMAGES_COLLECTION, imageId));
  if (!imageSnap.exists()) throw new Error("Image metadata not found");
  const image = { id: imageSnap.id, ...imageSnap.data() };
  await updateDoc(doc(db, IMAGES_COLLECTION, imageId), { title, category, notes: notes || "" });
  return normalizeManagedImage({ ...image, title, category, notes: notes || "" });
}

async function callImageMutation(imageOrId, operation) {
  const imageId = typeof imageOrId === "string" ? imageOrId : imageOrId?.id;
  if (!imageId) {
    const error = new Error("Image id is required");
    error.code = "images/id-required";
    throw error;
  }
  const functions = await getSecureFunctions();
  const callable = httpsCallable(functions, "mutateImage");
  const response = await callable({ imageId, operation });
  if (!response?.data?.image) {
    const error = new Error("The image operation returned an invalid response");
    error.code = "images/invalid-callable-response";
    throw error;
  }
  return normalizeManagedImage(response.data.image);
}

export async function toggleImagePublic(imageOrId, isPublic) {
  return callImageMutation(
    imageOrId,
    isPublic === true ? "make-public" : "make-private",
  );
}

export async function publishImageToGallery(imageOrId) {
  return callImageMutation(imageOrId, "publish-and-add-gallery");
}

export async function setImageSiteAsset(imageOrId, siteAsset) {
  return callImageMutation(
    imageOrId,
    siteAsset === true ? "add-site-asset" : "remove-site-asset",
  );
}

export async function setImageGalleryVisibility(imageOrId, showInGallery) {
  const imageId = typeof imageOrId === "string" ? imageOrId : imageOrId?.id;
  const snap = await getDoc(doc(db, IMAGES_COLLECTION, imageId));
  if (!snap.exists()) throw new Error("Image metadata not found");
  const image = { id: snap.id, ...snap.data() };
  if (showInGallery === true && image.isPublic !== true) {
    const error = new Error("A private image cannot be shown in the public gallery");
    error.code = "images/private-gallery-conflict";
    throw error;
  }
  await updateDoc(doc(db, IMAGES_COLLECTION, imageId), {
    showInGallery: showInGallery === true,
  });
  return normalizeManagedImage({ ...image, showInGallery: showInGallery === true });
}

export async function deleteImage(image) {
  const imageId = typeof image === "string" ? image : image?.id;
  if (!imageId) {
    const error = new Error("Image id is required");
    error.code = "images/id-required";
    throw error;
  }
  const functions = await getSecureFunctions();
  const callable = httpsCallable(functions, "mutateImage");
  const response = await callable({ imageId, operation: "delete" });
  if (response?.data?.deleted !== true) {
    const error = new Error("The image deletion returned an invalid response");
    error.code = "images/invalid-callable-response";
    throw error;
  }
}

export async function createImageDoc({
  title,
  category,
  notes,
  url,
  displayDate,
  isPublic,
  showInGallery = false,
}) {
  if (isPublic !== true) {
    throw new Error("External image URLs cannot be protected as private Firebase images");
  }
  const newDoc = {
    title,
    category,
    notes: notes || "",
    url,
    uploadedAt: serverTimestamp(),
    displayDate,
    isPublic: true,
    showInGallery: showInGallery === true,
    siteAsset: false,
    usageRefs: [],
    usageCount: 0,
    status: "active",
  };
  const imageRef = doc(collection(db, IMAGES_COLLECTION));
  await setDoc(imageRef, newDoc);
  return normalizeManagedImage({ id: imageRef.id, ...newDoc });
}
