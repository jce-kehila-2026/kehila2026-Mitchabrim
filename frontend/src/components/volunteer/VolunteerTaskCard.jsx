import { Link } from "react-router-dom";

export default function VolunteerTaskCard({ title, elderly, date, type, status, note }) {
  const badge = status === "פתוח" ? "badge-orange" : status === "הושלם" ? "badge-green" : "badge-gray";
  return (
    <div className="vol-task-card">
      <div className="head">
        <div>
          <h4>{title}</h4>
          <div className="vol-task-meta">{elderly} • {type} • {date}</div>
        </div>
        <span className={`badge ${badge}`}>{status}</span>
      </div>
      {note && <p style={{ marginTop: 10, color: "var(--color-text-muted)", fontSize: 14 }}>{note}</p>}
      <div className="foot">
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>הוקצה ע"י: שרה כהן</span>
        <Link to="/volunteer/report/new" className="btn btn-primary">דיווח על מפגש</Link>
      </div>
    </div>
  );
}
