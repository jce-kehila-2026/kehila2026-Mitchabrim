function SectionCard({ title, children }) {
  return (
    <div className="section-card">
      <div className="section-card-header">
        <h3 className="section-card-title">{title}</h3>
      </div>
      <div className="section-card-content">
        {children}
      </div>
    </div>
  );
}

export default SectionCard;