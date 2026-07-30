import { pathToFileURL } from "node:url";

const MAX_DOCUMENTS = 50_000;
const BATCH_SIZE = 300;

const fieldString = (document, name) => document.fields?.[name]?.stringValue || "";
const fieldTime = (document, name) => {
  const value = document.fields?.[name]?.timestampValue;
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(0);
};
const documentId = (document) => document.name.slice(document.name.lastIndexOf("/") + 1);

export function planPendingLocks(requests, existingLocks = []) {
  const lockedUids = new Set(existingLocks.map((lock) => documentId(lock)));
  const pendingByVolunteer = new Map();

  for (const request of requests) {
    if (fieldString(request, "status") !== "pending") continue;
    const volunteerAuthUid = fieldString(request, "volunteerAuthUid");
    if (!volunteerAuthUid) continue;
    const current = pendingByVolunteer.get(volunteerAuthUid) || [];
    current.push(request);
    pendingByVolunteer.set(volunteerAuthUid, current);
  }

  const plans = [];
  const duplicates = [];
  for (const [volunteerAuthUid, pending] of pendingByVolunteer) {
    pending.sort((left, right) => (
      fieldTime(right, "createdAt").getTime() - fieldTime(left, "createdAt").getTime()
    ));
    if (pending.length > 1) {
      duplicates.push({
        volunteerAuthUid,
        requestIds: pending.map(documentId),
      });
    }
    if (!lockedUids.has(volunteerAuthUid)) {
      plans.push({
        volunteerAuthUid,
        requestId: documentId(pending[0]),
        createdAt: fieldTime(pending[0], "createdAt"),
      });
    }
  }
  return { plans, duplicates };
}

async function listCollection({ apiRoot, projectId, bearerToken, collectionName }) {
  const documents = [];
  let pageToken = "";
  do {
    const url = new URL(
      `${apiRoot}/v1/projects/${projectId}/databases/(default)/documents/${collectionName}`,
    );
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });
    if (!response.ok) throw new Error(`Failed to scan ${collectionName}: HTTP ${response.status}`);
    const body = await response.json();
    documents.push(...(body.documents || []));
    if (documents.length > MAX_DOCUMENTS) {
      throw new Error(`${collectionName} exceeds the ${MAX_DOCUMENTS} document safety limit.`);
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
          writes: batch.map((plan) => ({
            update: {
              name: `projects/${projectId}/databases/(default)/documents/profileUpdateRequestPending/${plan.volunteerAuthUid}`,
              fields: {
                volunteerAuthUid: { stringValue: plan.volunteerAuthUid },
                requestId: { stringValue: plan.requestId },
                createdAt: { timestampValue: plan.createdAt.toISOString() },
              },
            },
            currentDocument: { exists: false },
          })),
        }),
      },
    );
    if (!response.ok) throw new Error(`Pending-lock commit failed: HTTP ${response.status}`);
  }
}

export async function reconcilePendingLocks({
  apply = false,
  production = false,
  confirmedProject = "",
} = {}) {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  const projectId = process.env.GCLOUD_PROJECT || (emulatorHost ? "demo-profile-locks" : "");
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
  const [requests, locks] = await Promise.all([
    listCollection({ apiRoot, projectId, bearerToken, collectionName: "profileUpdateRequests" }),
    listCollection({ apiRoot, projectId, bearerToken, collectionName: "profileUpdateRequestPending" }),
  ]);
  const plan = planPendingLocks(requests, locks);
  if (apply && plan.duplicates.length) {
    throw new Error(
      `Refusing to apply: ${plan.duplicates.length} volunteers already have multiple pending requests. Resolve them and rerun dry-run first.`,
    );
  }
  if (apply && plan.plans.length) {
    await commitPlans({ apiRoot, projectId, bearerToken, plans: plan.plans });
  }
  return {
    mode: apply ? (emulatorHost ? "apply-emulator" : "apply-production") : "dry-run",
    targetProject: projectId,
    scannedRequests: requests.length,
    existingLocks: locks.length,
    locksRequired: plan.plans.length,
    duplicateVolunteerCount: plan.duplicates.length,
    duplicates: plan.duplicates,
    writesOccurred: apply && plan.plans.length > 0,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const apply = process.argv.includes("--apply");
  const production = process.argv.includes("--production");
  const confirmation = process.argv.find((arg) => arg.startsWith("--confirm-project="));
  reconcilePendingLocks({
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
