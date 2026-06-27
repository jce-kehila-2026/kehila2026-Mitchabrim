import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import VolunteerLayout from "@/components/volunteer/VolunteerLayout.jsx";
import useCurrentVolunteer from "@/hooks/useCurrentVolunteer.js";
import { useAuth } from "@/context/AuthContext.jsx";
import { getReportsForAuthUid } from "@/services/reportsService.js";
import {
  Calendar, Tag, User, Search, Plus, ChevronLeft,
} from "lucide-react";

const fmtDate = (val) => {
  if (!val) return "—";
  if (typeof val === "string") return val;
  if (val?.seconds) return new Date(val.seconds * 1000).toLocaleDateString("he-IL");
  try { return new Date(val).toLocaleDateString("he-IL"); } catch { return "—"; }
};

const statusLabel = (s) =>
  s === "reviewed" ? "אושר" : s === "rejected" ? "נדחה" : "ממתין";
const statusBadgeClass = (s) =>
  s === "reviewed" ? "badge-green" : s === "rejected" ? "badge-orange" : "badge-gray";

const FILTERS = [
  { key: "all", label: "הכל" },
  { key: "reviewed", label: "אושר" },
  { key: "pending", label: "ממתין" },
  { key: "rejected", label: "נדחה" },
];

export default function VolunteerReportsHistory() {
  const { volunteer, loading: volLoading, linked } = useCurrentVolunteer();
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user?.uid) { setReports([]); setLoading(false); return; }
      setLoading(true);
      try {
        const list = await getReportsForAuthUid(user.uid);
        if (!cancelled) setReports(list);
      } catch (err) {
        console.error("getReportsForAuthUid error:", err);
        if (!cancelled) setReports([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user?.uid]);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (filter !== "all") {
        const s = r.status || "pending";
        if (filter === "pending" && s !== "pending" && s) return false;
        if (filter !== "pending" && s !== filter) return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = [r.elderlyName, r.reportType, r.notes].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reports, filter, search]);

  const approvedCount = reports.filter((r) => r.status === "reviewed").length;
  const pendingCount = reports.filter((r) => !r.status || r.status === "pending").length;
  const monthCount = reports.filter((r) => {
    const d = r.reportDate || r.createdAt;
    try {
      const dt = d?.seconds ? new Date(d.seconds * 1000) : new Date(d);
      const now = new Date();
      return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
    } catch { return false; }
  }).length;

  if (volLoading) {
    return (
      <VolunteerLayout title="הדוחות שלי" subtitle="טוען...">
        <div className="vol-card vol-card-pad"><p>טוען...</p></div>
      </VolunteerLayout>
    );
  }

  if (!linked) {
    return (
      <VolunteerLayout title="הדוחות שלי" subtitle="">
        <div className="vol-card vol-card-pad">
          <p style={{ color: "#b91c1c", fontWeight: 600 }}>
            לא נמצא פרופיל מתנדב מחובר לחשבון זה. יש לפנות למנהל.
          </p>
        </div>
      </VolunteerLayout>
    );
  }

  return (
    <VolunteerLayout title="הדוחות שלי" subtitle="צפייה בדוחות שנשלחו על ידך">
      <div className="vol-reports-header">
        <div></div>
        <Link to="/volunteer/report/new" className="vol-btn vol-btn-primary">
          <Plus size={16} /> הגשת דוח חדש
        </Link>
      </div>

      <div className="vol-search-bar">
        <div className="vol-search-input">
          <Search size={16} color="var(--color-text-muted)" />
          <input
            placeholder="חיפוש לפי שם, סוג מפגש או הערות..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="vol-filter-pills">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`vol-pill ${filter === f.key ? "active" : ""}`}
              onClick={() => setFilter(f.key)}
              type="button"
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="vol-card vol-card-pad"><p>טוען דוחות...</p></div>
      ) : filtered.length === 0 ? (
        <div className="vol-card vol-card-pad" style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
          לא נמצאו דוחות.
        </div>
      ) : (
        filtered.map((r) => (
          <div key={r.id} className="vol-report-row">
            <div className="cell">
              <label>תאריך</label>
              <span className="with-icon"><Calendar size={14} /> {fmtDate(r.reportDate || r.createdAt)}</span>
            </div>
            <div className="cell">
              <label>סוג מפגש</label>
              <span className="with-icon"><Tag size={14} /> {r.reportType || "—"}</span>
            </div>
            <div className="cell">
              <label>אזרח ותיק</label>
              <span className="with-icon" style={{ fontWeight: 600 }}>
                <User size={14} /> {r.elderlyName || "—"}
              </span>
            </div>
            <div className="cell">
              <label>סטטוס</label>
              <span className={`badge ${statusBadgeClass(r.status)}`}>{statusLabel(r.status)}</span>
            </div>
            <div className="cell" style={{ color: "var(--color-text-muted)" }}>
              <label>סיכום</label>
              <span style={{ display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {r.notes || "—"}
              </span>
            </div>
            <ChevronLeft className="chevron" size={20} />
          </div>
        ))
      )}

      <div className="vol-bottom-stats">
        <div className="vol-bottom-stat approved">
          <div className="label">דוחות שאושרו</div>
          <div className="value">{approvedCount}</div>
        </div>
        <div className="vol-bottom-stat pending">
          <div className="label">ממתינים לאישור</div>
          <div className="value">{pendingCount}</div>
        </div>
        <div className="vol-bottom-stat month">
          <div className="label">החודש</div>
          <div className="value">{monthCount}</div>
        </div>
      </div>
    </VolunteerLayout>
  );
}
