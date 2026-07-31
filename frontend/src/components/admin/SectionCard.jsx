export default function SectionCard({ title, actions, children }) {
  return (
    <div className="section-card">
      {(title || actions) && (
        <div className="section-card-header">
          {title && <h3>{title}</h3>}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}
