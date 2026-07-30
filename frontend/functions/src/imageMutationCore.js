import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { assertActiveAdmin } from "./imageReferencePolicy.js";

const ACTIVE_STATUS = "active";
const MAX_USAGE_DETAILS = 25;

const safeFileName = (path) => String(path || "image").split("/").at(-1) || "image";
const targetPath = ({ imageId, sourcePath, isPublic }) => (
  `images/${isPublic ? "public" : "private"}/${imageId}/${safeFileName(sourcePath)}`
);
const isCorrectPath = (path, isPublic) => String(path || "").startsWith(
  `images/${isPublic ? "public" : "private"}/`,
);
const usageDetails = (image) => (Array.isArray(image.usageRefs) ? image.usageRefs : [])
  .slice(0, MAX_USAGE_DETAILS);

export function assertImageMutationAllowed(
  image,
  { deleting = false, makingPrivate = false, removingSiteAsset = false } = {},
) {
  const usages = usageDetails(image);
  const usageCount = Number.isInteger(image.usageCount) ? image.usageCount : usages.length;
  if ((deleting || makingPrivate || removingSiteAsset) && (usages.length || usageCount > 0)) {
    throw new HttpsError(
      "failed-precondition",
      deleting
        ? "The image is used by the public site and cannot be deleted."
        : removingSiteAsset
          ? "The image is currently used by the public site and cannot be removed from site images."
          : "The image is used by the public site and cannot be made private.",
      { reason: "image-in-use", usageCount: usageCount || usages.length, usages },
    );
  }
  if ((deleting || makingPrivate) && image.siteAsset === true) {
    throw new HttpsError(
      "failed-precondition",
      deleting
        ? "Remove the image from site images before deleting it."
        : "Remove the image from site images before making it private.",
      { reason: "image-is-site-asset" },
    );
  }
  if ((deleting || makingPrivate) && image.showInGallery === true) {
    throw new HttpsError(
      "failed-precondition",
      "Remove the image from the gallery before continuing.",
      { reason: "image-in-gallery" },
    );
  }
}

export function assertReferenceMigrationReady(siteData, operation) {
  if (
    (operation === "delete" || operation === "make-private")
    && siteData?.imageReferenceSchemaVersion !== 2
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Image references must be migrated before destructive image operations are enabled.",
      { reason: "image-reference-migration-required" },
    );
  }
}

async function acquireMutation({ db, callerUid, imageId, operation }) {
  const imageRef = db.collection("images").doc(imageId);
  const userRef = db.collection("users").doc(callerUid);
  const siteRef = db.collection("siteContent").doc("home");
  const lockId = randomUUID();
  const image = await db.runTransaction(async (transaction) => {
    const [userSnapshot, imageSnapshot, siteSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(imageRef),
      transaction.get(siteRef),
    ]);
    assertActiveAdmin(userSnapshot);
    if (!imageSnapshot.exists) {
      throw new HttpsError(
        "not-found",
        "Image was not found.",
        { reason: "image-not-found" },
      );
    }
    const current = { id: imageSnapshot.id, ...imageSnapshot.data() };
    assertReferenceMigrationReady(siteSnapshot.data(), operation);
    const resumingDelete = operation === "delete" && current.status === "deleting";
    if (current.status && current.status !== ACTIVE_STATUS && !resumingDelete) {
      throw new HttpsError("failed-precondition", "Image is not active.");
    }
    if (current.mutationLock) {
      throw new HttpsError("aborted", "Another image operation is already running.");
    }
    if (!resumingDelete) {
      assertImageMutationAllowed(current, {
        deleting: operation === "delete",
        makingPrivate: operation === "make-private",
        removingSiteAsset: operation === "remove-site-asset",
      });
    }
    const lockPatch = {
      mutationLock: { id: lockId, operation },
      status: operation === "delete" ? "deleting" : ACTIVE_STATUS,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (operation === "delete") {
      lockPatch.isPublic = false;
      lockPatch.showInGallery = false;
      lockPatch.url = "";
    }
    transaction.update(imageRef, lockPatch);
    return current;
  });
  return { imageRef, image, lockId };
}

async function clearLock(imageRef, lockId, status = ACTIVE_STATUS) {
  await imageRef.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(imageRef);
    if (!snapshot.exists || snapshot.data()?.mutationLock?.id !== lockId) return;
    transaction.update(imageRef, {
      mutationLock: FieldValue.delete(),
      status,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function mutateImageCore({
  db,
  bucket,
  getDownloadUrl,
  callerUid,
  data,
}) {
  if (!callerUid) throw new HttpsError("unauthenticated", "Authentication required.");
  const imageId = String(data?.imageId || "").trim();
  const operation = String(data?.operation || "");
  const supportedOperations = [
    "make-public",
    "make-private",
    "publish-and-add-gallery",
    "add-site-asset",
    "remove-site-asset",
    "delete",
  ];
  if (!imageId || !supportedOperations.includes(operation)) {
    throw new HttpsError("invalid-argument", "Image operation is invalid.");
  }

  const acquired = await acquireMutation({ db, callerUid, imageId, operation });
  const { imageRef, image, lockId } = acquired;
  const sourcePath = String(image.storagePath || "").trim();

  if (operation === "delete") {
    try {
      if (sourcePath) {
        await bucket.file(sourcePath).delete({ ignoreNotFound: true });
      }
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(imageRef);
        if (!snapshot.exists) return;
        if (snapshot.data()?.mutationLock?.id !== lockId) {
          throw new HttpsError("aborted", "Image mutation lock changed.");
        }
        transaction.delete(imageRef);
      });
      return { deleted: true, imageId };
    } catch (error) {
      // Keep the recoverable deleting state. A retry resumes the idempotent
      // Storage deletion and then removes the metadata document.
      await clearLock(imageRef, lockId, "deleting").catch(() => {});
      throw error;
    }
  }

  if (operation === "remove-site-asset") {
    try {
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(imageRef);
        if (!snapshot.exists || snapshot.data()?.mutationLock?.id !== lockId) {
          throw new HttpsError("aborted", "Image mutation lock changed.");
        }
        transaction.update(imageRef, {
          siteAsset: false,
          status: ACTIVE_STATUS,
          mutationLock: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      const updated = await imageRef.get();
      return { image: { id: updated.id, ...updated.data() } };
    } catch (error) {
      await clearLock(imageRef, lockId).catch(() => {});
      throw error;
    }
  }

  const nextIsPublic = operation === "make-public"
    || operation === "publish-and-add-gallery"
    || operation === "add-site-asset";
  if (!sourcePath && !nextIsPublic) {
    await clearLock(imageRef, lockId).catch(() => {});
    throw new HttpsError(
      "failed-precondition",
      "External images cannot be protected as private managed files.",
      { reason: "external-image" },
    );
  }

  const nextPath = sourcePath && !isCorrectPath(sourcePath, nextIsPublic)
    ? targetPath({ imageId, sourcePath, isPublic: nextIsPublic })
    : sourcePath;
  let copied = false;
  try {
    if (sourcePath && nextPath !== sourcePath) {
      await bucket.file(sourcePath).copy(bucket.file(nextPath));
      copied = true;
    }
    const nextUrl = nextIsPublic && nextPath
      ? await getDownloadUrl(bucket.file(nextPath))
      : (nextIsPublic ? String(image.url || "") : "");

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(imageRef);
      if (!snapshot.exists || snapshot.data()?.mutationLock?.id !== lockId) {
        throw new HttpsError("aborted", "Image mutation lock changed.");
      }
      transaction.update(imageRef, {
        isPublic: nextIsPublic,
        showInGallery: operation === "publish-and-add-gallery"
          ? true
          : (nextIsPublic ? snapshot.data()?.showInGallery === true : false),
        siteAsset: operation === "add-site-asset"
          ? true
          : snapshot.data()?.siteAsset === true,
        storagePath: nextPath || FieldValue.delete(),
        url: nextUrl,
        status: ACTIVE_STATUS,
        mutationLock: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    if (copied) {
      try {
        await bucket.file(sourcePath).delete({ ignoreNotFound: true });
      } catch {
        await imageRef.update({
          cleanupSourcePath: sourcePath,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    const updated = await imageRef.get();
    return { image: { id: updated.id, ...updated.data() } };
  } catch (error) {
    if (copied) await bucket.file(nextPath).delete({ ignoreNotFound: true }).catch(() => {});
    await clearLock(imageRef, lockId).catch(() => {});
    throw error;
  }
}
