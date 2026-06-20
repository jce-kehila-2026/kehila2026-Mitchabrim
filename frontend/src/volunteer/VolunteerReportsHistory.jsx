import { useEffect, useState } from "react";
import VolunteerLayout from "@/components/volunteer/VolunteerLayout.jsx";
import useCurrentVolunteer from "@/hooks/useCurrentVolunteer.js";
import { getReportsForVolunteer } from "@/services/reportsService.js";

const fmtDate = (val) => {
  if (!val) return "—";
  if (typeof val === "string") return val;
  if (val?.seconds) {
    const d = new Date(val.seconds * 1000);
    return d.toLocaleDateString("he-IL");
  }
  try { return new Date(val).toLocaleDateString("he-IL"); } catch { return "—"; }
};

const statusLabel = (s) =>
  s === "reviewed" ? "אושר" : s === "rejected" ? "נדחה" : "ממתין";

const statusBadgeClass = (s) =>
  s === "reviewed" ? "badge-green" : s === "rejected" ? "badge-orange" : "badge-gray";

export default function VolunteerReportsHistory() {
  const { volunteer, loading: volLoading, linked } = useCurrentVolunteer();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!volunteer?.id) {
        setReports([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const list = await getReportsForVolunteer(volunteer.id);
        if (!cancelled) setReports(list);
      } catch (err) {
        console.error("getReportsForVolunteer error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [volunteer?.id]);

  if (volLoading) {
    return (
      <VolunteerLayout title="הדוחות שלי" subtitle="טוען...">
        <div className="card"><p>טוען...</p></div>
      </VolunteerLayout>
    );
  }

  if (!linked) {
    return (
      <VolunteerLayout title="הדוחות שלי" subtitle="">
        <div className="card">
          <p style={{ color: "#b91c1c", fontWeight: 600 }}>
            לא נמצא פרופיל מתנדב מחובר לחשבון זה. יש לפנות למנהל.
          </p>
        </div>
      </VolunteerLayout>
    );
  }

  return (
    <VolunteerLayout title="הדוחות שלי" subtitle="צפייה בדוחות שנשלחו על ידך">
      {loading ? (
        <div className="card"><p>טוען דוחות...</p></div>
      ) : reports.length === 0 ? (
        <div className="card"><p>לא נמצאו דוחות.</p></div>
      ) : (
        reports.map((r) => (
          <div key={r.id} className="vol-report-card">
            <div><label>תאריך</label><div>{fmtDate(r.reportDate || r.createdAt)}</div></div>
            <div><label>אזרח ותיק</label><div style={{ fontWeight: 600 }}>{r.elderlyName || "—"}</div></div>
            <div><label>סוג מפגש</label><div>{r.reportType || "—"}</div></div>
            <div><label>סטטוס מפגש</label><span className="badge">{r.wasMeetingHeld || "—"}</span></div>
            <div><label>נדרש מעקב</label><div>{r.needsFollowUp || "—"}</div></div>
            <div><label>סטטוס דוח</label><span className={`badge ${statusBadgeClass(r.status)}`}>{statusLabel(r.status)}</span></div>
          </div>
        ))
      )}
    </VolunteerLayout>
  );
}