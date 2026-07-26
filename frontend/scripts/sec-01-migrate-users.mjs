import { pathToFileURL } from "node:url";

export function planAccountStatusMigration(data = {}) {
  const hasCanonicalStatus = data.status === "active" || data.status === "inactive";

  if (hasCanonicalStatus) {
    const expectedActive = data.status === "active";
    if (data.active === expectedActive) {
      return { action: "unchanged", reason: "canonical fields already agree" };
    }
    return {
      action: "update",
      patch: { active: expectedActive },
      reason: "status is authoritative; synchronize the legacy mirror",
    };
  }

  if (data.status == null && typeof data.active === "boolean") {
    return {
      action: "update",
      patch: { status: data.active ? "active" : "inactive" },
      reason: "legacy document has an unambiguous active boolean",
    };
  }

  return {
    action: "review",
    reason: "missing/invalid status cannot be inferred safely",
  };
}

function decodeValue(value) {
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  return undefined;
}

function decodeFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

function encodeValue(value) {
  if (typeof value === "boolean") return { booleanValue: value };
  return { stringValue: value };
}

async function listUsers(host, projectId) {
  const base = `http://${host}/v1/projects/${projectId}/databases/(default)/documents/users`;
  const users = [];
  let pageToken = "";
  do {
    const url = new URL(base);
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers: { Authorization: "Bearer owner" } });
    if (!response.ok) throw new Error(`Failed to list emulator users: ${response.status}`);
    const body = await response.json();
    users.push(...(body.documents || []));
    pageToken = body.nextPageToken || "";
  } while (pageToken);
  return users;
}

async function patchUser(host, document, patch) {
  const url = new URL(`http://${host}/v1/${document.name}`);
  for (const field of Object.keys(patch)) url.searchParams.append("updateMask.fieldPaths", field);
  const response = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, encodeValue(v)])) }),
  });
  if (!response.ok) throw new Error(`Failed to update ${document.name}: ${response.status}`);
}

export async function runMigration({ apply = false } = {}) {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "demo-sec01";
  if (!host) {
    throw new Error("Refusing to run: FIRESTORE_EMULATOR_HOST is required; production is never supported.");
  }

  const documents = await listUsers(host, projectId);
  const summary = { mode: apply ? "apply-emulator" : "dry-run", unchanged: 0, update: 0, review: 0 };

  for (const document of documents) {
    const id = document.name.split("/").at(-1);
    const plan = planAccountStatusMigration(decodeFields(document.fields));
    summary[plan.action] += 1;
    console.log(JSON.stringify({ id, ...plan }));
    if (apply && plan.action === "update") await patchUser(host, document, plan.patch);
  }

  console.log(JSON.stringify(summary));
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const apply = process.argv.includes("--apply");
  runMigration({ apply }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
