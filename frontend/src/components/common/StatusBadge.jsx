// Shared status badge that emits the exact `.badge <variant>` markup already
// used across admin and volunteer report/task views. It does not encode any
// mapping between status codes and labels — callers pass the resolved label
// and the variant class (e.g. "badge-green", "badge-orange", "badge-gray")
// so behavior/visual output is identical to the original inline spans.
export default function StatusBadge({ label, variant = "", className, style }) {
  const cls = ["badge", variant, className].filter(Boolean).join(" ");
  return (
    <span className={cls} style={style}>
      {label}
    </span>
  );
}
