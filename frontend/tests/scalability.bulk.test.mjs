import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateChunkSize,
  chunkItems,
  mapWithConcurrency,
  retryAsync,
} from "../src/utils/bulkOperations.js";

test("chunking covers empty, boundary, and multi-thousand inputs", () => {
  const expected = new Map([
    [0, []],
    [1, [1]],
    [399, [399]],
    [400, [400]],
    [401, [400, 1]],
    [499, [400, 99]],
    [500, [400, 100]],
    [501, [400, 101]],
    [5000, [...Array(12).fill(400), 200]],
  ]);
  for (const [size, lengths] of expected) {
    assert.deepEqual(chunkItems(Array.from({ length: size }), 400).map((part) => part.length), lengths);
  }
  assert.equal(calculateChunkSize({ writesPerItem: 2, reservedWrites: 2 }), 199);
  assert.throws(() => chunkItems([1], 501), RangeError);
});

test("bounded mapper never exceeds configured concurrency", async () => {
  let active = 0;
  let maximum = 0;
  const result = await mapWithConcurrency(Array.from({ length: 60 }, (_, index) => index), async (item) => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active -= 1;
    return item * 2;
  }, { concurrency: 6 });
  assert.equal(maximum, 6);
  assert.equal(result.completed, 60);
  assert.equal(result.results[59], 118);
});

test("failure exposes partial progress and tolerant mode records failures", async () => {
  await assert.rejects(
    mapWithConcurrency([0, 1, 2, 3], async (item) => {
      if (item === 1) throw new Error("mid-run");
      return item;
    }, { concurrency: 1 }),
    (error) => error.message === "mid-run"
      && error.bulkProgress.completed === 2
      && error.bulkProgress.total === 4,
  );
  const tolerant = await mapWithConcurrency([0, 1, 2], async (item) => {
    if (item === 1) throw new Error("expected");
    return item;
  }, { concurrency: 2, stopOnError: false });
  assert.equal(tolerant.completed, 3);
  assert.deepEqual(tolerant.failures.map(({ index }) => index), [1]);
});

test("retry succeeds after transient failures and stops on permanent failures", async () => {
  let attempts = 0;
  const value = await retryAsync(async () => {
    attempts += 1;
    if (attempts < 3) throw new Error("temporary");
    return "done";
  }, { retries: 3, delay: async () => {} });
  assert.equal(value, "done");
  assert.equal(attempts, 3);

  let permanentAttempts = 0;
  await assert.rejects(retryAsync(async () => {
    permanentAttempts += 1;
    throw new Error("permanent");
  }, { retries: 3, shouldRetry: () => false, delay: async () => {} }), /permanent/);
  assert.equal(permanentAttempts, 1);
});
