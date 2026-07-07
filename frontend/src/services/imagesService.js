// src/services/imagesService.js
// Service layer for the "images" gallery collection and its Storage files.
//
// Public read path (getPublicImages) is used by the public /gallery and
// homepage. Admin flows (list/upload/edit/delete/toggle) are used by
// src/admin/Media.jsx. Firestore collection name ("images") and document
// fields (title, category, notes, url, uploadedAt, displayDate, isPublic)
// are unchanged. Storage path convention ("images/<ts>_<filename>") is
// unchanged.

import { db, storage } from "../firebase";
import {
  collection,
  getDocs,
  query,
  where,
  limit,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

const IMAGES_COLLECTION = "images";
const IMAGES_STORAGE_FOLDER = "images";

/**
 * Fetch all public images (isPublic == true), up to a hard cap.
 * Firestore rules require the where("isPublic","==",true) filter
 * for anonymous reads to succeed.
 *
 * Returns { id, ...docData }[] sorted by uploadedAt desc when available.
 * Callers do their own category filtering / slicing.
 *
 * Collection: "images" (unchanged)
 */
export async function getPublicImages({ max = 500 } = {}) {
  const q = query(
    collection(db, IMAGES_COLLECTION),
    where("isPublic", "==", true),
    limit(max)
  );
  const snap = await getDocs(q);
  const items = [];
  snap.forEach((d) => items.push({ id: d.id, ...d.data() }));

  items.sort((a, b) => {
    const timeA = a.uploadedAt?.seconds || a.uploadedAt?.toMillis?.() || 0;
    const timeB = b.uploadedAt?.seconds || b.uploadedAt?.toMillis?.() || 0;
    return timeB - timeA;
  });

  return items;
}

/**
 * Admin-only: list every image document (public and private).
 * Firestore rules require isAdmin() for unfiltered list access.
 * Returns { id, ...docData }[] in whatever order Firestore returns.
 */
export async function getAllImages() {
  const snap = await getDocs(collection(db, IMAGES_COLLECTION));
  const items = [];
  snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
  return items;
}

/**
 * Admin-only: upload an image File to Storage and create its Firestore doc.
 * Preserves the original Media.jsx behavior exactly:
 *   1. Upload to `images/<Date.now()>_<file.name>`
 *   2. getDownloadURL
 *   3. addDoc({ title, category, notes, url, uploadedAt: serverTimestamp(),
 *              displayDate: today he-IL, isPublic })
 *
 * Returns { id, ...newImageDoc } so the caller can update local state.
 */
export async function uploadImage({ file, title, category, notes, isPublic }) {
  const storageRef = ref(
    storage,
    `${IMAGES_STORAGE_FOLDER}/${Date.now()}_${file.name}`
  );
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  const todayDate = new Date().toLocaleDateString("he-IL");

  const newImageDoc = {
    title,
    category,
    notes: notes || "",
    url,
    uploadedAt: serverTimestamp(),
    displayDate: todayDate,
    isPublic: isPublic || false,
  };

  const docRef = await addDoc(collection(db, IMAGES_COLLECTION), newImageDoc);
  return { id: docRef.id, ...newImageDoc };
}

/**
 * Admin-only: update the editable fields of an image doc.
 * Preserves the exact field list from Media.jsx handleUpdateImageDetails.
 */
export async function updateImage(imageId, { title, category, notes, isPublic }) {
  await updateDoc(doc(db, IMAGES_COLLECTION, imageId), {
    title,
    category,
    notes: notes || "",
    isPublic: isPublic || false,
  });
}

/**
 * Admin-only: toggle only the isPublic flag on an image doc.
 */
export async function toggleImagePublic(imageId, isPublic) {
  await updateDoc(doc(db, IMAGES_COLLECTION, imageId), { isPublic });
}

/**
 * Admin-only: delete an image.
 *
 * Preserves the exact order from the original Media.jsx:
 *   1. deleteDoc(images/{id})
 *   2. deleteObject(storage ref built from image.url)
 *
 * The Storage delete may throw for legacy/mock docs whose `url` is not a
 * Storage download URL (e.g. seeded Unsplash URLs). The caller keeps the
 * try/catch that already surrounded this flow so error surfacing stays
 * identical to the previous behavior.
 */
export async function deleteImage(image) {
  await deleteDoc(doc(db, IMAGES_COLLECTION, image.id));
  const imageStorageRef = ref(storage, image.url);
  await deleteObject(imageStorageRef);
}

/**
 * Admin-only: create a raw image doc (no Storage upload). Used by the
 * "seed mock images" dev helper which references external Unsplash URLs.
 * Preserves the exact fields written by the original Media.jsx.
 */
export async function createImageDoc({
  title,
  category,
  notes,
  url,
  displayDate,
  isPublic,
}) {
  const newDoc = {
    title,
    category,
    notes: notes || "",
    url,
    uploadedAt: serverTimestamp(),
    displayDate,
    isPublic: !!isPublic,
  };
  const docRef = await addDoc(collection(db, IMAGES_COLLECTION), newDoc);
  return { id: docRef.id, ...newDoc };
}
