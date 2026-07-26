import { pathToFileURL } from "node:url";
import {
  buildElderlySearchFields,
  buildVolunteerSearchFields,
} from "../src/utils/firestoreSearch.js";
import { mapWithConcurrency, retryAsync } from "../src/utils/bulkOperations.js";

const BATCH_SIZE = 100;

function readString(fields, name) {
  return fields?.[name]?.stringValue || "";
}

function toPlainDocument(document) {
  const fields = document.fields || {};
  return {
    firstName: readString(fields, "firstName"),
    lastName: readString(fields, "lastName"),
    name: readString(fields, "name"),
    mobile: readString(fields, "mobile"),
    homePhone: readString(fields, "homePhone"),
    phone: readString(fields, "phone"),
    idNum: readString(fields, "idNum"),
    insurance: readString(fields, "insurance"),
    group: readString(fields, "group"),
    neighborhood: readString(fields, "neighborhood"),
    area: readString(fields, "area"),
  };
}

export function toFirestoreFields(searchFields) {
  return Object.fromEntries(Object.entries(searchFields).map(([key, value]) => [
    key,
    Array.isArray(value)
      ? { arrayValue: { values: value.map((item) => ({ stringValue: item })) } }
      : typeof value === "number"
        ? { integerValue: String(value) }
        : { stringValue: value },
  ]));
}

export function getChangedFieldNames(document, searchFields) {
  const expected = toFirestoreFields(searchFields);
  const current = document.fields || {};
  return Object.keys(expected).filter(
    (fieldName) => JSON.stringify(current[fieldName]) !== JSON.stringify(expected[fieldName]),
  );
}

function getDocumentId(document) {
  return document.name.slice(document.name.lastIndexOf("/") + 1);
}

function getUnrelatedFields(document, managedFieldNames) {
  const managed = new Set(managedFieldNames);
  return Object.fromEntries(
    Object.entries(document.fields || {})
      .filter(([fieldName]) => !managed.has(fieldName))
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

async function listDocuments(baseUrl, collectionName, bearerToken) {
  const documents = [];
  let pageToken = "";
  do {
    const url = new URL(`${baseUrl}/${collectionName}`);
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${bearerToken}` } });
    if (!response.ok) throw new Error(`Failed to list ${collectionName}: ${response.status}`);
    const body = await response.json();
    documents.push(...(body.documents || []));
    pageToken = body.nextPageToken || "";
  } while (pageToken);
  return documents;
}

async function getDocument(apiRoot, bearerToken, documentName) {
  const relativeName = documentName.slice(documentName.indexOf("projects/"));
  const response = await fetch(`${apiRoot}/v1/${relativeName}`, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
  if (!response.ok) throw new Error(`Failed to verify ${documentName}: ${response.status}`);
  return response.json();
}

async function patchDocument(apiRoot, bearerToken, document, searchFields) {
  const relativeName = document.name.slice(document.name.indexOf("projects/"));
  const url = new URL(`${apiRoot}/v1/${relativeName}`);
  Object.keys(searchFields).forEach((field) => url.searchParams.append("updateMask.fieldPaths", field));
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: toFirestoreFields(searchFields) }),
  });
  if (!response.ok) throw new Error(`Failed to update ${document.name}: ${response.status}`);
}

export async function runPerf05Backfill({ apply = false, production = false, confirmedProject = "" } = {}) {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const projectId = process.env.GCLOUD_PROJECT || (host ? "demo-perf05" : "");
  if (!projectId) throw new Error("GCLOUD_PROJECT is required outside the emulator.");
  if (!host && !process.env.FIRESTORE_ACCESS_TOKEN) {
    throw new Error("FIRESTORE_ACCESS_TOKEN is required outside the emulator.");
  }
  if (!host && apply && (!production || confirmedProject !== projectId)) {
    throw new Error("Production apply requires --production and --confirm-project=<GCLOUD_PROJECT>.");
  }
  const apiRoot = host ? `http://${host}` : "https://firestore.googleapis.com";
  const bearerToken = host ? "owner" : process.env.FIRESTORE_ACCESS_TOKEN;
  const baseUrl = `${apiRoot}/v1/projects/${projectId}/databases/(default)/documents`;
  const collections = [
    { name: "elderly", build: buildElderlySearchFields },
    { name: "volunteers", build: buildVolunteerSearchFields },
  ];
  const target = host ? "emulator" : "production";
  const summary = {
    mode: apply ? `apply-${target}` : `dry-run-${target}`,
    targetProject: projectId,
    scanned: 0,
    changed: 0,
    updated: 0,
    collections: {},
  };

  for (const collectionInfo of collections) {
    const documents = await listDocuments(baseUrl, collectionInfo.name, bearerToken);
    const collectionSummary = {
      scanned: documents.length,
      requiringUpdates: 0,
      updated: 0,
      verificationSamples: [],
    };
    summary.collections[collectionInfo.name] = collectionSummary;
    summary.scanned += documents.length;
    for (let offset = 0; offset < documents.length; offset += BATCH_SIZE) {
      const batch = documents.slice(offset, offset + BATCH_SIZE);
      const plans = batch.map((document) => {
        const fields = collectionInfo.build(toPlainDocument(document));
        const managedFieldNames = Object.keys(fields);
        return {
          document,
          fields,
          changedFields: getChangedFieldNames(document, fields),
          unrelatedFields: getUnrelatedFields(document, managedFieldNames),
        };
      }).filter((plan) => plan.changedFields.length > 0);
      summary.changed += plans.length;
      collectionSummary.requiringUpdates += plans.length;
      plans.forEach(({ document, changedFields }) => {
        console.log(JSON.stringify({
          collection: collectionInfo.name,
          documentId: getDocumentId(document),
          changedFields,
        }));
      });
      if (apply) {
        await mapWithConcurrency(
          plans,
          ({ document, fields }) => retryAsync(
            () => patchDocument(apiRoot, bearerToken, document, fields),
            { retries: 3 },
          ),
          { concurrency: 6 },
        );
        summary.updated += plans.length;
        collectionSummary.updated += plans.length;

        const remainingSampleSlots = Math.max(0, 3 - collectionSummary.verificationSamples.length);
        const samples = plans.slice(0, remainingSampleSlots);
        for (const sample of samples) {
          // eslint-disable-next-line no-await-in-loop
          const verified = await getDocument(apiRoot, bearerToken, sample.document.name);
          const expectedFields = toFirestoreFields(sample.fields);
          const managedFieldNames = Object.keys(expectedFields);
          const verification = {
            documentId: getDocumentId(verified),
            documentIdUnchanged: getDocumentId(verified) === getDocumentId(sample.document),
            requiredFieldsPresent: managedFieldNames.every((fieldName) => verified.fields?.[fieldName]),
            schemaVersionCorrect:
              verified.fields?.searchSchemaVersion?.integerValue === "1",
            unrelatedFieldsUnchanged:
              JSON.stringify(getUnrelatedFields(verified, managedFieldNames)) ===
              JSON.stringify(sample.unrelatedFields),
          };
          if (!verification.documentIdUnchanged || !verification.requiredFieldsPresent ||
              !verification.schemaVersionCorrect || !verification.unrelatedFieldsUnchanged) {
            throw new Error(`Verification failed for ${sample.document.name}`);
          }
          collectionSummary.verificationSamples.push(verification);
        }
      }
    }
  }

  console.log(JSON.stringify(summary));
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const confirmArg = process.argv.find((arg) => arg.startsWith("--confirm-project="));
  runPerf05Backfill({
    apply: process.argv.includes("--apply"),
    production: process.argv.includes("--production"),
    confirmedProject: confirmArg?.split("=")[1] || "",
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
