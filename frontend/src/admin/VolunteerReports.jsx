import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import StatsCard from "@/components/admin/StatsCard.jsx";
import DataTable from "@/components/admin/DataTable.jsx";
import { getAllVolunteerReports, updateReportReview } from "@/services/reportsService.js";
import {
  getAllTasks,
  createTask,
  updateTask,
  deleteTask,
  TASK_STATUS_OPTIONS,
  TASK_TYPE_OPTIONS,
  TASK_PRIORITY_OPTIONS,
  taskStatusLabel,
  taskTypeLabel,
  taskStatusBadge,
} from "@/services/tasksService.js";
import { getVolunteers } from "@/services/volunteersService.js";
import { getElderly } from "@/services/elderlyService.js";
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
  const [tab, setTab] = useState("reports");

  return (
    <AdminLayout
      title="דוחות ומשימות המתנדבים"
      subtitle="ניהול הדוחות שהוגשו ומשימות שהוקצו למתנדבים"
    >
      <div className="tab-buttons" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          className={`btn ${tab === "reports" ? "btn-primary" : ""}`}
          onClick={() => setTab("reports")}
        >
          דוחות מתנדבים
        </button>
        <button
          className={`btn ${tab === "tasks" ? "btn-primary" : ""}`}
          onClick={() => setTab("tasks")}
        >
          משימות מתנדבים
        </button>
      </div>

      {tab === "reports" ? <ReportsTab user={user} /> : <TasksTab user={user} />}
    </AdminLayout>
  );
}

/* =========================
   Reports Tab
========================= */

function ReportsTab({ user }) {
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
    <>
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
    </>
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

/* =========================
   Tasks Tab
========================= */

function TasksTab({ user }) {
  const [tasks, setTasks] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [elderly, setElderly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [filterStatus, setFilterStatus] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [t, v, e] = await Promise.all([
        getAllTasks(),
        getVolunteers(),
        getElderly().catch(() => []),
      ]);
      setTasks(t);
      setVolunteers(v);
      setElderly(e);
    } catch (err) {
      console.error(err);
      setError("שגיאה בטעינת המשימות");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(
    () => tasks.filter((t) => !filterStatus || t.status === filterStatus),
    [tasks, filterStatus],
  );

  const totals = useMemo(() => ({
    total: tasks.length,
    open: tasks.filter((t) => !t.status || t.status === "open").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    done: tasks.filter((t) => t.status === "done").length,
  }), [tasks]);

  const handleCreate = async (data) => {
    try {
      const saved = await createTask(data, user?.uid || user?.email || null);
      setTasks((prev) => [saved, ...prev]);
      setShowForm(false);
    } catch (err) {
      console.error(err);
      alert("שגיאה ביצירת משימה");
    }
  };

  const handleUpdate = async (id, patch) => {
    try {
      await updateTask(id, patch);
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      setEditTask(null);
    } catch (err) {
      console.error(err);
      alert("שגיאה בעדכון המשימה");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("למחוק את המשימה?")) return;
    try {
      await deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error(err);
      alert("שגיאה במחיקת המשימה");
    }
  };

  return (
    <>
      {error && <SectionCard><p style={{ color: "red" }}>{error}</p></SectionCard>}

      <div className="stats-grid">
        <StatsCard title="סה״כ משימות" value={String(totals.total)} />
        <StatsCard title="פתוחות" value={String(totals.open)} />
        <StatsCard title="בטיפול" value={String(totals.inProgress)} />
        <StatsCard title="בוצעו" value={String(totals.done)} />
      </div>

      <SectionCard>
        <div style={{ marginBottom: 12, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <label>סטטוס:</label>
            <select className="select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ maxWidth: 200 }}>
              <option value="">הכל</option>
              {TASK_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>הוספת משימה למתנדב</button>
        </div>

        {loading ? (
          <p style={{ padding: 20 }}>טוען משימות...</p>
        ) : (
          <DataTable
            columns={[
              { key: "title", label: "כותרת", render: (t) => t.title || "—" },
              { key: "volunteerName", label: "מתנדב", render: (t) => t.volunteerName || "—" },
              { key: "taskType", label: "סוג", render: (t) => taskTypeLabel(t.taskType) },
              { key: "elderlyName", label: "אזרח ותיק", render: (t) => t.elderlyName || "—" },
              { key: "dueDate", label: "תאריך יעד", render: (t) => fmt(t.dueDate) },
              {
                key: "status",
                label: "סטטוס",
                render: (t) => <span className={`badge ${taskStatusBadge(t.status)}`}>{taskStatusLabel(t.status)}</span>,
              },
              {
                key: "actions",
                label: "פעולות",
                render: (t) => (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn" onClick={() => setEditTask(t)}>עריכה</button>
                    <button className="btn btn-danger" onClick={() => handleDelete(t.id)}>מחיקה</button>
                  </div>
                ),
              },
            ]}
            data={visible}
          />
        )}
      </SectionCard>

      {showForm && (
        <TaskFormModal
          volunteers={volunteers}
          elderly={elderly}
          onClose={() => setShowForm(false)}
          onSave={handleCreate}
        />
      )}
      {editTask && (
        <TaskFormModal
          task={editTask}
          volunteers={volunteers}
          elderly={elderly}
          onClose={() => setEditTask(null)}
          onSave={(data) => handleUpdate(editTask.id, data)}
        />
      )}
    </>
  );
}

function TaskFormModal({ task, volunteers, elderly = [], onClose, onSave }) {
  const isEdit = !!task;
  const [form, setForm] = useState(() => ({
    volunteerId: task?.volunteerId || "",
    title: task?.title || "",
    taskType: task?.taskType || "visit",
    dueDate: task?.dueDate && typeof task.dueDate === "string" ? task.dueDate : "",
    elderlyId: task?.elderlyId || "",
    description: task?.description || "",
    priority: task?.priority || "normal",
    status: task?.status || "open",
  }));

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.volunteerId) return alert("יש לבחור מתנדב");
    if (!form.title.trim()) return alert("יש להזין כותרת");

    const v = volunteers.find((x) => x.id === form.volunteerId);
    const el = elderly.find((x) => x.id === form.elderlyId);
    const volunteerName =
      v?.name || [v?.firstName, v?.lastName].filter(Boolean).join(" ") || "";
    const elderlyName = el?.name || [el?.firstName, el?.lastName].filter(Boolean).join(" ") || "";

    const payload = {
      volunteerId: form.volunteerId,
      volunteerAuthUid: v?.authUid || null,
      volunteerName,
      title: form.title.trim(),
      description: form.description,
      taskType: form.taskType,
      elderlyId: form.elderlyId || null,
      elderlyName,
      dueDate: form.dueDate || null,
      priority: form.priority,
      status: form.status,
    };
    onSave(payload);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
        <div className="modal-header">
          <h2>{isEdit ? "עריכת משימה" : "הוספת משימה למתנדב"}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="form-section">
          <div className="row row-2">
            <div className="field">
              <label>מתנדב/ת *</label>
              <select className="select" value={form.volunteerId} onChange={set("volunteerId")} disabled={isEdit}>
                <option value="">בחר מתנדב/ת</option>
                {volunteers.map((v) => {
                  const n = v.name || [v.firstName, v.lastName].filter(Boolean).join(" ") || v.id;
                  return <option key={v.id} value={v.id}>{n}</option>;
                })}
              </select>
            </div>
            <div className="field">
              <label>כותרת *</label>
              <input className="input" value={form.title} onChange={set("title")} />
            </div>
            <div className="field">
              <label>סוג משימה</label>
              <select className="select" value={form.taskType} onChange={set("taskType")}>
                {TASK_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>תאריך יעד</label>
              <input className="input" type="date" value={form.dueDate} onChange={set("dueDate")} />
            </div>
            <div className="field">
              <label>אזרח ותיק (אופציונלי)</label>
              <select className="select" value={form.elderlyId} onChange={set("elderlyId")}>
                <option value="">ללא</option>
                {elderly.map((el) => {
                  const n = el.name || [el.firstName, el.lastName].filter(Boolean).join(" ") || el.id;
                  return <option key={el.id} value={el.id}>{n}</option>;
                })}
              </select>
            </div>
            <div className="field">
              <label>עדיפות</label>
              <select className="select" value={form.priority} onChange={set("priority")}>
                {TASK_PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {isEdit && (
              <div className="field">
                <label>סטטוס</label>
                <select className="select" value={form.status} onChange={set("status")}>
                  {TASK_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="field">
            <label>פרטי משימה</label>
            <textarea className="textarea" rows={3} value={form.description} onChange={set("description")} />
          </div>
          <div className="modal-actions">
            <button type="submit" className="btn btn-primary">{isEdit ? "שמירה" : "הוספה"}</button>
            <button type="button" className="btn" onClick={onClose}>ביטול</button>
          </div>
        </form>
      </div>
    </div>
  );
}