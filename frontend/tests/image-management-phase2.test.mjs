import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  classifyAndCanonicalizeSection,
  enumerateSectionImageFields,
} from "../functions/src/imageReferencePolicy.js";
import {
  assertImageMutationAllowed,
  assertReferenceMigrationReady,
} from "../functions/src/imageMutationCore.js";
import { saveSiteContentSectionCore } from "../functions/src/siteContentImageCore.js";
import { planSiteImageReferenceMigration } from "../scripts/site-image-reference-migration.mjs";
import {
  isManagedSiteImageReference,
  resolveSiteImageUrl,
} from "../src/utils/siteImageReferences.js";

const stringValue = (value) => ({ stringValue: value });
const boolValue = (value) => ({ booleanValue: value });
const mapValue = (value) => ({
  mapValue: {
    fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      typeof item === "string" ? stringValue(item) : mapValue(item),
    ])),
  },
});

test("managed site image references preserve imageUrl compatibility", () => {
  const value = { imageId: "img-1", imageUrl: "https://example.test/image.jpg" };
  assert.equal(isManagedSiteImageReference(value), true);
  assert.equal(resolveSiteImageUrl(value), value.imageUrl);
  assert.equal(resolveSiteImageUrl(value.imageUrl), value.imageUrl);
});

test("site content canonicalization matches one managed image and never guesses external URLs", () => {
  const section = {
    imageMain: "https://cdn.test/hero.jpg",
    imageTopLeft: "https://external.test/other.jpg",
    imageBottom: "",
  };
  const result = classifyAndCanonicalizeSection({
    sectionKey: "hero",
    sectionData: section,
    images: [{
      id: "hero-image",
      url: "https://cdn.test/hero.jpg",
      isPublic: true,
      status: "active",
    }],
  });
  assert.deepEqual(result.nextSection.imageMain, {
    imageId: "hero-image",
    imageUrl: "https://cdn.test/hero.jpg",
  });
  assert.equal(result.nextSection.imageTopLeft, section.imageTopLeft);
  assert.equal(result.audit.matched, 1);
  assert.equal(result.audit.external, 1);
  assert.equal(result.references.length, 1);
});

test("dynamic team, partner and activity fields are enumerated without category inference", () => {
  assert.equal(enumerateSectionImageFields("team", {
    members: [{ name: "A", img: "a.jpg" }, { name: "B", img: "b.jpg" }],
  }).length, 2);
  assert.equal(enumerateSectionImageFields("partners", {
    items: [{ name: "P", logo: "p.jpg" }],
  }).length, 1);
  assert.equal(enumerateSectionImageFields("activities", {
    details: { one: { title: "One", image: "one.jpg" } },
  }).length, 1);
});

test("protected mutation rejects used images and gallery deletion", () => {
  assert.throws(
    () => assertImageMutationAllowed({
      usageRefs: [{ label: "Hero" }],
      usageCount: 1,
      showInGallery: false,
    }, { deleting: true }),
    (error) => error.code === "failed-precondition" && error.details.reason === "image-in-use",
  );
  assert.throws(
    () => assertImageMutationAllowed({
      usageRefs: [],
      usageCount: 0,
      showInGallery: true,
    }, { deleting: true }),
    (error) => error.code === "failed-precondition" && error.details.reason === "image-in-gallery",
  );
  assert.doesNotThrow(() => assertImageMutationAllowed({
    usageRefs: [],
    usageCount: 0,
    showInGallery: false,
  }, { deleting: true }));
});

test("destructive operations remain locked until the reference migration marker exists", () => {
  assert.throws(
    () => assertReferenceMigrationReady({}, "delete"),
    (error) => error.details.reason === "image-reference-migration-required",
  );
  assert.throws(
    () => assertReferenceMigrationReady({ imageReferenceSchemaVersion: 1 }, "make-private"),
    (error) => error.details.reason === "image-reference-migration-required",
  );
  assert.doesNotThrow(() => assertReferenceMigrationReady(
    { imageReferenceSchemaVersion: 2 },
    "delete",
  ));
  assert.doesNotThrow(() => assertReferenceMigrationReady({}, "make-public"));
});

test("protected site-content save writes the canonical reference and reverse usage atomically", async () => {
  const updates = [];
  const sets = [];
  const imageRef = { kind: "doc", collectionName: "images", id: "hero-image" };
  const db = {
    collection(collectionName) {
      return {
        kind: "query",
        collectionName,
        doc(id) {
          return { kind: "doc", collectionName, id };
        },
      };
    },
    async runTransaction(callback) {
      return callback({
        async get(reference) {
          if (reference.collectionName === "users") {
            return { exists: true, data: () => ({ role: "admin", status: "active" }) };
          }
          if (reference.collectionName === "siteContent") {
            return { exists: true, data: () => ({ hero: {} }) };
          }
          if (reference.collectionName === "images" && reference.kind === "query") {
            return {
              docs: [{
                id: "hero-image",
                ref: imageRef,
                data: () => ({
                  url: "https://cdn.test/hero.jpg",
                  isPublic: true,
                  status: "active",
                  usageRefs: [],
                }),
              }],
            };
          }
          throw new Error("Unexpected transaction read");
        },
        update(reference, patch) {
          updates.push({ reference, patch });
        },
        set(reference, patch, options) {
          sets.push({ reference, patch, options });
        },
      });
    },
  };

  const result = await saveSiteContentSectionCore({
    db,
    callerUid: "admin-1",
    data: {
      sectionKey: "hero",
      sectionData: {
        imageMain: "https://cdn.test/hero.jpg",
        imageTopLeft: "",
        imageBottom: "",
      },
    },
  });

  assert.equal(result.usageCount, 1);
  assert.equal(result.sectionData.imageMain.imageId, "hero-image");
  assert.equal(updates.length, 1);
  assert.equal(updates[0].patch.usageCount, 1);
  assert.equal(updates[0].patch.siteAsset, true);
  assert.equal(sets.length, 1);
  assert.equal(sets[0].options.merge, true);
});

test("migration plan is idempotent and reports unmatched/external fields", () => {
  const imageDocument = {
    name: "projects/demo/databases/(default)/documents/images/img-1",
    updateTime: "2026-01-01T00:00:00Z",
    fields: {
      url: stringValue("https://cdn.test/hero.jpg"),
      isPublic: boolValue(true),
      showInGallery: boolValue(false),
    },
  };
  const siteDocument = {
    name: "projects/demo/databases/(default)/documents/siteContent/home",
    updateTime: "2026-01-01T00:00:00Z",
    fields: {
      hero: mapValue({
        imageMain: "https://cdn.test/hero.jpg",
        imageTopLeft: "https://external.test/other.jpg",
        imageBottom: "",
      }),
    },
  };
  const first = planSiteImageReferenceMigration({
    siteDocument,
    imageDocuments: [imageDocument],
  });
  assert.equal(first.summary.matched, 1);
  assert.equal(first.summary.external, 1);
  assert.equal(first.summary.siteSectionsPlanned, 1);
  assert.equal(first.summary.imagesPlanned, 1);
  assert.equal(first.imagePlans[0].patch.usageCount, 1);
});

test("migration refuses to guess when more than one image matches a URL", () => {
  const sharedFields = {
    url: stringValue("https://cdn.test/shared.jpg"),
    isPublic: boolValue(true),
  };
  const result = planSiteImageReferenceMigration({
    siteDocument: {
      name: "projects/demo/databases/(default)/documents/siteContent/home",
      updateTime: "2026-01-01T00:00:00Z",
      fields: {
        about: mapValue({ image: "https://cdn.test/shared.jpg" }),
      },
    },
    imageDocuments: ["one", "two"].map((id) => ({
      name: `projects/demo/databases/(default)/documents/images/${id}`,
      updateTime: "2026-01-01T00:00:00Z",
      fields: sharedFields,
    })),
  });
  assert.equal(result.summary.ambiguous, 1);
  assert.equal(result.summary.matched, 0);
  assert.equal(result.summary.siteSectionsPlanned, 0);
});

test("admin UI has three tabs and protected operations use callable Functions", async () => {
  const [media, service, functions, rules] = await Promise.all([
    readFile(new URL("../src/admin/Media.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/services/imagesService.js", import.meta.url), "utf8"),
    readFile(new URL("../functions/index.js", import.meta.url), "utf8"),
    readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
  ]);
  assert.match(media, /כל התמונות/);
  assert.match(media, /תמונות הגלריה/);
  assert.match(media, /תמונות האתר/);
  assert.match(media, /usageCount/);
  assert.match(service, /httpsCallable\(functions, "mutateImage"\)/);
  assert.match(functions, /enforceAppCheck:\s*true/);
  assert.match(functions, /export const mutateImage/);
  assert.match(functions, /export const saveSiteContentSection/);
  assert.match(rules, /allow delete:\s*if false/);
  assert.match(rules, /collection != 'siteContent'/);
});
