import { pathToFileURL } from "node:url";

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_MAX_DOCUMENTS = 50_000;
const DAY_MS = 86_400_000;

export const TTL_COLLECTIONS = Object.freeze([
  {
    name: "joinRequestIdempotency",
    deriveExpiration(document) {
      return fromCreatedAt(document, DAY_MS);
    },
  },
  {
    name: "joinRequestDuplicates",
    deriveExpiration(document) {
      return fromCreatedAt(document, DAY_MS);
    },
  },
  {
    name: "joinRequestRateLimits",
    deriveExpiration(document) {
      const id = document.name.slice(document.name.lastIndexOf("/") + 1);
      const bucket = Number(id.slice(id.lastIndexOf("_") + 1));
      if (!Number.isSafeInteger(bucket) || bucket < 0) return null;
      if (id.startsWith("ip_")) {
        // Ten-minute bucket + the maximum 20-minute lifetime written in it.
        return new Date((bucket * 600_000) + 1_800_000);
      }
      if (id.startsWith("phone_")) {
        // One-day bucket + the maximum 48-hour lifetime written in it.
        return new Date((bucket * DAY_MS) + (3 * DAY_MS));
      }
      return null;
    },
  },
]);

function timestampDate(field) {
  if (!field?.timestampValue) return null;
  const parsed = new Date(field.timestampValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function fromCreatedAt(document, retentionMs) {
  const createdAt = timestampDate(document.fields?.createdAt);
  return createdAt ? new Date(createdAt.getTime() + retentionMs) : null;
}

export function classifyDocument(document, collectionInfo) {
  const expiresAt = document.fields?.expiresAt;
  if (expiresAt?.timestampValue && timestampDate(expiresAt)) {
    return { status: "valid", expiration: timestampDate(expiresAt) };
  }
  if (expiresAt) return { status: "invalid", expiration: null };
  const expiration = collectionInfo.deriveExpiration(document);
  return expiration
    ? { status: "missing-repairable", expiration }
    : { status: "missing-unrepairable", expiration: null };
}

async function listDocuments({
  apiRoot,
  projectId,
  collectionName,
  bearerToken,
  maxDocuments,
}) {
  const documents = [];
  let pageToken = "";
  do {
    const url = new URL(
      `${apiRoot}/v1/projects/${projectId}/databases/(default)/documents/${collectionName}`,
    );
    url.searchParams.set("pageSize", "300");
    url.searchParams.append("mask.fieldPaths", "createdAt");
    url.searchParams.append("mask.fieldPaths", "expiresAt");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });
    if (!response.ok) {
      throw new Error(`Failed to scan ${collectionName}: HTTP ${response.status}`);
    }
    const body = await response.json();
    documents.push(...(body.documents || []));
    if (documents.length > maxDocuments) {
      throw new Error(
        `${collectionName} exceeds --max-documents=${maxDocuments}; no writes were made.`,
      );
    }
    pageToken = body.nextPageToken || "";
  } while (pageToken);
  return documents;
}

async function commitExpirationBatch({
  apiRoot,
  projectId,
  bearerToken,
  plans,
}) {
  const url = `${apiRoot}/v1/projects/${projectId}/databases/(default)/documents:commit`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      writes: plans.map(({ document, expiration }) => ({
        update: {
          name: document.name,
          fields: { expiresAt: { timestampValue: expiration.toISOString() } },
        },
        updateMask: { fieldPaths: ["expiresAt"] },
        currentDocument: { exists: true },
      })),
    }),
  });
  if (!response.ok) {
    throw new Error(`TTL backfill batch failed: HTTP ${response.status}`);
  }
}

export async function runDb03Backfill({
  apply = false,
  production = false,
  confirmedProject = "",
  batchSize = DEFAULT_BATCH_SIZE,
  maxDocuments = DEFAULT_MAX_DOCUMENTS,
} = {}) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 400) {
    throw new Error("--batch-size must be between 1 and 400.");
  }
  if (!Number.isInteger(maxDocuments) || maxDocuments < 1 || maxDocuments > 100_000) {
    throw new Error("--max-documents must be between 1 and 100000.");
  }

  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  const projectId = process.env.GCLOUD_PROJECT || (emulatorHost ? "demo-db03" : "");
  if (!projectId) throw new Error("GCLOUD_PROJECT is required.");
  if (!emulatorHost && !process.env.FIRESTORE_ACCESS_TOKEN) {
    throw new Error("FIRESTORE_ACCESS_TOKEN is required outside the emulator.");
  }
  if (
    !emulatorHost
    && apply
    && (!production || confirmedProject !== projectId)
  ) {
    throw new Error(
      "Production apply requires --production and --confirm-project=<GCLOUD_PROJECT>.",
    );
  }

  const apiRoot = emulatorHost
    ? `http://${emulatorHost}`
    : "https://firestore.googleapis.com";
  const bearerToken = emulatorHost ? "owner" : process.env.FIRESTORE_ACCESS_TOKEN;
  const summary = {
    mode: apply ? (emulatorHost ? "apply-emulator" : "apply-production") : "dry-run",
    targetProject: projectId,
    writesOccurred: false,
    scanned: 0,
    requiringUpdates: 0,
    updated: 0,
    collections: {},
  };

  for (const collectionInfo of TTL_COLLECTIONS) {
    const documents = await listDocuments({
      apiRoot,
      projectId,
      collectionName: collectionInfo.name,
      bearerToken,
      maxDocuments,
    });
    const counts = {
      scanned: documents.length,
      validTimestamp: 0,
      missingRepairable: 0,
      missingUnrepairable: 0,
      invalidType: 0,
      updated: 0,
    };
    const plans = [];
    for (const document of documents) {
      const classification = classifyDocument(document, collectionInfo);
      if (classification.status === "valid") counts.validTimestamp += 1;
      if (classification.status === "invalid") counts.invalidType += 1;
      if (classification.status === "missing-unrepairable") {
        counts.missingUnrepairable += 1;
      }
      if (classification.status === "missing-repairable") {
        counts.missingRepairable += 1;
        plans.push({ document, expiration: classification.expiration });
      }
    }
    summary.scanned += documents.length;
    summary.requiringUpdates += plans.length;
    summary.collections[collectionInfo.name] = counts;

    if (apply) {
      for (let offset = 0; offset < plans.length; offset += batchSize) {
        // eslint-disable-next-line no-await-in-loop
        await commitExpirationBatch({
          apiRoot,
          projectId,
          bearerToken,
          plans: plans.slice(offset, offset + batchSize),
        });
      }
      counts.updated = plans.length;
      summary.updated += plans.length;
      summary.writesOccurred ||= plans.length > 0;
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

function readNumberArgument(name, fallback) {
  const raw = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (!raw) return fallback;
  return Number(raw.slice(name.length + 1));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const confirmArg = process.argv.find((argument) => (
    argument.startsWith("--confirm-project=")
  ));
  runDb03Backfill({
    apply: process.argv.includes("--apply"),
    production: process.argv.includes("--production"),
    confirmedProject: confirmArg?.slice("--confirm-project=".length) || "",
    batchSize: readNumberArgument("--batch-size", DEFAULT_BATCH_SIZE),
    maxDocuments: readNumberArgument("--max-documents", DEFAULT_MAX_DOCUMENTS),
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
