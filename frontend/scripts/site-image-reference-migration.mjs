import { pathToFileURL } from "node:url";
import {
  SITE_CONTENT_SECTIONS,
  classifyAndCanonicalizeSection,
  enumerateSectionImageFields,
} from "../functions/src/imageReferencePolicy.js";

const MAX_IMAGES = 50_000;
const MAX_ATOMIC_WRITES = 450;

function decodeValue(value = {}) {
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decodeValue);
  if ("mapValue" in value) return decodeFields(value.mapValue.fields || {});
  return undefined;
}

function decodeFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

function encodeValue(value) {
  if (value == null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === "number") return { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === "object") return { mapValue: { fields: encodeFields(value) } };
  throw new Error(`Unsupported Firestore value type: ${typeof value}`);
}

function encodeFields(value = {}) {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, encodeValue(item)]),
  );
}

async function requestJson(url, bearerToken, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`Firestore request failed: HTTP ${response.status}`);
  return response.status === 204 ? {} : response.json();
}

async function loadState({ apiRoot, projectId, bearerToken }) {
  const prefix = `${apiRoot}/v1/projects/${projectId}/databases/(default)/documents`;
  const siteDocument = await requestJson(`${prefix}/siteContent/home`, bearerToken);
  const imageDocuments = [];
  let pageToken = "";
  do {
    const url = new URL(`${prefix}/images`);
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const page = await requestJson(url, bearerToken);
    imageDocuments.push(...(page.documents || []));
    if (imageDocuments.length > MAX_IMAGES) {
      throw new Error(`images exceeds the ${MAX_IMAGES} document safety limit.`);
    }
    pageToken = page.nextPageToken || "";
  } while (pageToken);
  return { siteDocument, imageDocuments };
}

export function planSiteImageReferenceMigration({ siteDocument, imageDocuments }) {
  const siteContent = decodeFields(siteDocument.fields || {});
  const images = imageDocuments.map((document) => ({
    id: document.name.split("/").at(-1),
    ...decodeFields(document.fields || {}),
  }));
  const nextSections = {};
  const usageByImage = new Map();
  const summary = {
    sectionsScanned: 0,
    fieldsScanned: 0,
    matched: 0,
    alreadyReferenced: 0,
    unmatched: 0,
    ambiguous: 0,
    external: 0,
    invalid: 0,
    siteSectionsPlanned: 0,
    imagesPlanned: 0,
    schemaVersionPlanned: false,
    issues: [],
  };

  for (const sectionKey of SITE_CONTENT_SECTIONS) {
    const current = siteContent[sectionKey];
    if (!current || typeof current !== "object") continue;
    summary.sectionsScanned += 1;
    summary.fieldsScanned += enumerateSectionImageFields(sectionKey, current).length;
    const result = classifyAndCanonicalizeSection({
      sectionKey,
      sectionData: current,
      images,
      strict: false,
      preserveExistingReferences: true,
    });
    for (const key of ["matched", "alreadyReferenced", "unmatched", "ambiguous", "external", "invalid"]) {
      summary[key] += result.audit[key];
    }
    summary.issues.push(...result.audit.issues);
    if (JSON.stringify(current) !== JSON.stringify(result.nextSection)) {
      nextSections[sectionKey] = result.nextSection;
    }
    for (const descriptor of enumerateSectionImageFields(sectionKey, result.nextSection)) {
      const imageId = descriptor.value?.imageId;
      if (!imageId) continue;
      const usage = result.references.find((item) => item.field === descriptor.field);
      if (!usage) continue;
      const list = usageByImage.get(imageId) || [];
      list.push(usage);
      usageByImage.set(imageId, list);
    }
  }

  const imagePlans = [];
  imageDocuments.forEach((document) => {
    const id = document.name.split("/").at(-1);
    const current = decodeFields(document.fields || {});
    const usageRefs = usageByImage.get(id) || [];
    const currentRefs = Array.isArray(current.usageRefs) ? current.usageRefs : [];
    const nextStatus = current.status || "active";
    if (
      JSON.stringify(currentRefs) !== JSON.stringify(usageRefs)
      || current.usageCount !== usageRefs.length
      || current.status !== nextStatus
    ) {
      imagePlans.push({
        document,
        patch: { usageRefs, usageCount: usageRefs.length, status: nextStatus },
      });
    }
  });

  summary.siteSectionsPlanned = Object.keys(nextSections).length;
  if (siteContent.imageReferenceSchemaVersion !== 2) {
    nextSections.imageReferenceSchemaVersion = 2;
    summary.schemaVersionPlanned = true;
  }
  summary.imagesPlanned = imagePlans.length;
  summary.issues = summary.issues.slice(0, 100);
  return { summary, nextSections, imagePlans };
}

async function commitMigration({
  apiRoot,
  projectId,
  bearerToken,
  siteDocument,
  nextSections,
  imagePlans,
}) {
  const writes = [];
  if (Object.keys(nextSections).length) {
    writes.push({
      update: {
        name: siteDocument.name,
        fields: encodeFields(nextSections),
      },
      updateMask: { fieldPaths: Object.keys(nextSections) },
      currentDocument: { updateTime: siteDocument.updateTime },
    });
  }
  imagePlans.forEach(({ document, patch }) => writes.push({
    update: { name: document.name, fields: encodeFields(patch) },
    updateMask: { fieldPaths: ["usageRefs", "usageCount", "status"] },
    currentDocument: { updateTime: document.updateTime },
  }));

  const commitUrl = `${apiRoot}/v1/projects/${projectId}/databases/(default)/documents:commit`;
  if (writes.length > MAX_ATOMIC_WRITES) {
    throw new Error(
      `Migration needs ${writes.length} writes; the atomic safety limit is ${MAX_ATOMIC_WRITES}.`,
    );
  }
  if (writes.length) {
    await requestJson(commitUrl, bearerToken, {
      method: "POST",
      body: JSON.stringify({ writes }),
    });
  }
}

export async function runSiteImageReferenceMigration({
  apply = false,
  production = false,
  confirmedProject = "",
} = {}) {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  const projectId = process.env.GCLOUD_PROJECT || (emulatorHost ? "demo-image-references" : "");
  if (!projectId) throw new Error("GCLOUD_PROJECT is required.");
  if (!emulatorHost && !process.env.FIRESTORE_ACCESS_TOKEN) {
    throw new Error("FIRESTORE_ACCESS_TOKEN is required outside the emulator.");
  }
  if (!emulatorHost && apply && (!production || confirmedProject !== projectId)) {
    throw new Error("Production apply requires --production and --confirm-project=<GCLOUD_PROJECT>.");
  }
  const apiRoot = emulatorHost ? `http://${emulatorHost}` : "https://firestore.googleapis.com";
  const bearerToken = emulatorHost ? "owner" : process.env.FIRESTORE_ACCESS_TOKEN;
  const state = await loadState({ apiRoot, projectId, bearerToken });
  const plan = planSiteImageReferenceMigration(state);
  if (apply && (plan.summary.invalid || plan.summary.ambiguous || plan.summary.unmatched)) {
    throw new Error(
      "Apply refused: unmatched, ambiguous, or invalid image references require review.",
    );
  }
  if (apply && (Object.keys(plan.nextSections).length || plan.imagePlans.length)) {
    await commitMigration({
      apiRoot,
      projectId,
      bearerToken,
      ...state,
      ...plan,
    });
  }
  return {
    mode: apply ? (emulatorHost ? "apply-emulator" : "apply-production") : "dry-run",
    targetProject: projectId,
    writesOccurred: apply && (Object.keys(plan.nextSections).length + plan.imagePlans.length > 0),
    ...plan.summary,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const apply = process.argv.includes("--apply");
  const production = process.argv.includes("--production");
  const confirmation = process.argv.find((arg) => arg.startsWith("--confirm-project="));
  runSiteImageReferenceMigration({
    apply,
    production,
    confirmedProject: confirmation?.split("=")[1] || "",
  })
    .then((summary) => console.log(JSON.stringify(summary, null, 2)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
