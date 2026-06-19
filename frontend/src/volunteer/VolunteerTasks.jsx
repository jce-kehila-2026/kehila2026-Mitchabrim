import { useEffect, useState } from "react";
import VolunteerLayout from "@/components/volunteer/VolunteerLayout.jsx";
import useCurrentVolunteer from "@/hooks/useCurrentVolunteer";
import {
  getTasksForVolunteer,
  getTasksForAuthUid,
  taskStatusLabel,
  taskTypeLabel,
  taskStatusBadge,
} from "@/services/tasksService";
import { useAuth } from "@/context/AuthContext";

const fmtDate = (val) => {
  if (!val) return "—";
  if (typeof val === "string") return val;
  if (val?.seconds) return new Date(val.seconds * 1000).toLocaleDateString("he-IL");
  try { return new Date(val).toLocaleDateString("he-IL"); } catch { return "—"; }
};

export default function VolunteerTasks() {
  const { user } = useAuth();
  const { volunteer, loading: vLoading, error: vError } = useCurrentVolunteer();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (vLoading) return;
      try {
        setLoading(true);
        setError("");
        let list = [];
        if (volunteer?.id) {
          list = await getTasksForVolunteer(volunteer.id);
        }
        if ((!list || list.length === 0) && user?.uid) {
          list = await getTasksForAuthUid(user.uid);
        }
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

  return (
    <VolunteerLayout title="המשימות שלי" subtitle="משימות ומפגשים שהוקצו לך על ידי הרכזת">
      {vError && <div style={{ color: "#dc2626", marginBottom: 12 }}>{vError}</div>}
      {(loading || vLoading) && <p>טוען משימות...</p>}
      {!loading && !vLoading && error && <div style={{ color: "#dc2626" }}>{error}</div>}
      {!loading && !vLoading && !error && tasks.length === 0 && (
        <div className="card" style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
          אין משימות פעילות כרגע
        </div>
      )}
      {!loading && !vLoading && tasks.map((t) => (
        <div key={t.id} className="vol-task-card">
          <div className="head">
            <div>
              <h4>{t.title || "משימה"}</h4>
              <div className="vol-task-meta">
                {[t.elderlyName, taskTypeLabel(t.taskType), fmtDate(t.dueDate)].filter(Boolean).join(" • ")}
              </div>
            </div>
            <span className={`badge ${taskStatusBadge(t.status)}`}>{taskStatusLabel(t.status)}</span>
          </div>
          {t.description && (
            <p style={{ marginTop: 10, color: "var(--color-text-muted)", fontSize: 14 }}>{t.description}</p>
          )}
        </div>
      ))}
    </VolunteerLayout>
  );
}