import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import VolunteerLayout from "@/components/volunteer/VolunteerLayout.jsx";
import LoadingLine from "@/components/common/LoadingLine.jsx";
import useCurrentVolunteer from "@/hooks/useCurrentVolunteer.js";
import { useAuth } from "@/context/AuthContext.jsx";
import {
  getReportsForAuthUidCount,
  getReportsForAuthUidPage,
} from "@/services/reportsService.js";
import { Calendar, Tag, User, Search, Plus, ChevronLeft } from "lucide-react";

const fmtDate = (val) => {
  if (!val) return "—";
  if (typeof val === "string") return val;
  if (val?.seconds) return new Date(val.seconds * 1000).toLocaleDateString("he-IL");
  try { return new Date(val).toLocaleDateString("he-IL"); } catch { return "—"; }
};

export default function VolunteerReportsHistory() {
  const { volunteer, loading: volLoading, linked } = useCurrentVolunteer();
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user?.uid) { setReports([]); setLoading(false); return; }
      setLoading(true);
      setError("");
      try {
        const [pageResult, count] = await Promise.all([
          getReportsForAuthUidPage({ authUid: user.uid, pageSize: 20 }),
          getReportsForAuthUidCount(user.uid),
        ]);
        if (!cancelled) {
          setReports(pageResult.items);
          setCursor(pageResult.lastVisible);
          setHasMore(pageResult.hasNextPage);
          setTotalCount(count);
        }
      } catch (err) {
        console.error("getReportsForAuthUid error:", err);
        if (!cancelled) {
          setReports([]);
          setError("שגיאה בטעינת הדוחות.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user?.uid]);

  const loadMore = async () => {
    if (!user?.uid || !hasMore || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const next = await getReportsForAuthUidPage({
        authUid: user.uid,
        pageSize: 20,
        cursor,
      });
      setReports((current) => {
        const byId = new Map(current.map((item) => [item.id, item]));
        next.items.forEach((item) => byId.set(item.id, item));
        return [...byId.values()];
      });
      setCursor(next.lastVisible);
      setHasMore(next.hasNextPage);
    } catch (err) {
      console.error("load more reports error:", err);
      setError("שגיאה בטעינת דוחות נוספים.");
    } finally {
      setLoadingMore(false);
    }
  };

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = [r.elderlyName, r.reportType, r.notes].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reports, search]);

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
        <div className="vol-card vol-card-pad"><LoadingLine /></div>
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
            placeholder="חיפוש לפי שם, סוג מפגש או תיאור..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="vol-alert-error">{error}</div>
      )}

      {loading ? (
        <div className="vol-card vol-card-pad"><LoadingLine text="טוען דוחות..." /></div>
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
            <div className="cell" style={{ color: "var(--color-text-muted)" }}>
              <label>תיאור</label>
              <span style={{ display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {r.notes || "—"}
              </span>
            </div>
            <ChevronLeft className="chevron" size={20} />
          </div>
        ))
      )}

      {!loading && hasMore && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
          <button
            type="button"
            className="vol-btn vol-btn-outline"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "טוען..." : "טען דוחות נוספים"}
          </button>
        </div>
      )}

      <div className="vol-bottom-stats">
        <div className="vol-bottom-stat approved">
          <div className="label">סה״כ דוחות</div>
          <div className="value">{totalCount}</div>
        </div>
        <div className="vol-bottom-stat month">
          <div className="label">החודש</div>
          <div className="value">{monthCount}</div>
        </div>
      </div>
    </VolunteerLayout>
  );
}
