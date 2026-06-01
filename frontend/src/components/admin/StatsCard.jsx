export default function StatsCard({ title, value, subtitle, icon }) {
  return (
    <div className="stats-card">
      <div className="stats-icon">{icon}</div>
      <div>
        <h3>{title}</h3>
        <div className="stats-value">{value}</div>
        {subtitle && <div className="stats-sub">{subtitle}</div>}
      </div>
    </div>
  );
}
