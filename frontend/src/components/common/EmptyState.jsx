// Shared empty-state line. Preserves the existing muted `<p>` markup used at
// several call sites (e.g. "אין בקשות להצגה"). Optional className and style
// are passed through so the visual output is identical to the original.
export default function EmptyState({ text, className, style, children }) {
  return (
    <p className={className} style={style}>
      {children ?? text}
    </p>
  );
}
