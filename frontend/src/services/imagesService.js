// Gallery metadata and Firebase Storage lifecycle.
// SEC-03: managed files are separated into public/private paths. Private
// metadata never persists a Firebase download-token URL.

import { db, storage } from "../firebase";
import {
  collection,
  getDocs,
  getDoc,
  query,
  where,
  limit,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  getBlob,
  getMetadata,
  deleteObject,
} from "firebase/storage";
import {
  imageStoragePath,
  isPathPrivate,
  isPathPublic,
  resolveManagedImagePath,
  validateGalleryImage,
} from "./imageStoragePolicy";
import { retrySafeRead } from "../utils/errorPolicy";
import {
  isPublicGalleryImage,
  PROMOTIONAL_IMAGE_CATEGORY,
  shouldImageBePublic,
} from "../utils/categorySettings";

const IMAGES_COLLECTION = "images";

const objectMetadata = (metadata = {}) => ({
  contentType: metadata.contentType || undefined,
  cacheControl: metadata.cacheControl || undefined,
  contentDisposition: metadata.contentDisposition || undefined,
  customMetadata: metadata.customMetadata || undefined,
});

const runtimePreviewUrl = (blob) => (
  typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
    ? URL.createObjectURL(blob)
    : ""
);

function fileNameFromPath(path) {
  return String(path || "image").split("/").at(-1) || "image";
}

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
  snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
  items.sort((a, b) => {
    const timeA = a.uploadedAt?.seconds || a.uploadedAt?.toMillis?.() || 0;
    const timeB = b.uploadedAt?.seconds || b.uploadedAt?.toMillis?.() || 0;
    return timeB - timeA;
  });
  return items;
}

export async function getPublicGalleryImages({ max = 200 } = {}) {
  // Firestore cannot express "public AND category != X" without changing the
  // query/index contract. Keep the read bounded, then exclude the reserved
  // promotional category from gallery presentation.
  const fetchMax = max <= 10 ? Math.min(50, max * 5) : max;
  const items = await getPublicImages({ max: fetchMax });
  return items.filter(isPublicGalleryImage).slice(0, max);
}

export async function getAllImages() {
  const snap = await retrySafeRead(() => getDocs(collection(db, IMAGES_COLLECTION)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function uploadImage({ file, title, category, notes, isPublic }) {
  const validation = validateGalleryImage(file);
  if (!validation.valid) {
    const error = new Error(validation.reason === "size"
      ? "Gallery images must not exceed 5MB"
      : "Only image files can be uploaded");
    error.code = "storage/invalid-argument";
    throw error;
  }
  const imageRef = doc(collection(db, IMAGES_COLLECTION));
  const publicFlag = shouldImageBePublic(category, isPublic);
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
    };
    await setDoc(imageRef, newImageDoc);
    return { id: imageRef.id, ...newImageDoc };
  } catch (error) {
    await deleteObject(storageRef).catch(() => {});
    throw error;
  }
}

async function moveManagedImage(image, nextIsPublic) {
  const sourcePath = resolveManagedImagePath(image);
  if (!sourcePath) {
    throw new Error("External image visibility cannot be made private by Firebase Storage");
  }

  const alreadyCorrect = nextIsPublic ? isPathPublic(sourcePath) : isPathPrivate(sourcePath);
  if (alreadyCorrect) {
    const url = nextIsPublic ? (image.url || await getDownloadURL(ref(storage, sourcePath))) : "";
    await updateDoc(doc(db, IMAGES_COLLECTION, image.id), {
      isPublic: nextIsPublic,
      storagePath: sourcePath,
      url,
    });
    return { ...image, isPublic: nextIsPublic, storagePath: sourcePath, url };
  }

  const sourceRef = ref(storage, sourcePath);
  const [blob, metadata] = await Promise.all([getBlob(sourceRef), getMetadata(sourceRef)]);
  const targetPath = imageStoragePath({
    imageId: image.id,
    fileName: fileNameFromPath(sourcePath),
    isPublic: nextIsPublic,
  });
  const targetRef = ref(storage, targetPath);
  await uploadBytes(targetRef, blob, objectMetadata(metadata));

  const nextUrl = nextIsPublic ? await getDownloadURL(targetRef) : "";
  const originalHadStoragePath = typeof image.storagePath === "string" && image.storagePath.length > 0;
  const rollbackPatch = {
    isPublic: image.isPublic === true,
    url: image.url || "",
    storagePath: originalHadStoragePath ? image.storagePath : deleteField(),
  };

  try {
    await updateDoc(doc(db, IMAGES_COLLECTION, image.id), {
      isPublic: nextIsPublic,
      storagePath: targetPath,
      url: nextUrl,
    });
    await deleteObject(sourceRef);
  } catch (error) {
    await updateDoc(doc(db, IMAGES_COLLECTION, image.id), rollbackPatch).catch(() => {});
    await deleteObject(targetRef).catch(() => {});
    throw error;
  }

  return {
    ...image,
    isPublic: nextIsPublic,
    storagePath: targetPath,
    url: nextUrl,
  };
}

export async function updateImage(imageId, { title, category, notes, isPublic }) {
  const imageSnap = await getDoc(doc(db, IMAGES_COLLECTION, imageId));
  if (!imageSnap.exists()) throw new Error("Image metadata not found");
  let image = { id: imageSnap.id, ...imageSnap.data() };
  const nextIsPublic = shouldImageBePublic(category, isPublic);
  if (image.isPublic !== nextIsPublic) {
    image = await moveManagedImage(image, nextIsPublic);
  }
  await updateDoc(doc(db, IMAGES_COLLECTION, imageId), { title, category, notes: notes || "" });
  return { ...image, title, category, notes: notes || "" };
}

export async function toggleImagePublic(imageOrId, isPublic) {
  const imageId = typeof imageOrId === "string" ? imageOrId : imageOrId?.id;
  const snap = await getDoc(doc(db, IMAGES_COLLECTION, imageId));
  if (!snap.exists()) throw new Error("Image metadata not found");
  const image = { id: snap.id, ...snap.data() };
  if (image.category === PROMOTIONAL_IMAGE_CATEGORY && isPublic !== true) {
    return image;
  }
  return moveManagedImage(image, isPublic === true);
}

export async function deleteImage(image) {
  const storagePath = resolveManagedImagePath(image);
  if (storagePath) {
    await deleteObject(ref(storage, storagePath)).catch((error) => {
      if (error?.code !== "storage/object-not-found") throw error;
    });
  }
  await deleteDoc(doc(db, IMAGES_COLLECTION, image.id));
}

export async function createImageDoc({ title, category, notes, url, displayDate, isPublic }) {
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
  };
  const imageRef = doc(collection(db, IMAGES_COLLECTION));
  await setDoc(imageRef, newDoc);
  return { id: imageRef.id, ...newDoc };
}
