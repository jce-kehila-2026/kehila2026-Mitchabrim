import { useEffect, useMemo, useRef, useState } from "react";
import AdminPageLayout from "@/components/admin/AdminPageLayout.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import StatsCard from "@/components/admin/StatsCard.jsx";
import DataTable from "@/components/admin/DataTable.jsx";
import { getAllVolunteerReports, deleteVolunteerReport } from "@/services/reportsService.js";
import {
  getAllTasks,
  createTask,
  updateTask,
  deleteTask,
  TASK_TYPE_OPTIONS,
  TASK_PRIORITY_OPTIONS,
  taskStatusLabel,
  taskTypeLabel,
  taskStatusBadge,
} from "@/services/tasksService.js";
import { getVolunteers } from "@/services/volunteersService.js";
import { getElderly, getElderlyForVolunteerIds } from "@/services/elderlyService.js";
import { useAuth } from "@/context/AuthContext.jsx";
import { createOperationId } from "@/utils/operationId";

const fmt = (val) => {
  if (!val) return "—";
  if (typeof val === "string") return val;
  if (val?.seconds) return new Date(val.seconds * 1000).toLocaleDateString("he-IL");
  try { return new Date(val).toLocaleDateString("he-IL"); } catch { return "—"; }
};

const ts = (val) => {
  if (!val) return 0;
  if (val?.seconds) return val.seconds * 1000;
  try { return new Date(val).getTime() || 0; } catch { return 0; }
};

const volDisplayName = (v) =>
  v?.name || [v?.firstName, v?.lastName].filter(Boolean).join(" ") || "—";

export default function VolunteerReports() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [volunteers, setVolunteers] = useState([]);
  const [reports, setReports] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [elderlyByVol, setElderlyByVol] = useState(new Map());

  const [selectedVolId, setSelectedVolId] = useState(null);
  const [showBulk, setShowBulk] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [vols, reps, tsk] = await Promise.all([
        getVolunteers(),
        getAllVolunteerReports().catch(() => []),
        getAllTasks().catch(() => []),
      ]);
      setVolunteers(vols);
      setReports(reps);
      setTasks(tsk);

      // Fetch assigned elderly for all volunteers (chunked `in` queries).
      try {
        const el = await getElderlyForVolunteerIds(vols.map((v) => v.id));
        const map = new Map();
        el.forEach((e) => {
          if (!e.volId) return;
          const arr = map.get(e.volId) || [];
          arr.push(e);
          map.set(e.volId, arr);
        });
        setElderlyByVol(map);
      } catch {
        setElderlyByVol(new Map());
      }
    } catch (err) {
      console.error(err);
      setError("שגיאה בטעינת נתוני המתנדבים");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const selectedVol = useMemo(
    () => volunteers.find((v) => v.id === selectedVolId) || null,
    [volunteers, selectedVolId]
  );

  return (
    <AdminPageLayout
      heroImage="/admin-heroes/volunteer_reports_tasks_hero.webp"
      title="דוחות ומשימות המתנדבים"
      subtitle="ניהול הדוחות שהוגשו ומשימות שהוקצו למתנדבים"
    >
      {error && <SectionCard><p style={{ color: "red" }}>{error}</p></SectionCard>}

      {loading ? (
        <SectionCard><p style={{ padding: 20 }}>טוען נתונים...</p></SectionCard>
      ) : selectedVol ? (
        <VolunteerFileView
          user={user}
          volunteer={selectedVol}
          reports={reports.filter((r) => r.volunteerId === selectedVol.id)}
          tasks={tasks.filter((t) => t.volunteerId === selectedVol.id)}
          elderlyList={elderlyByVol.get(selectedVol.id) || []}
          allElderly={[...elderlyByVol.values()].flat()}
          onBack={() => setSelectedVolId(null)}
          onReportsChange={setReports}
          onTasksChange={setTasks}
        />
      ) : (
        <VolunteersOverview
          volunteers={volunteers}
          reports={reports}
          tasks={tasks}
          elderlyByVol={elderlyByVol}
          onOpen={(id) => setSelectedVolId(id)}
          onBulk={() => setShowBulk(true)}
        />
      )}

      {showBulk && (
        <BulkAssignTaskModal
          user={user}
          volunteers={volunteers}
          elderlyByVol={elderlyByVol}
          onClose={() => setShowBulk(false)}
          onCreated={(created) => {
            setTasks((prev) => [...created, ...prev]);
            setShowBulk(false);
          }}
        />
      )}
    </AdminPageLayout>
  );
}

/* =========================
   Volunteers overview
========================= */

function VolunteersOverview({ volunteers, reports, tasks, elderlyByVol, onOpen, onBulk }) {
  const [search, setSearch] = useState("");

  const perVol = useMemo(() => {
    const rMap = new Map();
    const tMap = new Map();
    const latestMap = new Map();
    reports.forEach((r) => {
      if (!r.volunteerId) return;
      rMap.set(r.volunteerId, (rMap.get(r.volunteerId) || 0) + 1);
      const t = ts(r.reportDate) || ts(r.createdAt);
      if (t > (latestMap.get(r.volunteerId) || 0)) latestMap.set(r.volunteerId, t);
    });
    tasks.forEach((t) => {
      if (!t.volunteerId) return;
      const cur = tMap.get(t.volunteerId) || { total: 0, open: 0 };
      cur.total += 1;
      if (!t.status || t.status === "open" || t.status === "in_progress") cur.open += 1;
      tMap.set(t.volunteerId, cur);
    });
    return { rMap, tMap, latestMap };
  }, [reports, tasks]);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return volunteers
      .map((v) => {
        const el = elderlyByVol.get(v.id) || [];
        const elderlyName = el.map((e) => e.name).join(", ");
        return {
          id: v.id,
          name: volDisplayName(v),
          phone: v.phone || "",
          email: v.email || "",
          elderlyName,
          reportsCount: perVol.rMap.get(v.id) || 0,
          tasksCount: perVol.tMap.get(v.id)?.total || 0,
          openTasks: perVol.tMap.get(v.id)?.open || 0,
          latest: perVol.latestMap.get(v.id) || 0,
        };
      })
      .filter((r) => {
        if (!s) return true;
        return [r.name, r.phone, r.email, r.elderlyName]
          .join(" ")
          .toLowerCase()
          .includes(s);
      });
  }, [volunteers, elderlyByVol, perVol, search]);

  const totals = useMemo(() => ({
    volunteers: volunteers.length,
    reports: reports.length,
    tasks: tasks.length,
    openTasks: tasks.filter((t) => !t.status || t.status === "open" || t.status === "in_progress").length,
  }), [volunteers, reports, tasks]);

  return (
    <>
      <div className="stats-grid">
        <StatsCard icon="👥" title="סה״כ מתנדבים" value={String(totals.volunteers)} />
        <StatsCard icon="📋" title="סה״כ דוחות" value={String(totals.reports)} />
        <StatsCard icon="📝" title="סה״כ משימות" value={String(totals.tasks)} />
        <StatsCard icon="🔓" title="משימות פתוחות" value={String(totals.openTasks)} />
      </div>

      <SectionCard title="מתנדבים">
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
          <input
            className="input"
            placeholder="חיפוש לפי שם, טלפון, אימייל או אזרח ותיק..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 360 }}
          />
          <button className="btn btn-primary" onClick={onBulk}>הוספת משימה למספר מתנדבים</button>
        </div>

        <DataTable
          columns={[
            { key: "name", label: "שם המתנדב", render: (r) => r.name },
            { key: "elderlyName", label: "אזרח ותיק משויך", render: (r) => r.elderlyName || "—" },
            { key: "reportsCount", label: "דוחות", render: (r) => String(r.reportsCount) },
            { key: "tasksCount", label: "משימות", render: (r) => String(r.tasksCount) },
            { key: "openTasks", label: "משימות פתוחות", render: (r) => String(r.openTasks) },
            { key: "latest", label: "דוח אחרון", render: (r) => (r.latest ? new Date(r.latest).toLocaleDateString("he-IL") : "—") },
            {
              key: "actions",
              label: "פעולות",
              render: (r) => (
                <button className="btn btn-primary" onClick={() => onOpen(r.id)}>
                  צפייה בתיק מתנדב
                </button>
              ),
            },
          ]}
          data={rows}
        />
      </SectionCard>
    </>
  );
}

/* =========================
   Volunteer file view
========================= */

function VolunteerFileView({
  user,
  volunteer,
  reports,
  tasks,
  elderlyList,
  allElderly,
  onBack,
  onReportsChange,
  onTasksChange,
}) {
  const [tab, setTab] = useState("reports");
  const [openReportId, setOpenReportId] = useState(null);
  const [openTaskId, setOpenTaskId] = useState(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const taskOperationId = useRef(null);

  const sortedReports = useMemo(
    () => [...reports].sort((a, b) => (ts(b.reportDate) || ts(b.createdAt)) - (ts(a.reportDate) || ts(a.createdAt))),
    [reports]
  );
  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => (ts(b.dueDate) || ts(b.createdAt)) - (ts(a.dueDate) || ts(a.createdAt))),
    [tasks]
  );

  const openReport = sortedReports.find((r) => r.id === openReportId) || null;
  const openTask = sortedTasks.find((t) => t.id === openTaskId) || null;

  const handleDeleteReport = async (id) => {
    if (!window.confirm("האם אתה בטוח שברצונך למחוק את הדוח?")) return;
    try {
      await deleteVolunteerReport(id);
      onReportsChange((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error(err); alert("שגיאה במחיקת הדוח");
    }
  };

  const handleCreateTask = async (data) => {
    try {
      taskOperationId.current ||= createOperationId();
      const saved = await createTask(data, user?.uid || user?.email || null, taskOperationId.current);
      onTasksChange((prev) => [saved, ...prev]);
      taskOperationId.current = null;
      setShowTaskForm(false);
    } catch (err) {
      console.error(err); alert("שגיאה ביצירת משימה");
    }
  };

  const handleUpdateTask = async (id, patch) => {
    try {
      await updateTask(id, patch);
      onTasksChange((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      setEditTask(null);
    } catch (err) {
      console.error(err); alert("שגיאה בעדכון המשימה");
    }
  };

  const handleDeleteTask = async (id) => {
    if (!window.confirm("למחוק את המשימה?")) return;
    try {
      await deleteTask(id);
      onTasksChange((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error(err); alert("שגיאה במחיקת המשימה");
    }
  };

  const elderlyForForm = allElderly.length ? allElderly : elderlyList;

  return (
    <>
      <SectionCard>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <button className="btn" onClick={onBack}>← חזרה לכל המתנדבים</button>
          </div>
          <div style={{ textAlign: "left" }}>
            <h2 style={{ margin: 0 }}>{volDisplayName(volunteer)}</h2>
            <div style={{ color: "#666", fontSize: 14 }}>
              {elderlyList.length > 0 ? `אזרח ותיק: ${elderlyList.map((e) => e.name).join(", ")}` : "לא משויך לאזרח ותיק"}
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="tab-buttons" style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        <button className={`btn ${tab === "reports" ? "btn-primary" : ""}`} onClick={() => setTab("reports")}>
          דוחות המתנדב ({sortedReports.length})
        </button>
        <button className={`btn ${tab === "tasks" ? "btn-primary" : ""}`} onClick={() => setTab("tasks")}>
          משימות המתנדב ({sortedTasks.length})
        </button>
      </div>

      {tab === "reports" ? (
        <SectionCard>
          <DataTable
            columns={[
              { key: "reportDate", label: "תאריך המפגש", render: (r) => fmt(r.reportDate || r.createdAt) },
              { key: "elderlyName", label: "שם אזרח ותיק", render: (r) => r.elderlyName || "—" },
              { key: "reportType", label: "סוג מפגש", render: (r) => r.reportType || "—" },
              {
                key: "notes",
                label: "תיאור המפגש",
                render: (r) => (
                  <span style={{ display: "inline-block", maxWidth: 320, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.notes || "—"}
                  </span>
                ),
              },
              {
                key: "actions",
                label: "פעולות",
                render: (r) => (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn" onClick={() => setOpenReportId(r.id)}>צפייה בפרטים</button>
                    <button className="btn btn-danger" onClick={() => handleDeleteReport(r.id)}>מחיקה</button>
                  </div>
                ),
              },
            ]}
            data={sortedReports}
          />
        </SectionCard>
      ) : (
        <SectionCard>
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn-primary" onClick={() => {
              taskOperationId.current = createOperationId();
              setShowTaskForm(true);
            }}>הוספת משימה למתנדב</button>
          </div>
          <DataTable
            columns={[
              { key: "title", label: "כותרת", render: (t) => t.title || "—" },
              { key: "taskType", label: "סוג", render: (t) => taskTypeLabel(t.taskType) },
              { key: "elderlyName", label: "אזרח ותיק", render: (t) => t.elderlyName || "—" },
              { key: "dueDate", label: "תאריך יעד", render: (t) => fmt(t.dueDate) },
              {
                key: "status",
                label: "סטטוס (מתנדב)",
                render: (t) => (
                  <span className={`badge ${taskStatusBadge(t.status)}`} title="הסטטוס מנוהל על ידי המתנדב">
                    {taskStatusLabel(t.status)}
                  </span>
                ),
              },
              {
                key: "actions",
                label: "פעולות",
                render: (t) => (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn" onClick={() => setOpenTaskId(t.id)}>פרטים</button>
                    <button className="btn" onClick={() => setEditTask(t)}>עריכה</button>
                    <button className="btn btn-danger" onClick={() => handleDeleteTask(t.id)}>מחיקה</button>
                  </div>
                ),
              },
            ]}
            data={sortedTasks}
          />
        </SectionCard>
      )}

      {openReport && <ReportDetailModal report={openReport} onClose={() => setOpenReportId(null)} />}
      {openTask && <TaskDetailModal task={openTask} onClose={() => setOpenTaskId(null)} />}
      {showTaskForm && (
        <TaskFormModal
          volunteer={volunteer}
          elderly={elderlyForForm}
          onClose={() => {
            taskOperationId.current = null;
            setShowTaskForm(false);
          }}
          onSave={handleCreateTask}
        />
      )}
      {editTask && (
        <TaskFormModal
          task={editTask}
          volunteer={volunteer}
          elderly={elderlyForForm}
          onClose={() => setEditTask(null)}
          onSave={(data) => handleUpdateTask(editTask.id, data)}
        />
      )}
    </>
  );
}

/* =========================
   Report detail modal
========================= */

function ReportDetailModal({ report, onClose }) {
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
            <div className="item" style={{ gridColumn: "1 / -1" }}>
              <label>תיאור המפגש</label>
              <div style={{ whiteSpace: "pre-wrap" }}>{report.notes || "—"}</div>
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>סגירה</button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Task detail modal (read-only)
========================= */

function TaskDetailModal({ task, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
        <div className="modal-header">
          <h2>פרטי משימה — {task.title}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="form-section">
          <div className="detail-grid">
            <div className="item"><label>מתנדב</label><div>{task.volunteerName || "—"}</div></div>
            <div className="item"><label>סוג</label><div>{taskTypeLabel(task.taskType)}</div></div>
            <div className="item"><label>אזרח ותיק</label><div>{task.elderlyName || "—"}</div></div>
            <div className="item"><label>תאריך יעד</label><div>{fmt(task.dueDate)}</div></div>
            <div className="item">
              <label>סטטוס (מנוהל על ידי המתנדב)</label>
              <div><span className={`badge ${taskStatusBadge(task.status)}`}>{taskStatusLabel(task.status)}</span></div>
            </div>
            <div className="item" style={{ gridColumn: "1 / -1" }}>
              <label>פרטי משימה</label>
              <div style={{ whiteSpace: "pre-wrap" }}>{task.description || "—"}</div>
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>סגירה</button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Task form modal (single volunteer, pre-selected)
========================= */

function TaskFormModal({ task, volunteer, elderly = [], onClose, onSave }) {
  const isEdit = !!task;
  const [form, setForm] = useState(() => ({
    title: task?.title || "",
    taskType: task?.taskType || "visit",
    dueDate: task?.dueDate && typeof task.dueDate === "string" ? task.dueDate : "",
    elderlyId: task?.elderlyId || "",
    description: task?.description || "",
    priority: task?.priority || "normal",
  }));

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return alert("יש להזין כותרת");

    const el = elderly.find((x) => x.id === form.elderlyId);
    const elderlyName = el?.name || [el?.firstName, el?.lastName].filter(Boolean).join(" ") || "";

    const payload = {
      volunteerId: volunteer.id,
      volunteerAuthUid: volunteer.authUid || null,
      volunteerName: volDisplayName(volunteer),
      title: form.title.trim(),
      description: form.description,
      taskType: form.taskType,
      elderlyId: form.elderlyId || null,
      elderlyName,
      dueDate: form.dueDate || null,
      priority: form.priority,
    };
    if (!isEdit) payload.status = "open";
    onSave(payload);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
        <div className="modal-header">
          <h2>{isEdit ? "עריכת משימה" : `הוספת משימה — ${volDisplayName(volunteer)}`}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="form-section">
          <div className="row row-2">
            <div className="field">
              <label>מתנדב/ת</label>
              <input className="input" value={volDisplayName(volunteer)} disabled readOnly />
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
                <label>סטטוס (מנוהל על ידי המתנדב)</label>
                <input className="input" value={taskStatusLabel(task?.status)} disabled readOnly />
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

/* =========================
   Bulk assign task modal
========================= */

const PAGE_SIZE = 25;

function BulkAssignTaskModal({ user, volunteers, elderlyByVol, onClose, onCreated }) {
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assignedFilter, setAssignedFilter] = useState(""); // "", "assigned", "unassigned"
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const bulkOperationId = useRef(createOperationId());

  const [form, setForm] = useState({
    title: "",
    taskType: "visit",
    dueDate: "",
    description: "",
    priority: "normal",
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const areas = useMemo(() => {
    const s = new Set();
    volunteers.forEach((v) => v.area && s.add(v.area));
    return [...s].sort();
  }, [volunteers]);

  const statuses = useMemo(() => {
    const s = new Set();
    volunteers.forEach((v) => v.status && s.add(v.status));
    return [...s].sort();
  }, [volunteers]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return volunteers.filter((v) => {
      const el = elderlyByVol.get(v.id) || [];
      const elderlyName = el.map((e) => e.name).join(" ");
      const hay = [volDisplayName(v), v.email, v.phone, elderlyName].join(" ").toLowerCase();
      if (s && !hay.includes(s)) return false;
      if (areaFilter && v.area !== areaFilter) return false;
      if (statusFilter && v.status !== statusFilter) return false;
      if (assignedFilter === "assigned" && el.length === 0) return false;
      if (assignedFilter === "unassigned" && el.length > 0) return false;
      return true;
    });
  }, [volunteers, elderlyByVol, search, areaFilter, statusFilter, assignedFilter]);

  const visible = filtered.slice(0, visibleCount);

  const toggle = (id) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const selectAllVisible = () => {
    setSelected((prev) => {
      const n = new Set(prev);
      visible.forEach((v) => n.add(v.id));
      return n;
    });
  };

  const clearAll = () => setSelected(new Set());

  const selectedList = useMemo(
    () => volunteers.filter((v) => selected.has(v.id)),
    [volunteers, selected]
  );

  const submit = async () => {
    if (!form.title.trim()) return alert("יש להזין כותרת למשימה");
    if (selected.size === 0) return alert("יש לבחור לפחות מתנדב אחד");
    if (!confirming) { setConfirming(true); return; }

    setSubmitting(true);
    const results = await Promise.allSettled(
      selectedList.map((v) => {
        const el = elderlyByVol.get(v.id) || [];
        const firstEl = el[0];
        const payload = {
          volunteerId: v.id,
          volunteerAuthUid: v.authUid || null,
          volunteerName: volDisplayName(v),
          title: form.title.trim(),
          description: form.description,
          taskType: form.taskType,
          elderlyId: firstEl?.id || null,
          elderlyName: firstEl?.name || "",
          dueDate: form.dueDate || null,
          priority: form.priority,
          status: "open",
        };
        return createTask(
          payload,
          user?.uid || user?.email || null,
          `${bulkOperationId.current}_${v.id}`.slice(0, 128),
        );
      })
    );
    setSubmitting(false);
    const created = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
    const failed = results.length - created.length;
    if (failed === 0) {
      alert(`המשימה נשלחה ל־${created.length} מתנדבים`);
    } else {
      alert(`המשימה נשלחה ל־${created.length} מתנדבים. ${failed} כשלונות.`);
    }
    onCreated(created);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900 }}>
        <div className="modal-header">
          <h2>הוספת משימה למספר מתנדבים</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-section">
          <h3 style={{ marginTop: 0 }}>פרטי המשימה</h3>
          <div className="row row-2">
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
              <label>עדיפות</label>
              <select className="select" value={form.priority} onChange={set("priority")}>
                {TASK_PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>פרטי משימה</label>
            <textarea className="textarea" rows={2} value={form.description} onChange={set("description")} />
          </div>

          <h3>בחירת מתנדבים</h3>
          <div className="row row-2" style={{ marginBottom: 8 }}>
            <div className="field">
              <label>חיפוש</label>
              <input
                className="input"
                placeholder="שם, אימייל, טלפון או אזרח ותיק..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE); }}
              />
            </div>
            <div className="field">
              <label>אזור</label>
              <select className="select" value={areaFilter} onChange={(e) => { setAreaFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}>
                <option value="">הכל</option>
                {areas.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="field">
              <label>סטטוס מתנדב</label>
              <select className="select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}>
                <option value="">הכל</option>
                {statuses.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="field">
              <label>שיוך לאזרח ותיק</label>
              <select className="select" value={assignedFilter} onChange={(e) => { setAssignedFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}>
                <option value="">הכל</option>
                <option value="assigned">משויכים</option>
                <option value="unassigned">לא משויכים</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn" onClick={selectAllVisible}>בחר את כל התוצאות הנראות</button>
            <button type="button" className="btn" onClick={clearAll}>נקה בחירה</button>
            <span style={{ marginInlineStart: "auto", alignSelf: "center", color: "#555" }}>
              נבחרו {selected.size} מתנדבים • מציג {visible.length} מתוך {filtered.length}
            </span>
          </div>

          <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid #eee", borderRadius: 6 }}>
            {visible.length === 0 ? (
              <div style={{ padding: 16, textAlign: "center", color: "#777" }}>לא נמצאו מתנדבים</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>שם</th>
                    <th>אזרח ותיק</th>
                    <th>אזור</th>
                    <th>סטטוס</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((v) => {
                    const el = elderlyByVol.get(v.id) || [];
                    return (
                      <tr key={v.id} onClick={() => toggle(v.id)} style={{ cursor: "pointer" }}>
                        <td><input type="checkbox" checked={selected.has(v.id)} onChange={() => toggle(v.id)} /></td>
                        <td>{volDisplayName(v)}</td>
                        <td>{el.map((e) => e.name).join(", ") || "—"}</td>
                        <td>{v.area || "—"}</td>
                        <td>{v.status || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          {visibleCount < filtered.length && (
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <button type="button" className="btn" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
                הצג עוד ({filtered.length - visibleCount} נוספים)
              </button>
            </div>
          )}

          {selected.size > 0 && (
            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>נבחרו:</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {selectedList.map((v) => (
                  <span key={v.id} style={{ background: "#f0f4f8", padding: "4px 8px", borderRadius: 12, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {volDisplayName(v)}
                    <button type="button" onClick={() => toggle(v.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#c00" }}>×</button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {confirming && (
            <div style={{ marginTop: 12, padding: 12, background: "#fff8e1", border: "1px solid #ffe082", borderRadius: 6 }}>
              המשימה "<strong>{form.title}</strong>" תישלח ל־<strong>{selected.size}</strong> מתנדבים. לאישור לחצו שוב על "שליחה".
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? "שולח..." : confirming ? `אישור ושליחה (${selected.size})` : "שליחה"}
          </button>
          <button type="button" className="btn" onClick={onClose} disabled={submitting}>ביטול</button>
        </div>
      </div>
    </div>
  );
}
