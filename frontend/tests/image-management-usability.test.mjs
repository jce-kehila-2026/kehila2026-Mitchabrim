import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertImageMutationAllowed,
  mutateImageCore,
} from "../functions/src/imageMutationCore.js";
import {
  planImageSiteAssetBackfill,
} from "../scripts/image-site-asset-backfill.mjs";
import {
  imageMatchesLibraryTab,
  imageMatchesVisibilityFilter,
} from "../src/utils/imageLibraryFilters.js";

const document = (id, fields) => ({
  name: `projects/demo/databases/(default)/documents/images/${id}`,
  updateTime: "2026-01-01T00:00:00Z",
  fields,
});
const boolValue = (value) => ({ booleanValue: value });
const stringValue = (value) => ({ stringValue: value });
const integerValue = (value) => ({ integerValue: String(value) });
const arrayValue = (values = []) => ({ arrayValue: { values } });

test("each media-library tab has an immutable identity predicate", () => {
  const ordinary = { isPublic: true, showInGallery: false, siteAsset: false };
  const gallery = { isPublic: true, showInGallery: true, siteAsset: false };
  const site = { isPublic: true, showInGallery: false, siteAsset: true };

  assert.equal(imageMatchesLibraryTab(ordinary, "all"), true);
  assert.equal(imageMatchesLibraryTab(gallery, "gallery"), true);
  assert.equal(imageMatchesLibraryTab(ordinary, "gallery"), false);
  assert.equal(imageMatchesLibraryTab(site, "site"), true);
  assert.equal(imageMatchesLibraryTab(gallery, "site"), false);
  assert.equal(imageMatchesVisibilityFilter(site, "private"), false);
});

test("site-asset backfill uses actual usage or the legacy category without overwriting booleans", () => {
  const result = planImageSiteAssetBackfill([
    document("used", {
      usageCount: integerValue(1),
      usageRefs: arrayValue([{ mapValue: { fields: {} } }]),
    }),
    document("legacy-category", {
      category: stringValue("תמונות אתר פרסומי"),
      usageCount: integerValue(0),
    }),
    document("ordinary", { usageCount: integerValue(0) }),
    document("explicit", { siteAsset: boolValue(false), usageCount: integerValue(5) }),
    document("invalid", { siteAsset: stringValue("yes") }),
  ]);

  assert.equal(result.summary.scanned, 5);
  assert.equal(result.summary.planned, 3);
  assert.equal(result.summary.plannedTrue, 2);
  assert.equal(result.summary.plannedFalse, 1);
  assert.equal(result.summary.alreadyExplicit, 1);
  assert.equal(result.summary.invalidExisting, 1);
  assert.equal(result.plans.find((plan) => plan.document.name.endsWith("/used")).siteAsset, true);
  assert.equal(result.plans.find((plan) => plan.document.name.endsWith("/ordinary")).siteAsset, false);
});

test("site assets and usage counters protect privacy, deletion, and classification removal", () => {
  assert.throws(
    () => assertImageMutationAllowed(
      { siteAsset: true, usageRefs: [], usageCount: 0, showInGallery: false },
      { makingPrivate: true },
    ),
    (error) => error.details.reason === "image-is-site-asset",
  );
  assert.throws(
    () => assertImageMutationAllowed(
      { siteAsset: true, usageRefs: [], usageCount: 0, showInGallery: false },
      { deleting: true },
    ),
    (error) => error.details.reason === "image-is-site-asset",
  );
  assert.doesNotThrow(() => assertImageMutationAllowed(
    { siteAsset: true, usageRefs: [], usageCount: 0, showInGallery: false },
    { removingSiteAsset: true },
  ));
  assert.throws(
    () => assertImageMutationAllowed(
      { siteAsset: true, usageRefs: [], usageCount: 2, showInGallery: false },
      { removingSiteAsset: true },
    ),
    (error) => error.details.reason === "image-in-use" && error.details.usageCount === 2,
  );
});

test("callable mutation adds and removes a site asset without changing gallery membership", async () => {
  const state = {
    id: "site-candidate",
    isPublic: false,
    showInGallery: false,
    siteAsset: false,
    usageRefs: [],
    usageCount: 0,
    status: "active",
    storagePath: "images/private/site-candidate/photo.jpg",
    url: "",
  };
  let db;
  const imageRef = {
    id: state.id,
    get firestore() { return db; },
    async get() {
      return { exists: true, id: state.id, data: () => ({ ...state }) };
    },
    async update(patch) {
      Object.assign(state, patch);
    },
  };
  const userRef = { kind: "user" };
  const siteRef = { kind: "site" };
  const applyPatch = (patch) => {
    for (const [key, value] of Object.entries(patch)) {
      if (key === "mutationLock" && value && !value.id) delete state.mutationLock;
      else state[key] = value;
    }
  };
  db = {
    collection(name) {
      return {
        doc(id) {
          if (name === "images" && id === state.id) return imageRef;
          if (name === "users") return userRef;
          if (name === "siteContent") return siteRef;
          throw new Error(`Unexpected reference: ${name}/${id}`);
        },
      };
    },
    async runTransaction(callback) {
      return callback({
        async get(reference) {
          if (reference === userRef) {
            return { exists: true, data: () => ({ role: "admin", status: "active" }) };
          }
          if (reference === siteRef) {
            return { exists: true, data: () => ({ imageReferenceSchemaVersion: 2 }) };
          }
          if (reference === imageRef) {
            return { exists: true, id: state.id, data: () => ({ ...state }) };
          }
          throw new Error("Unexpected transaction read");
        },
        update(reference, patch) {
          assert.equal(reference, imageRef);
          applyPatch(patch);
        },
        delete() {
          throw new Error("Delete was not expected");
        },
      });
    },
  };
  const bucket = {
    file(path) {
      return {
        path,
        async copy() {},
        async delete() {},
      };
    },
  };

  const added = await mutateImageCore({
    db,
    bucket,
    getDownloadUrl: async (file) => `https://cdn.test/${file.path}`,
    callerUid: "admin-1",
    data: { imageId: state.id, operation: "add-site-asset" },
  });
  assert.equal(added.image.isPublic, true);
  assert.equal(added.image.siteAsset, true);
  assert.equal(added.image.showInGallery, false);
  assert.match(added.image.storagePath, /^images\/public\//);

  const removed = await mutateImageCore({
    db,
    bucket,
    getDownloadUrl: async (file) => `https://cdn.test/${file.path}`,
    callerUid: "admin-1",
    data: { imageId: state.id, operation: "remove-site-asset" },
  });
  assert.equal(removed.image.isPublic, true);
  assert.equal(removed.image.siteAsset, false);
  assert.equal(removed.image.showInGallery, false);
});

test("UI and callable contract expose separate site, gallery, and privacy operations", async () => {
  const [media, service, core, rules, packageJson] = await Promise.all([
    readFile(new URL("../src/admin/Media.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/services/imagesService.js", import.meta.url), "utf8"),
    readFile(new URL("../functions/src/imageMutationCore.js", import.meta.url), "utf8"),
    readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(media, /הוסף לתמונות האתר/);
  assert.match(media, /הסר מתמונות האתר/);
  assert.match(media, /imageMatchesLibraryTab/);
  assert.match(service, /operation:\s*"delete"/);
  assert.match(service, /"add-site-asset"/);
  assert.match(service, /"remove-site-asset"/);
  assert.match(core, /"add-site-asset"/);
  assert.match(core, /"remove-site-asset"/);
  assert.match(rules, /data\.siteAsset == false \|\| data\.isPublic == true/);
  assert.match(packageJson, /backfill:image-site-assets:dry-run/);
});
