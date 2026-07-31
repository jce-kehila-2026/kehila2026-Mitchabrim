export default function ProjectCard({ title, date, status, progress = 0, delivered = 0, onWay = 0, packed = 0 }) {
  const cls = status === "פעיל" ? "badge-green" : status === "בהכנה" ? "badge-orange" : status === "הסתיים" ? "badge-gray" : "";
  return (
    <div className="project-card">
      <div className="head">
        <h4>{title}</h4>
        <span className={`badge ${cls}`}>{status}</span>
      </div>
      <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>תאריך חלוקה: {date}</div>
      <div className="project-progress"><div style={{ width: `${progress}%` }} /></div>
      <div className="project-meta">
        <div><span>נמסרו</span><strong>{delivered}</strong></div>
        <div><span>בדרך</span><strong>{onWay}</strong></div>
        <div><span>נארזו</span><strong>{packed}</strong></div>
      </div>
    </div>
  );
}
