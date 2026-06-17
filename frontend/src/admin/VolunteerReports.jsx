import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import StatsCard from "@/components/admin/StatsCard.jsx";
import DataTable from "@/components/admin/DataTable.jsx";
import { getAllVolunteerReports, updateReportReview } from "@/services/reportsService.js";
import { useAuth } from "@/context/AuthContext.jsx";

const STATUS_OPTIONS = [
  { value: "pending", label: "ממתין" },
  { value: "reviewed", label: "אושר" },
  { value: "rejected", label: "נדחה" },
];

const statusLabel = (s) => STATUS_OPTIONS.find((o) => o.value === s)?.label || "ממתין";
const statusBadgeClass = (s) =>
  s === "reviewed" ? "badge-green" : s === "rejected" ? "badge-orange" : "badge-gray";

const fmt = (val) => {
  if (!val) return "—";
  if (typeof val === "string") return val;
  if (val?.seconds) return new Date(val.seconds * 1000).toLocaleDateString("he-IL");
  try { return new Date(val).toLocaleDateString("he-IL"); } catch { return "—"; }
};

export default function VolunteerReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [filterStatus, setFilterStatus] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const list = await getAllVolunteerReports();
      setReports(list);
    } catch (err) {
      console.error(err);
      setError("שגיאה בטעינת דוחות המתנדבים");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(
    () => reports.filter((r) => !filterStatus || r.status === filterStatus),
    [reports, filterStatus],
  );

  const openReport = reports.find((r) => r.id === openId) || null;

  const totals = useMemo(() => ({
    total: reports.length,
    pending: reports.filter((r) => !r.status || r.status === "pending").length,
    reviewed: reports.filter((r) => r.status === "reviewed").length,
    rejected: reports.filter((r) => r.status === "rejected").length,
  }), [reports]);

  const handleSaveReview = async (id, patch) => {
    try {
      await updateReportReview(id, { ...patch, reviewedBy: user?.email || user?.uid || "" });
      setReports((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));
      setOpenId(null);
    } catch (err) {
      console.error(err);
      alert("שגיאה בעדכון הדוח");
    }
  };

  return (
    <AdminLayout title="דוחות מתנדבים" subtitle="כל הדוחות שנשלחו מהמתנדבים לבדיקת המנהל">
      {error && <SectionCard><p style={{ color: "red" }}>{error}</p></SectionCard>}

      <div className="stats-grid">
        <StatsCard title="סה״כ דוחות" value={String(totals.total)} />
        <StatsCard title="ממתינים" value={String(totals.pending)} />
        <StatsCard title="אושרו" value={String(totals.reviewed)} />
        <StatsCard title="נדחו" value={String(totals.rejected)} />
      </div>

      <SectionCard>
        <div style={{ marginBottom: 12, display: "flex", gap: 12, alignItems: "center" }}>
          <label>סטטוס:</label>
          <select className="select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">הכל</option>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {loading ? (
          <p style={{ padding: 20 }}>טוען דוחות...</p>
        ) : (
          <DataTable
            columns={[
              { key: "volunteerName", label: "שם המתנדב", render: (r) => r.volunteerName || "—" },
              { key: "elderlyName", label: "שם אזרח ותיק", render: (r) => r.elderlyName || "—" },
              { key: "reportDate", label: "תאריך הדוח", render: (r) => fmt(r.reportDate || r.createdAt) },
              { key: "reportType", label: "סוג מפגש", render: (r) => r.reportType || "—" },
              { key: "needsFollowUp", label: "נדרש מעקב", render: (r) => r.needsFollowUp || "—" },
              {
                key: "status",
                label: "סטטוס",
                render: (r) => <span className={`badge ${statusBadgeClass(r.status)}`}>{statusLabel(r.status)}</span>,
              },
              {
                key: "actions",
                label: "פעולות",
                render: (r) => (
                  <button className="btn" onClick={() => setOpenId(r.id)}>צפייה בפרטים</button>
                ),
              },
            ]}
            data={visible}
          />
        )}
      </SectionCard>

      {openReport && (
        <ReportDetailModal
          report={openReport}
          onClose={() => setOpenId(null)}
          onSave={(patch) => handleSaveReview(openReport.id, patch)}
        />
      )}
    </AdminLayout>
  );
}

function ReportDetailModal({ report, onClose, onSave }) {
  const [status, setStatus] = useState(report.status || "pending");
  const [adminNote, setAdminNote] = useState(report.adminNote || "");

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
        <div className="modal-header">
          <h2>פרטי דוח — {report.volunteerName}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="form-section">
          <div className="detail-grid">
            <div className="item"><label>שם המתנדב</label><div>{report.volunteerName || "—"}</div></div>
            <div className="item"><label>אזרח ותיק</label><div>{report.elderlyName || "—"}</div></div>
            <div className="item"><label>תאריך הדוח</label><div>{fmt(report.reportDate)}</div></div>
            <div className="item"><label>סוג מפגש</label><div>{report.reportType || "—"}</div></div>
            <div className="item"><label>משך</label><div>{report.meetingDuration || "—"}</div></div>
            <div className="item"><label>האם התקיים</label><div>{report.wasMeetingHeld || "—"}</div></div>
            <div className="item"><label>מצב כללי</label><div>{report.generalStatusAfterMeeting || "—"}</div></div>
            <div className="item"><label>נדרש מעקב</label><div>{report.needsFollowUp || "—"}</div></div>
            <div className="item"><label>סוג הבעיה</label><div>{report.problemType || "—"}</div></div>
            <div className="item" style={{ gridColumn: "1 / -1" }}>
              <label>הערות מתנדב</label>
              <div>{report.notes || "—"}</div>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h4>סקירת מנהל</h4>
          <div className="row row-2">
            <div className="field">
              <label>סטטוס</label>
              <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>הערת מנהל</label>
            <textarea className="textarea" rows={3} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={() => onSave({ status, adminNote })}>שמירה</button>
          <button className="btn" onClick={onClose}>סגירה</button>
        </div>
      </div>
    </div>
  );
}
