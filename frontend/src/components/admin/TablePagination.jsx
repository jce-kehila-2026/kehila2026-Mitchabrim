// Reusable pagination controls for admin tables.
// Hebrew labels, RTL-friendly. Purely presentational — parent decides how to
// slice/fetch data. Works for both server-side cursor pagination and
// client-side slicing.
export default function TablePagination({
  currentPage = 1,
  totalPages = 1,
  totalCount = null,
  pageSize = 20,
  hasNextPage,
  hasPreviousPage,
  onNext,
  onPrevious,
  onPageChange,
  loading = false,
}) {
  const canPrev = hasPreviousPage ?? currentPage > 1;
  const canNext = hasNextPage ?? currentPage < totalPages;

  if (totalPages <= 1 && !totalCount) return null;

  // Build a compact page-number window (max 7 items with ellipses).
  const pageNumbers = [];
  if (onPageChange && totalPages > 1) {
    const push = (n) => pageNumbers.push(n);
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) push(i);
    } else {
      push(1);
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      if (start > 2) push("…");
      for (let i = start; i <= end; i++) push(i);
      if (end < totalPages - 1) push("…");
      push(totalPages);
    }
  }

  const btnStyle = {
    minWidth: 36,
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #e5d9c4",
    background: "#fff",
    color: "#3c2a1e",
    cursor: "pointer",
    fontSize: 13,
  };
  const activeStyle = {
    ...btnStyle,
    background: "#8b2c2c",
    color: "#fff",
    borderColor: "#8b2c2c",
    fontWeight: 700,
  };
  const disabledStyle = { ...btnStyle, opacity: 0.5, cursor: "not-allowed" };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
        padding: "12px 4px 4px",
        fontSize: 13,
        color: "#5a3a2a",
      }}
    >
      <div>
        עמוד {currentPage} מתוך {totalPages}
        {totalCount != null && (
          <span style={{ color: "#9e8a7a", marginInlineStart: 10 }}>
            ({totalCount} רשומות • {pageSize} לעמוד)
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onPrevious}
          disabled={!canPrev || loading}
          style={!canPrev || loading ? disabledStyle : btnStyle}
        >
          הקודם
        </button>

        {pageNumbers.map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} style={{ padding: "0 4px", color: "#9e8a7a" }}>
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange && onPageChange(p)}
              disabled={loading}
              style={p === currentPage ? activeStyle : btnStyle}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          onClick={onNext}
          disabled={!canNext || loading}
          style={!canNext || loading ? disabledStyle : btnStyle}
        >
          הבא
        </button>
      </div>
    </div>
  );
}
