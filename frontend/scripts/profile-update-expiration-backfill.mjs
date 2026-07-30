import { pathToFileURL } from "node:url";
import { profileUpdateRequestExpiryDate } from "../src/utils/profileUpdateRequestRetention.js";

const MAX_DOCUMENTS = 50_000;
const BATCH_SIZE = 300;

const stringField = (document, name) => document.fields?.[name]?.stringValue || "";
const timestampField = (document, name) => {
  const value = document.fields?.[name]?.timestampValue;
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
};

export function planProfileUpdateExpirations(documents) {
  const plans = [];
  const summary = {
    scanned: documents.length,
    pendingSkipped: 0,
    unsafeExpirationClears: 0,
    missingReviewedAtSkipped: 0,
    existingExpirationSkipped: 0,
    invalidExpirationSkipped: 0,
    planned: 0,
  };

  for (const document of documents) {
    const status = stringField(document, "status");
    if (!["approved", "rejected"].includes(status)) {
      if (document.fields?.expiresAt) {
        plans.push({ document, action: "clear" });
        summary.unsafeExpirationClears += 1;
      }
      summary.pendingSkipped += 1;
      continue;
    }
    const reviewedAt = timestampField(document, "reviewedAt");
    if (!reviewedAt) {
      if (document.fields?.expiresAt) {
        plans.push({ document, action: "clear" });
        summary.unsafeExpirationClears += 1;
      }
      summary.missingReviewedAtSkipped += 1;
      continue;
    }
    if (document.fields?.expiresAt) {
      if (timestampField(document, "expiresAt")) summary.existingExpirationSkipped += 1;
      else summary.invalidExpirationSkipped += 1;
      continue;
    }
    plans.push({
      document,
      action: "set",
      expiresAt: profileUpdateRequestExpiryDate(reviewedAt),
    });
  }
  summary.planned = plans.length;
  return { plans, summary };
}

async function listRequests({ apiRoot, projectId, bearerToken }) {
  const documents = [];
  let pageToken = "";
  do {
    const url = new URL(
      `${apiRoot}/v1/projects/${projectId}/databases/(default)/documents/profileUpdateRequests`,
    );
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });
    if (!response.ok) throw new Error(`Failed to scan profileUpdateRequests: HTTP ${response.status}`);
    const body = await response.json();
    documents.push(...(body.documents || []));
    if (documents.length > MAX_DOCUMENTS) {
      throw new Error(`profileUpdateRequests exceeds the ${MAX_DOCUMENTS} document safety limit.`);
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
          writes: batch.map(({ document, action, expiresAt }) => ({
            update: {
              name: document.name,
              fields: action === "clear"
                ? {}
                : { expiresAt: { timestampValue: expiresAt.toISOString() } },
            },
            updateMask: { fieldPaths: ["expiresAt"] },
            currentDocument: document.updateTime
              ? { updateTime: document.updateTime }
              : { exists: true },
          })),
        }),
      },
    );
    if (!response.ok) throw new Error(`Expiration backfill failed: HTTP ${response.status}`);
  }
}

export async function runProfileUpdateExpirationBackfill({
  apply = false,
  production = false,
  confirmedProject = "",
} = {}) {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  const projectId = process.env.GCLOUD_PROJECT || (emulatorHost ? "demo-profile-expiration" : "");
  if (!projectId) throw new Error("GCLOUD_PROJECT is required.");
  if (!emulatorHost && !process.env.FIRESTORE_ACCESS_TOKEN) {
    throw new Error("FIRESTORE_ACCESS_TOKEN is required outside the emulator.");
  }
  if (!emulatorHost && apply && (!production || confirmedProject !== projectId)) {
    throw new Error(
      "Production apply requires --production and --confirm-project=<GCLOUD_PROJECT>.",
    );
  }

  const apiRoot = emulatorHost ? `http://${emulatorHost}` : "https://firestore.googleapis.com";
  const bearerToken = emulatorHost ? "owner" : process.env.FIRESTORE_ACCESS_TOKEN;
  const documents = await listRequests({ apiRoot, projectId, bearerToken });
  const { plans, summary } = planProfileUpdateExpirations(documents);
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
  runProfileUpdateExpirationBackfill({
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
