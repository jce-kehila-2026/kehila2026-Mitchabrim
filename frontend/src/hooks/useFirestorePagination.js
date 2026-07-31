import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Generic cursor-based pagination hook backed by real Firestore cursors.
 *
 * The parent supplies a `fetchPage({ cursor })` function that returns
 * `{ items, lastVisible, hasNextPage }` — this matches the shape produced by
 * `getElderlyPage` / `getVolunteersPage` in the services layer.
 *
 * Behavior:
 *  - Page 1 fetches with `cursor = null`. Cursor for page N+1 = the
 *    `lastVisible` snapshot returned when page N was fetched.
 *  - `next()` uses that cached cursor when moving forward — never a full
 *    re-scan of the collection.
 *  - `prev()` and `goToPage(n)` return to any previously visited page from
 *    the in-memory `pagesCache` / `cursorsCache` without a new read.
 *  - Jumping forward to a page that has not been visited fetches sequential
 *    pages until the target is reached (Firestore has no random-access
 *    offset — this is the standard cursor pattern).
 *  - `reset()` clears all caches; call it whenever filters change or after
 *    a mutation that could shift the ordering (delete/create).
 *
 * Total pages are derived from `totalCount / pageSize` when totalCount is
 * provided by the parent (via `getCountFromServer`). If totalCount is null,
 * we fall back to a "known so far" total based on visited pages.
 */
export default function useFirestorePagination({
  fetchPage,
  totalCount = null,
  pageSize = 20,
  deps = [],
}) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // cursorsCache[i] is the `startAfter` cursor needed to fetch page (i+1).
  // cursorsCache[0] is always null (page 1 uses no cursor).
  const cursorsCache = useRef([null]);
  const pagesCache = useRef(new Map()); // page number -> items[]
  const hasNextRef = useRef(false);
  const requestVersion = useRef(0);

  const load = useCallback(
    async (targetPage) => {
      const version = requestVersion.current;
      // Serve from cache when possible.
      if (pagesCache.current.has(targetPage)) {
        if (version !== requestVersion.current) return;
        setItems(pagesCache.current.get(targetPage));
        setPage(targetPage);
        return;
      }

      setLoading(true);
      setError("");
      try {
        // Sequentially fetch any missing pages between the last cached page
        // and the target. This preserves cursor chain correctness.
        let cursor = null;
        // Find highest cached page number <= targetPage-1 for the cursor.
        for (let p = targetPage - 1; p >= 0; p--) {
          if (cursorsCache.current[p] !== undefined) {
            cursor = cursorsCache.current[p];
            // Also fill any pages between (cached highest + 1) and targetPage.
            for (let q = p + 1; q < targetPage; q++) {
              if (pagesCache.current.has(q)) continue;
              // eslint-disable-next-line no-await-in-loop
              const res = await fetchPage({ cursor });
              if (version !== requestVersion.current) return;
              pagesCache.current.set(q, res.items);
              cursorsCache.current[q] = res.lastVisible || null;
              hasNextRef.current = res.hasNextPage;
              cursor = res.lastVisible || null;
              if (!res.hasNextPage) break;
            }
            break;
          }
        }

        const res = await fetchPage({ cursor });
        if (version !== requestVersion.current) return;
        pagesCache.current.set(targetPage, res.items);
        cursorsCache.current[targetPage] = res.lastVisible || null;
        hasNextRef.current = res.hasNextPage;
        setItems(res.items);
        setPage(targetPage);
      } catch (err) {
        if (version !== requestVersion.current) return;
        console.error("useFirestorePagination fetchPage failed:", err);
        setError(err?.message || "שגיאה בטעינת עמוד");
      } finally {
        if (version === requestVersion.current) setLoading(false);
      }
    },
    [fetchPage],
  );

  const reset = useCallback(() => {
    requestVersion.current += 1;
    cursorsCache.current = [null];
    pagesCache.current = new Map();
    hasNextRef.current = false;
    setPage(1);
    setItems([]);
    load(1);
  }, [load]);

  // Reload from page 1 whenever any dep changes (filters, totalCount identity, etc.)
  useEffect(() => {
    requestVersion.current += 1;
    cursorsCache.current = [null];
    pagesCache.current = new Map();
    hasNextRef.current = false;
    load(1);
    return () => {
      requestVersion.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const totalPages =
    totalCount != null
      ? Math.max(1, Math.ceil(totalCount / pageSize))
      : Math.max(page + (hasNextRef.current ? 1 : 0), 1);

  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;

  return {
    page,
    items,
    loading,
    error,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    next: () => hasNextPage && load(page + 1),
    prev: () => hasPreviousPage && load(page - 1),
    goToPage: (p) => {
      const clamped = Math.max(1, Math.min(totalPages, p));
      load(clamped);
    },
    reset,
    // Local mutation helpers — keep cache consistent after edit/delete.
    patchItem: (id, patch) => {
      const cached = pagesCache.current.get(page);
      if (!cached) return;
      const next = cached.map((it) => (it.id === id ? { ...it, ...patch } : it));
      pagesCache.current.set(page, next);
      setItems(next);
    },
    removeItem: (id) => {
      const cached = pagesCache.current.get(page);
      if (!cached) return;
      const next = cached.filter((it) => it.id !== id);
      pagesCache.current.set(page, next);
      setItems(next);
    },
  };
}
