import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import {
  SITE_CONTENT_SECTIONS,
  assertActiveAdmin,
  classifyAndCanonicalizeSection,
  enumerateSectionImageFields,
} from "./imageReferencePolicy.js";

const MAX_SECTION_BYTES = 200_000;
const MAX_REFERENCE_WRITES = 450;

const snapshotExists = (snapshot) => (
  typeof snapshot?.exists === "function" ? snapshot.exists() : snapshot?.exists
);

export async function saveSiteContentSectionCore({ db, callerUid, data }) {
  if (!callerUid) throw new HttpsError("unauthenticated", "Authentication required.");
  const sectionKey = String(data?.sectionKey || "");
  if (!SITE_CONTENT_SECTIONS.has(sectionKey)) {
    throw new HttpsError("invalid-argument", "Unknown site content section.");
  }
  const sectionData = data?.sectionData;
  if (!sectionData || typeof sectionData !== "object" || Array.isArray(sectionData)) {
    throw new HttpsError("invalid-argument", "Section data is invalid.");
  }
  if (Buffer.byteLength(JSON.stringify(sectionData), "utf8") > MAX_SECTION_BYTES) {
    throw new HttpsError("invalid-argument", "Section data is too large.");
  }

  const userRef = db.collection("users").doc(callerUid);
  const siteRef = db.collection("siteContent").doc("home");
  const imagesQuery = db.collection("images");

  return db.runTransaction(async (transaction) => {
    const [userSnapshot, siteSnapshot, imagesSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(siteRef),
      transaction.get(imagesQuery),
    ]);
    assertActiveAdmin(userSnapshot);

    const images = imagesSnapshot.docs.map((snapshot) => ({
      id: snapshot.id,
      ref: snapshot.ref,
      ...snapshot.data(),
    }));
    const { nextSection, references, audit } = classifyAndCanonicalizeSection({
      sectionKey,
      sectionData,
      images,
    });

    const refsByImage = new Map();
    for (const descriptor of enumerateSectionImageFields(sectionKey, nextSection)) {
      const imageId = descriptor.value?.imageId;
      if (!imageId) continue;
      const reference = references.find((item) => item.field === descriptor.field);
      if (!reference) continue;
      const items = refsByImage.get(imageId) || [];
      items.push(reference);
      refsByImage.set(imageId, items);
    }

    const imageUpdates = [];
    for (const image of images) {
      const previous = Array.isArray(image.usageRefs) ? image.usageRefs : [];
      const retained = previous.filter((reference) => reference?.section !== sectionKey);
      const next = [...retained, ...(refsByImage.get(image.id) || [])];
      const shouldMarkAsSiteAsset = next.length > 0 && image.siteAsset !== true;
      if (JSON.stringify(previous) !== JSON.stringify(next) || shouldMarkAsSiteAsset) {
        const patch = {
          usageRefs: next,
          usageCount: next.length,
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (shouldMarkAsSiteAsset) patch.siteAsset = true;
        imageUpdates.push({ ref: image.ref, patch });
      }
    }
    if (imageUpdates.length > MAX_REFERENCE_WRITES) {
      throw new HttpsError(
        "resource-exhausted",
        "This section change affects too many image references for one atomic update.",
        { reason: "too-many-image-reference-writes", count: imageUpdates.length },
      );
    }
    imageUpdates.forEach(({ ref, patch }) => transaction.update(ref, patch));

    transaction.set(siteRef, {
      [sectionKey]: nextSection,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      sectionKey,
      sectionData: nextSection,
      usageCount: references.length,
      audit,
      createdSiteDocument: !snapshotExists(siteSnapshot),
    };
  });
}
