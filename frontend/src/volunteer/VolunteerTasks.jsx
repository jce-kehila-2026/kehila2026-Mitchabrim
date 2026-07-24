import { useEffect, useMemo, useState } from "react";
import VolunteerLayout from "@/components/volunteer/VolunteerLayout.jsx";
import LoadingLine from "@/components/common/LoadingLine.jsx";
import StatusBadge from "@/components/common/StatusBadge.jsx";
import useCurrentVolunteer from "@/hooks/useCurrentVolunteer";
import {
  getTasksForVolunteerPage,
  getTasksForAuthUidPage,
  getTasksForVolunteerCount,
  getTasksForAuthUidCount,
  updateTask,
  taskStatusLabel,
  taskTypeLabel,
  taskStatusBadge,
} from "@/services/tasksService";
import { useAuth } from "@/context/AuthContext";
import { Calendar, Phone, X } from "lucide-react";

const fmtDate = (val) => {
  if (!val) return "—";
  if (typeof val === "string") return val;
  if (val?.seconds) return new Date(val.seconds * 1000).toLocaleDateString("he-IL");
  try { return new Date(val).toLocaleDateString("he-IL"); } catch { return "—"; }
};

// ISO YYYY-MM-DD used for HTML date inputs and comparisons.
const toIsoDate = (val) => {
  if (!val) return "";
  if (typeof val === "string") {
    // Already ISO?
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
    try { return new Date(val).toISOString().slice(0, 10); } catch { return ""; }
  }
  if (val?.seconds) return new Date(val.seconds * 1000).toISOString().slice(0, 10);
  try { return new Date(val).toISOString().slice(0, 10); } catch { return ""; }
};

// Statuses the volunteer is allowed to set.
const VOLUNTEER_STATUS_OPTIONS = [
  { value: "in_progress", label: "בטיפול" },
  { value: "done", label: "בוצעה" },
];

export default function VolunteerTasks() {
  const { user } = useAuth();
  const { volunteer, loading: vLoading, error: vError } = useCurrentVolunteer();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [queryMode, setQueryMode] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [openTaskId, setOpenTaskId] = useState(null);
  const [savingStatus, setSavingStatus] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (vLoading) return;
      try {
        setLoading(true);
        setError("");
        let pageResult = { items: [], lastVisible: null, hasNextPage: false };
        let count = 0;
        let mode = null;
        if (volunteer?.id) {
          [pageResult, count] = await Promise.all([
            getTasksForVolunteerPage({ volunteerId: volunteer.id, pageSize: 20 }),
            getTasksForVolunteerCount(volunteer.id),
          ]);
          mode = "volunteerId";
        }
        if (pageResult.items.length === 0 && user?.uid) {
          [pageResult, count] = await Promise.all([
            getTasksForAuthUidPage({ authUid: user.uid, pageSize: 20 }),
            getTasksForAuthUidCount(user.uid),
          ]);
          mode = "authUid";
        }
        if (!cancelled) {
          setTasks(pageResult.items);
          setCursor(pageResult.lastVisible);
          setHasMore(pageResult.hasNextPage);
          setQueryMode(mode);
          setTotalCount(count);
        }
      } catch (err) {
        console.error("load tasks error:", err);
        if (!cancelled) setError("שגיאה בטעינת המשימות");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [volunteer?.id, user?.uid, vLoading]);

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const next = queryMode === "volunteerId"
        ? await getTasksForVolunteerPage({ volunteerId: volunteer?.id, pageSize: 20, cursor })
        : await getTasksForAuthUidPage({ authUid: user?.uid, pageSize: 20, cursor });
      setTasks((current) => {
        const byId = new Map(current.map((item) => [item.id, item]));
        next.items.forEach((item) => byId.set(item.id, item));
        return [...byId.values()];
      });
      setCursor(next.lastVisible);
      setHasMore(next.hasNextPage);
    } catch (err) {
      console.error("load more tasks error:", err);
      setError("שגיאה בטעינת משימות נוספות");
    } finally {
      setLoadingMore(false);
    }
  };

  const filtered = useMemo(() => {
    if (!fromDate && !toDate) return tasks;
    return tasks.filter((t) => {
      const iso = toIsoDate(t.dueDate);
      if (!iso) return false;
      if (fromDate && iso < fromDate) return false;
      if (toDate && iso > toDate) return false;
      return true;
    });
  }, [tasks, fromDate, toDate]);

  const openTask = tasks.find((t) => t.id === openTaskId) || null;

  const handleStatusChange = async (newStatus) => {
    if (!openTask) return;
    try {
      setSavingStatus(true);
      await updateTask(openTask.id, { status: newStatus });
      setTasks((prev) => prev.map((t) => (t.id === openTask.id ? { ...t, status: newStatus } : t)));
    } catch (err) {
      console.error("update task status error:", err);
      alert("שגיאה בעדכון סטטוס המשימה");
    } finally {
      setSavingStatus(false);
    }
  };

  const clearFilter = () => { setFromDate(""); setToDate(""); };

  return (
    <VolunteerLayout title="" subtitle="">
      <div className="vol-tasks-container">
        <div className="vol-page-header with-accent">
          <h1>המשימות שלי</h1>
          <p>משימות ומפגשים שהוקצו לך על ידי הרכזת</p>
        </div>

        <div className="vol-card vol-card-pad" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="vol-field" style={{ minWidth: 160 }}>
              <label>מתאריך</label>
              <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="vol-field" style={{ minWidth: 160 }}>
              <label>עד תאריך</label>
              <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <button
              type="button"
              className="vol-btn vol-btn-outline"
              onClick={clearFilter}
              disabled={!fromDate && !toDate}
            >
              ניקוי סינון
            </button>
            <div style={{ marginInlineStart: "auto", color: "var(--color-text-muted)", fontSize: 13 }}>
              מציג {filtered.length} מתוך {totalCount}
            </div>
          </div>
        </div>

        {vError && <div className="vol-alert-error">{vError}</div>}
        {(loading || vLoading) && <LoadingLine text="טוען משימות..." />}
        {!loading && !vLoading && error && <div className="vol-alert-error">{error}</div>}

        {!loading && !vLoading && !error && filtered.length === 0 && (
          <div className="vol-card vol-card-pad" style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
            אין משימות להצגה
          </div>
        )}

        {!loading && !vLoading && filtered.map((t) => (
          <div
            key={t.id}
            className="vol-task-card"
            role="button"
            tabIndex={0}
            onClick={() => setOpenTaskId(t.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenTaskId(t.id); } }}
            style={{ cursor: "pointer" }}
          >
            <div className="head">
              <div>
                <h4>{t.title || "משימה"}</h4>
                {t.elderlyName && (
                  <div style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 4 }}>
                    {t.elderlyName} • {taskTypeLabel(t.taskType)}
                  </div>
                )}
              </div>
              <StatusBadge label={taskStatusLabel(t.status)} variant={taskStatusBadge(t.status)} />
            </div>
            {t.description && <p className="desc">{t.description}</p>}
            <div className="foot">
              <span>{fmtDate(t.dueDate)} <Calendar size={14} /></span>
              {t.phone && <span>{t.phone} <Phone size={14} /></span>}
            </div>
          </div>
        ))}

        {!loading && !vLoading && !error && hasMore && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
            <button
              type="button"
              className="vol-btn vol-btn-outline"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? "טוען..." : "טען משימות נוספות"}
            </button>
          </div>
        )}

        {openTask && (
          <div className="modal-backdrop" onClick={() => setOpenTaskId(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
              <div className="modal-header">
                <h2>{openTask.title || "משימה"}</h2>
                <button className="modal-close" onClick={() => setOpenTaskId(null)} aria-label="סגירה">
                  <X size={20} />
                </button>
              </div>
              <div className="form-section">
                <div className="detail-grid">
                  <div className="item"><label>סוג</label><div>{taskTypeLabel(openTask.taskType)}</div></div>
                  <div className="item"><label>תאריך יעד</label><div>{fmtDate(openTask.dueDate)}</div></div>
                  {openTask.elderlyName && (
                    <div className="item"><label>אזרח ותיק</label><div>{openTask.elderlyName}</div></div>
                  )}
                  <div className="item">
                    <label>סטטוס נוכחי</label>
                    <div>
                      <StatusBadge label={taskStatusLabel(openTask.status)} variant={taskStatusBadge(openTask.status)} />
                    </div>
                  </div>
                  {openTask.description && (
                    <div className="item" style={{ gridColumn: "1 / -1" }}>
                      <label>תיאור</label>
                      <div style={{ whiteSpace: "pre-wrap" }}>{openTask.description}</div>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 20 }}>
                  <label style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>עדכון סטטוס</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {VOLUNTEER_STATUS_OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        className={`vol-btn ${openTask.status === o.value ? "vol-btn-primary" : "vol-btn-outline"}`}
                        onClick={() => handleStatusChange(o.value)}
                        disabled={savingStatus || openTask.status === o.value}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-actions">
                <button className="btn" onClick={() => setOpenTaskId(null)}>סגירה</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </VolunteerLayout>
  );
}
