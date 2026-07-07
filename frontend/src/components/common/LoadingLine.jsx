// Shared loading indicator. Preserves the existing `<p>טוען...</p>` markup so
// no CSS class or visual behavior changes when adopted. Optional `className`
// and `style` are passed through to match ad-hoc call sites.
export default function LoadingLine({ text = "טוען...", className, style }) {
  return (
    <p className={className} style={style}>
      {text}
    </p>
  );
}
