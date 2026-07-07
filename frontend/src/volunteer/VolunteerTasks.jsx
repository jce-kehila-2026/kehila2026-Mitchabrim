import { useEffect, useMemo, useState } from "react";
import VolunteerLayout from "@/components/volunteer/VolunteerLayout.jsx";
import LoadingLine from "@/components/common/LoadingLine.jsx";
import StatusBadge from "@/components/common/StatusBadge.jsx";
import useCurrentVolunteer from "@/hooks/useCurrentVolunteer";
import {
  getTasksForVolunteer,
  getTasksForAuthUid,
  taskStatusLabel,
  taskTypeLabel,
  taskStatusBadge,
} from "@/services/tasksService";
import { useAuth } from "@/context/AuthContext";
import { Calendar, Phone } from "lucide-react";

const fmtDate = (val) => {
  if (!val) return "—";
  if (typeof val === "string") return val;
  if (val?.seconds) return new Date(val.seconds * 1000).toLocaleDateString("he-IL");
  try { return new Date(val).toLocaleDateString("he-IL"); } catch { return "—"; }
};

const FILTERS = [
  { key: "all", label: "הכל" },
  { key: "open", label: "פתוחות" },
  { key: "in_progress", label: "בטיפול" },
  { key: "done", label: "הושלמו" },
];

export default function VolunteerTasks() {
  const { user } = useAuth();
  const { volunteer, loading: vLoading, error: vError } = useCurrentVolunteer();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (vLoading) return;
      try {
        setLoading(true);
        setError("");
        let list = [];
        if (volunteer?.id) list = await getTasksForVolunteer(volunteer.id);
        if ((!list || list.length === 0) && user?.uid) list = await getTasksForAuthUid(user.uid);
        if (!cancelled) setTasks(list);
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

  const counts = useMemo(() => {
    const c = { all: tasks.length, open: 0, in_progress: 0, done: 0 };
    tasks.forEach((t) => {
      const s = t.status || "open";
      if (c[s] !== undefined) c[s]++;
    });
    return c;
  }, [tasks]);

  const filtered = useMemo(() => {
    if (filter === "all") return tasks;
    return tasks.filter((t) => (t.status || "open") === filter);
  }, [tasks, filter]);

  return (
    <VolunteerLayout title="" subtitle="">
      <div className="vol-tasks-container">
        <div className="vol-page-header with-accent">
          <h1>המשימות שלי</h1>
          <p>משימות ומפגשים שהוקצו לך על ידי הרכזת</p>
        </div>

        <div className="vol-task-pills">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`vol-pill ${filter === f.key ? "active" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label} ({counts[f.key] ?? 0})
            </button>
          ))}
        </div>

        {vError && <div className="vol-alert-error">{vError}</div>}
        {(loading || vLoading) && <LoadingLine text="טוען משימות..." />}
        {!loading && !vLoading && error && <div className="vol-alert-error">{error}</div>}

        {!loading && !vLoading && !error && filtered.length === 0 && (
          <div className="vol-card vol-card-pad" style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
            אין משימות פעילות כרגע
          </div>
        )}

        {!loading && !vLoading && filtered.map((t) => (
          <div key={t.id} className="vol-task-card">
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
      </div>
    </VolunteerLayout>
  );
}
