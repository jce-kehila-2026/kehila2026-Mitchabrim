export const DEFAULT_WRITE_CHUNK_SIZE = 400;
export const DEFAULT_READ_PAGE_SIZE = 200;
export const DEFAULT_CONCURRENCY = 6;

export function chunkItems(items, chunkSize = DEFAULT_WRITE_CHUNK_SIZE) {
  if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > 500) {
    throw new RangeError("chunkSize must be an integer between 1 and 500");
  }
  const source = Array.isArray(items) ? items : [];
  const chunks = [];
  for (let offset = 0; offset < source.length; offset += chunkSize) {
    chunks.push(source.slice(offset, offset + chunkSize));
  }
  return chunks;
}

export function calculateChunkSize({
  writesPerItem = 1,
  reservedWrites = 0,
  operationalLimit = DEFAULT_WRITE_CHUNK_SIZE,
} = {}) {
  if (!Number.isInteger(writesPerItem) || writesPerItem < 1) {
    throw new RangeError("writesPerItem must be a positive integer");
  }
  if (!Number.isInteger(reservedWrites) || reservedWrites < 0) {
    throw new RangeError("reservedWrites must be a non-negative integer");
  }
  if (!Number.isInteger(operationalLimit) || operationalLimit < 1 || operationalLimit > 500) {
    throw new RangeError("operationalLimit must be between 1 and 500");
  }
  const availableWrites = operationalLimit - reservedWrites;
  if (availableWrites < writesPerItem) {
    throw new RangeError("reservedWrites leave no capacity for an item");
  }
  return Math.floor(availableWrites / writesPerItem);
}

export async function retryAsync(worker, {
  retries = 3,
  baseDelayMs = 100,
  shouldRetry = () => true,
  delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  let attempt = 0;
  while (true) {
    try {
      return await worker(attempt);
    } catch (error) {
      if (attempt >= retries || !shouldRetry(error)) throw error;
      await delay(baseDelayMs * (2 ** attempt));
      attempt += 1;
    }
  }
}

export async function mapWithConcurrency(items, worker, {
  concurrency = DEFAULT_CONCURRENCY,
  onProgress,
  stopOnError = true,
} = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError("concurrency must be a positive integer");
  }
  const source = Array.isArray(items) ? items : [];
  if (source.length === 0) return { results: [], failures: [], completed: 0, total: 0 };

  const results = new Array(source.length);
  const failures = [];
  let nextIndex = 0;
  let completed = 0;
  let fatalError = null;

  const runner = async () => {
    while (nextIndex < source.length && !fatalError) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = await worker(source[index], index);
      } catch (error) {
        failures.push({ index, item: source[index], error });
        if (stopOnError) fatalError = error;
      } finally {
        completed += 1;
        onProgress?.({ completed, total: source.length, failures: failures.length });
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, source.length) }, () => runner()),
  );
  if (fatalError) {
    fatalError.bulkProgress = { completed, total: source.length, failures };
    throw fatalError;
  }
  return { results, failures, completed, total: source.length };
}

