import { pathToFileURL } from "node:url";
import { PROMOTIONAL_IMAGE_CATEGORY } from "../src/utils/categorySettings.js";

const MAX_DOCUMENTS = 50_000;
const BATCH_SIZE = 300;

function decodeField(field = {}) {
  if ("stringValue" in field) return field.stringValue;
  if ("booleanValue" in field) return field.booleanValue;
  if ("integerValue" in field) return Number(field.integerValue);
  if ("doubleValue" in field) return field.doubleValue;
  if ("arrayValue" in field) return field.arrayValue.values || [];
  return undefined;
}

export function planImageSiteAssetBackfill(documents) {
  const plans = [];
  const summary = {
    scanned: documents.length,
    planned: 0,
    alreadyExplicit: 0,
    invalidExisting: 0,
    plannedTrue: 0,
    plannedFalse: 0,
    inferredFromUsage: 0,
    inferredFromLegacyCategory: 0,
  };

  for (const document of documents) {
    const fields = document.fields || {};
    if (fields.siteAsset) {
      if (typeof decodeField(fields.siteAsset) === "boolean") summary.alreadyExplicit += 1;
      else summary.invalidExisting += 1;
      continue;
    }

    const usageCount = Number(decodeField(fields.usageCount) || 0);
    const usageRefs = decodeField(fields.usageRefs);
    const hasUsage = usageCount > 0 || (Array.isArray(usageRefs) && usageRefs.length > 0);
    const legacyCategory = decodeField(fields.category) === PROMOTIONAL_IMAGE_CATEGORY;
    const siteAsset = hasUsage || legacyCategory;
    if (hasUsage) summary.inferredFromUsage += 1;
    else if (legacyCategory) summary.inferredFromLegacyCategory += 1;
    if (siteAsset) summary.plannedTrue += 1;
    else summary.plannedFalse += 1;
    plans.push({ document, siteAsset });
  }

  summary.planned = plans.length;
  return { plans, summary };
}

async function listImages({ apiRoot, projectId, bearerToken }) {
  const documents = [];
  let pageToken = "";
  do {
    const url = new URL(
      `${apiRoot}/v1/projects/${projectId}/databases/(default)/documents/images`,
    );
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });
    if (!response.ok) throw new Error(`Failed to scan images: HTTP ${response.status}`);
    const body = await response.json();
    documents.push(...(body.documents || []));
    if (documents.length > MAX_DOCUMENTS) {
      throw new Error(`images exceeds the ${MAX_DOCUMENTS} document safety limit.`);
    }
    pageToken = body.nextPageToken || "";
  } while (pageToken);
  return documents;
}

async function commitPlans({ apiRoot, projectId, bearerToken, plans }) {
  for (let offset = 0; offset < plans.length; offset += BATCH_SIZE) {
    const batch = plans.slice(offset, offset + BATCH_SIZE);
    const response = await fetch(
      `${apiRoot}/v1/projects/${projectId}/databases/(default)/documents:commit`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          writes: batch.map(({ document, siteAsset }) => ({
            update: {
              name: document.name,
              fields: { siteAsset: { booleanValue: siteAsset } },
            },
            updateMask: { fieldPaths: ["siteAsset"] },
            currentDocument: document.updateTime
              ? { updateTime: document.updateTime }
              : { exists: true },
          })),
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`Image site-asset backfill failed: HTTP ${response.status}`);
    }
  }
}

export async function runImageSiteAssetBackfill({
  apply = false,
  production = false,
  confirmedProject = "",
} = {}) {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  const projectId = process.env.GCLOUD_PROJECT || (emulatorHost ? "demo-image-site-assets" : "");
  if (!projectId) throw new Error("GCLOUD_PROJECT is required.");
  if (!emulatorHost && !process.env.FIRESTORE_ACCESS_TOKEN) {
    throw new Error("FIRESTORE_ACCESS_TOKEN is required outside the emulator.");
  }
  if (!emulatorHost && apply && (!production || confirmedProject !== projectId)) {
    throw new Error("Production apply requires --production and --confirm-project=<GCLOUD_PROJECT>.");
  }

  const apiRoot = emulatorHost ? `http://${emulatorHost}` : "https://firestore.googleapis.com";
  const bearerToken = emulatorHost ? "owner" : process.env.FIRESTORE_ACCESS_TOKEN;
  const documents = await listImages({ apiRoot, projectId, bearerToken });
  const { plans, summary } = planImageSiteAssetBackfill(documents);
  if (apply && summary.invalidExisting > 0) {
    throw new Error("Apply refused: invalid existing siteAsset values require review.");
  }
  if (apply && plans.length) {
    await commitPlans({ apiRoot, projectId, bearerToken, plans });
  }

  return {
    mode: apply ? (emulatorHost ? "apply-emulator" : "apply-production") : "dry-run",
    targetProject: projectId,
    writesOccurred: apply && plans.length > 0,
    ...summary,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const apply = process.argv.includes("--apply");
  const production = process.argv.includes("--production");
  const confirmation = process.argv.find((arg) => arg.startsWith("--confirm-project="));
  runImageSiteAssetBackfill({
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
