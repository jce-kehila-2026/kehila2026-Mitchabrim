function StatsCard({ title, value, subtitle, icon }) {
  return (
    <div className="stats-card">
      <div className="icon">{icon}</div>
      <h3>{title}</h3>
      <div className="value">{value}</div>
      <p className="subtitle">{subtitle}</p>
    </div>
  );
}

export default StatsCard;