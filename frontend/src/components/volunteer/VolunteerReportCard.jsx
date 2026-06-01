export default function VolunteerReportCard({ date, elderly, type, status, followup, reportStatus }) {
  const sBadge = status === "התקיים" ? "badge-green" : "badge-orange";
  const rBadge = reportStatus === "אושר" ? "badge-green" : "badge-orange";
  return (
    <div className="vol-report-card">
      <div><label>תאריך</label><div>{date}</div></div>
      <div><label>אזרח ותיק</label><div style={{ fontWeight: 600 }}>{elderly}</div></div>
      <div><label>סוג מפגש</label><div>{type}</div></div>
      <div><label>סטטוס מפגש</label><span className={`badge ${sBadge}`}>{status}</span></div>
      <div><label>נדרש מעקב</label><div>{followup}</div></div>
      <div><label>סטטוס דוח</label><span className={`badge ${rBadge}`}>{reportStatus}</span></div>
    </div>
  );
}
