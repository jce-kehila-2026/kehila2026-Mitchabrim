import { getDocs, limit, query, writeBatch } from "firebase/firestore";
import {
  chunkItems,
  DEFAULT_READ_PAGE_SIZE,
  DEFAULT_WRITE_CHUNK_SIZE,
  retryAsync,
} from "./bulkOperations.js";

const RETRYABLE_CODES = new Set([
  "aborted",
  "cancelled",
  "deadline-exceeded",
  "internal",
  "resource-exhausted",
  "unavailable",
  "unknown",
]);

function isRetryableFirestoreError(error) {
  const code = String(error?.code || "").replace("firestore/", "");
  return RETRYABLE_CODES.has(code);
}

export async function commitBatchOperations(db, operations, {
  chunkSize = DEFAULT_WRITE_CHUNK_SIZE,
  onProgress,
  retries = 3,
} = {}) {
  const chunks = chunkItems(operations, chunkSize);
  let committed = 0;
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    await retryAsync(async () => {
      const batch = writeBatch(db);
      chunk.forEach((operation) => operation(batch));
      await batch.commit();
    }, { retries, shouldRetry: isRetryableFirestoreError });
    committed += chunk.length;
    onProgress?.({
      committed,
      total: operations.length,
      chunk: index + 1,
      chunks: chunks.length,
    });
  }
  return { committed, chunks: chunks.length };
}

export async function deleteQueryInChunks(db, baseQuery, {
  pageSize = DEFAULT_READ_PAGE_SIZE,
  onProgress,
  retries = 3,
} = {}) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > DEFAULT_WRITE_CHUNK_SIZE) {
    throw new RangeError(`pageSize must be between 1 and ${DEFAULT_WRITE_CHUNK_SIZE}`);
  }
  let deleted = 0;
  let chunks = 0;
  while (true) {
    const snapshot = await retryAsync(
      () => getDocs(query(baseQuery, limit(pageSize))),
      { retries, shouldRetry: isRetryableFirestoreError },
    );
    if (snapshot.empty) break;
    const operations = snapshot.docs.map((document) => (batch) => batch.delete(document.ref));
    await commitBatchOperations(db, operations, { chunkSize: pageSize, retries });
    deleted += snapshot.size;
    chunks += 1;
    onProgress?.({ deleted, chunk: chunks });
    if (snapshot.size < pageSize) break;
  }
  return { deleted, chunks };
}

export async function processQueryInChunks(db, baseQuery, operationForDocument, {
  pageSize = DEFAULT_READ_PAGE_SIZE,
  onProgress,
  retries = 3,
} = {}) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > DEFAULT_WRITE_CHUNK_SIZE) {
    throw new RangeError(`pageSize must be between 1 and ${DEFAULT_WRITE_CHUNK_SIZE}`);
  }
  let processed = 0;
  let chunks = 0;
  while (true) {
    const snapshot = await retryAsync(
      () => getDocs(query(baseQuery, limit(pageSize))),
      { retries, shouldRetry: isRetryableFirestoreError },
    );
    if (snapshot.empty) break;
    const operations = snapshot.docs.map(operationForDocument);
    await commitBatchOperations(db, operations, { chunkSize: pageSize, retries });
    processed += snapshot.size;
    chunks += 1;
    onProgress?.({ processed, chunk: chunks });
    if (snapshot.size < pageSize) break;
  }
  return { processed, chunks };
}
