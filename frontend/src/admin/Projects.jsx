import { useEffect, useMemo, useRef, useState } from "react";
import AdminPageLayout from "@/components/admin/AdminPageLayout.jsx";
import StatsCard from "@/components/admin/StatsCard.jsx";
import SearchFilters from "@/components/admin/SearchFilters.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import DataTable from "@/components/admin/DataTable.jsx";
import {
  getProjects,
  createProject,
  editProject,
  deleteProjectCascade,
  getElderlyParticipants,
  addElderlyParticipants,
  updateElderlyParticipant,
  removeElderlyParticipant,
  getProjectGroups,
  addProjectGroups,
  removeProjectGroup,
  setProjectGroupVolunteers,
} from "@/services/projectsService.js";
import { getElderly } from "@/services/elderlyService.js";
import { getVolunteers, getVolunteerGroups } from "@/services/volunteersService.js";
import useAreasAndNeighborhoods from "@/hooks/useAreasAndNeighborhoods.js";
import { sanitizeFormData } from "@/utils/sanitize";
import { validateDate } from "@/utils/validation";

/* ============================================================
   Static reference data — only enums/options. All groups,
   volunteers, neighborhoods and elderly come from Firestore.
============================================================ */

const PROJECT_TYPES = ["חלוקת חבילות", "אירוע קהילתי", "פעילות מיוחדת", "שי לחג"];
const PROJECT_STATUSES = ["פעיל", "הסתיים", "בוטל"];

/* ============================================================
   Normalizers — Firestore docs may use a few field-name variants.
============================================================ */

const volName = (v) =>
  v?.name || `${v?.firstName || v?.first || ""} ${v?.lastName || v?.last || ""}`.trim();
const volPhone = (v) => v?.phone || v?.mobile || v?.homePhone || "";
const volEmail = (v) => v?.email || "";
const volStatus = (v) => v?.status || "פעיל";
const volNotes = (v) => v?.notes || v?.groupNotes || "";
const volRole = (v) => v?.role || v?.groupRole || "";

const groupMembers = (g, volsInGroup) =>
  Array.isArray(volsInGroup) ? volsInGroup.length : (g?.count ?? g?.members ?? 0);
const groupContact = (g) => g?.contact || "";
const groupPhone = (g) => g?.phone || "";
const groupEmail = (g) => g?.email || "";
const groupRole = (g) => g?.role || g?.notes || "";

const elderlyDisplayName = (e) =>
  `${e?.firstName || e?.first || ""} ${e?.lastName || e?.last || ""}`.trim();
const elderlyDisplayPhone = (e) => e?.mobile || e?.homePhone || e?.phone || "";

/* ============================================================
   Badge helpers
============================================================ */

const projectStatusBadge = (s) =>
  s === "פעיל" ? "badge-green" :
  s === "מתוכנן" ? "badge-orange" :
  s === "הסתיים" ? "badge-gray" :
  s === "בוטל" ? "badge-red" : "";

const receivesBadge = (v) => v === "כן" ? "badge-green" : "badge-gray";
const deliveryBadge = (v) =>
  v === "נמסר" ? "badge-green" :
  v === "ממתין למסירה" ? "badge-orange" :
  "badge-red";

/* ============================================================
   Main page
============================================================ */

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [projectStats, setProjectStats] = useState({}); // { [projectId]: { elderly, packages, delivered } }
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState({ name: "list" });
  const [showAdd, setShowAdd] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ year: "", type: "", status: "", date: "" });

  // Real groups + volunteers from Firestore (shared across all subviews).
  const [allGroups, setAllGroups] = useState([]);
  const [allVolunteers, setAllVolunteers] = useState([]);
  const [allElderly, setAllElderly] = useState([]);

  const volunteersByGroupId = useMemo(() => {
    const map = {};
    allVolunteers.forEach((v) => {
      const gid = v.groupId;
      if (!gid) return;
      if (!map[gid]) map[gid] = [];
      map[gid].push(v);
    });
    return map;
  }, [allVolunteers]);

  const computeStatsForProject = async (projectId) => {
    const list = await getElderlyParticipants(projectId);
    return {
      elderly: list.length,
      packages: list.filter((p) => p.receives === "כן").length,
      delivered: list.filter((p) => p.delivery === "נמסר").length,
    };
  };

  const refreshProjectStats = async (projectId) => {
    try {
      const stats = await computeStatsForProject(projectId);
      setProjectStats((prev) => ({ ...prev, [projectId]: stats }));
    } catch (err) {
      console.error("Failed to refresh project stats", err);
    }
  };

  const setProjectStatsDirect = (projectId, stats) => {
    setProjectStats((prev) => ({ ...prev, [projectId]: stats }));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, groups, volunteers, elderly] = await Promise.all([
          getProjects(),
          getVolunteerGroups().catch(() => []),
          getVolunteers().catch(() => []),
          getElderly().catch(() => []),
        ]);
        if (cancelled) return;
        setProjects(list);
        setAllGroups(groups);
        setAllVolunteers(volunteers);
        setAllElderly(elderly);
        const entries = await Promise.all(
          list.map(async (p) => [p.id, await computeStatsForProject(p.id).catch(() => null)])
        );
        if (cancelled) return;
        const map = {};
        entries.forEach(([id, s]) => { if (s) map[id] = s; });
        setProjectStats(map);
      } catch (err) {
        console.error("Failed to load projects", err);
        if (!cancelled) setLoadError("טעינת הפרויקטים נכשלה");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /**
   * Create a project AND auto-populate it from real database records:
   *   - if allElderly: add every neighborhood + every elderly resident in those
   *     neighborhoods to the project.
   *   - else: add only the selected neighborhoods + the elderly residents that
   *     belong to them.
   *   - for each selected group: attach the group and pre-fill its volunteers
   *     with the volunteers already belonging to that group.
   *
   * No new neighborhoods / elderly / volunteers / groups are created here.
   */
  const handleCreateProject = async (data) => {
    const clean = sanitizeFormData(data);
    const created = await createProject(clean);
    setProjects((prev) => [created, ...prev]);

    const targetNeighborhoods = Array.isArray(data.neighborhoods) ? data.neighborhoods : [];
    const neighSet = new Set(targetNeighborhoods);

    // 1) Elderly participants for the project, derived from real elderly records.
    const participants = allElderly
      .filter((e) => e.neighborhood && neighSet.has(e.neighborhood))
      .map((e) => ({
        elderlyId: e.id,
        neighborhood: e.neighborhood,
        first: e.firstName || e.first || "",
        last: e.lastName || e.last || "",
        phone: e.mobile || e.homePhone || e.phone || "",
        address: e.address || "",
        receives: "כן",
        delivery: "ממתין למסירה",
        notes: "",
      }));

    if (participants.length > 0) {
      try { await addElderlyParticipants(created.id, participants); }
      catch (err) { console.error("Failed to seed elderly participants", err); }
    }

    // 2) Volunteer groups + their existing volunteers.
    const groupIds = Array.isArray(data.groupIds) ? data.groupIds : [];
    if (groupIds.length > 0) {
      try { await addProjectGroups(created.id, groupIds); }
      catch (err) { console.error("Failed to attach groups", err); }
      await Promise.all(
        groupIds.map(async (gid) => {
          const vIds = (volunteersByGroupId[gid] || []).map((v) => v.id);
          if (vIds.length === 0) return;
          try { await setProjectGroupVolunteers(created.id, gid, vIds); }
          catch (err) { console.error("Failed to seed group volunteers", err); }
        })
      );
    }

    // 3) Compute fresh stats for the new project.
    const stats = {
      elderly: participants.length,
      packages: participants.filter((p) => p.receives === "כן").length,
      delivered: participants.filter((p) => p.delivery === "נמסר").length,
    };
    setProjectStats((prev) => ({ ...prev, [created.id]: stats }));
    return created;
  };

  const handleDeleteProject = async (projectId, projectName) => {
    if (!confirm(`למחוק את הפרויקט "${projectName}"?\n\nפעולה זו תמחק את הפרויקט וכל הנתונים הקשורים אליו (אזרחים ותיקים בפרויקט, קבוצות בפרויקט).\n\nהאזרחים הוותיקים, השכונות וקבוצות המתנדבים לא יימחקו מהמערכת.`)) return;
    try {
      await deleteProjectCascade(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      setProjectStats((prev) => {
        const n = { ...prev };
        delete n[projectId];
        return n;
      });
    } catch (err) {
      console.error("Failed to delete project", err);
      alert("מחיקת הפרויקט נכשלה");
    }
  };

  const projectsWithStats = useMemo(() => {
    return projects.map((p) => {
      const s = projectStats[p.id];
      if (!s) return p;
      return { ...p, elderly: s.elderly, packages: s.packages, delivered: s.delivered };
    });
  }, [projects, projectStats]);

  const filtered = useMemo(() => {
    return projectsWithStats.filter((p) => {
      if (filters.year && String(p.year) !== filters.year) return false;
      if (filters.type && p.type !== filters.type) return false;
      if (filters.status && p.status !== filters.status) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!`${p.name} ${p.type} ${p.year}`.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [search, filters, projectsWithStats]);

  const totals = useMemo(() => {
    return Object.values(projectStats).reduce(
      (acc, s) => ({
        elderly: acc.elderly + (s?.elderly || 0),
        packages: acc.packages + (s?.packages || 0),
        delivered: acc.delivered + (s?.delivered || 0),
      }),
      { elderly: 0, packages: 0, delivered: 0 }
    );
  }, [projectStats]);

  if (view.name === "project") {
    return (
      <ProjectDetail
        project={view.project}
        allGroups={allGroups}
        allVolunteers={allVolunteers}
        volunteersByGroupId={volunteersByGroupId}
        allElderlyResidents={allElderly}
        onBack={() => { refreshProjectStats(view.project.id); setView({ name: "list" }); }}
        onStatsChange={(stats) => setProjectStatsDirect(view.project.id, stats)}
        onUpdate={async (updated) => {
          const { id, createdAt, updatedAt, ...rest } = updated;
          try {
            await editProject(id, rest);
          } catch (err) {
            console.error("Failed to update project", err);
          }
          setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          setView({ name: "project", project: updated });
        }}
      />
    );
  }

  if (view.name === "groups") {
    return (
      <GroupsListView
        allGroups={allGroups}
        volunteersByGroupId={volunteersByGroupId}
        onBack={() => setView({ name: "list" })}
      />
    );
  }

  // Nearest upcoming project — by real `date` field, falling back to `startDate`.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = [...projects]
    .filter((p) => p.status !== "הסתיים" && p.status !== "בוטל")
    .map((p) => {
      const raw = p.date || p.startDate || "";
      const d = raw ? new Date(raw) : null;
      return { p, d: d && !isNaN(d.getTime()) ? d : null };
    })
    .filter(({ d }) => d && d >= today)
    .sort((a, b) => a.d - b.d)
    .map(({ p }) => p)[0];


  return (
    <AdminPageLayout heroImage="/admin-heroes/projects_hero.png"
      title="פרויקטים"
      subtitle="ניהול פרויקטי חלוקה, אירועים ופעילויות מיוחדות — מעקב חבילות ומסירה לפי שכונות."
      actions={
        <>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ הוספת פרויקט</button>
          <button className="btn" onClick={() => setShowPrint(true)}>הדפסת רשימה</button>
          <button className="btn" onClick={() => setView({ name: "groups" })}>רשימות לפי קבוצות</button>
        </>
      }
    >
      <div className="stats-grid">
        <StatsCard icon="📅" title="פרויקט קרוב" value={upcoming?.name || "—"} subtitle={upcoming?.date || ""} />
        <StatsCard icon="👵" title="אזרחים ותיקים בפרויקט" value={totals.elderly} />
        <StatsCard icon="🎁" title="כמות חבילות" value={totals.packages} />
        <StatsCard icon="📦" title="נמסרו" value={totals.delivered} />
      </div>

      <SectionCard>
        <SearchFilters
          searchPlaceholder="חיפוש לפי שם פרויקט, סוג, שנה או הערה..."
          searchValue={search}
          onSearchChange={(e) => setSearch(e.target.value)}
          filters={[
            { label: "שנה",          value: filters.year,   onChange: (e) => setFilters({ ...filters, year: e.target.value }),   options: ["", "2025", "2026"] },
            { label: "סוג פרויקט",   value: filters.type,   onChange: (e) => setFilters({ ...filters, type: e.target.value }),   options: ["", ...PROJECT_TYPES] },
            { label: "סטטוס",        value: filters.status, onChange: (e) => setFilters({ ...filters, status: e.target.value }), options: ["", ...PROJECT_STATUSES] },
            { label: "טווח תאריכים", value: filters.date,   onChange: (e) => setFilters({ ...filters, date: e.target.value }),   options: ["", "השנה", "החודש", "השבוע"] },
          ]}
        />
        {loading ? (
          <div style={{ textAlign: "center", color: "#666", padding: "24px" }}>טוען פרויקטים...</div>
        ) : loadError ? (
          <div style={{ textAlign: "center", color: "#b00020", padding: "24px" }}>{loadError}</div>
        ) : (
          <DataTable
            columns={[
              { key: "name", label: "שם הפרויקט", render: (r) => (
                <button className="cell-link" onClick={() => setView({ name: "project", project: r })}>{r.name}</button>
              )},
              { key: "type",      label: "סוג פרויקט" },
              { key: "year",      label: "שנה" },
              { key: "date",      label: "תאריך חלוקה" },
              { key: "elderly",   label: "מספר אזרחים ותיקים" },
              { key: "packages",  label: "כמות חבילות" },
              { key: "delivered", label: "נמסרו" },
              { key: "status",    label: "סטטוס", render: (r) => <span className={`badge ${projectStatusBadge(r.status)}`}>{r.status}</span> },
              { key: "delete",    label: "", render: (r) => (
                <button className="btn-link btn-danger" onClick={() => handleDeleteProject(r.id, r.name)}>מחיקת פרויקט</button>
              )},
            ]}
            data={filtered}
          />
        )}
      </SectionCard>

      {showAdd && (
        <AddProjectModal
          allGroups={allGroups}
          volunteersByGroupId={volunteersByGroupId}
          onClose={() => setShowAdd(false)}
          onSave={handleCreateProject}
        />
      )}
      {showPrint && (
        <PrintModal
          title="הדפסת רשימת פרויקטים"
          filters={[
            { label: "שנה", options: ["הכול", "2025", "2026"] },
            { label: "סוג פרויקט", options: ["הכול", ...PROJECT_TYPES] },
            { label: "סטטוס", options: ["הכול", ...PROJECT_STATUSES] },
            { label: "טווח תאריכים", options: ["הכול", "השנה", "החודש", "השבוע"] },
          ]}
          onClose={() => setShowPrint(false)}
        />
      )}
    </AdminPageLayout>
  );
}

/* ============================================================
   Project assignment cell — group OR another individual volunteer.
   Stored on the project participant doc (does NOT change the
   resident's regular volunteer or any global data).
============================================================ */

function ProjectAssignmentCell({ row, projectGroups = [], allVolunteers = [], onChange }) {
  const initialMode = row.assignedVolunteerId
    ? "volunteer"
    : row.assignedGroupId
      ? "group"
      : "none";
  const [mode, setMode] = useState(initialMode);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => { setMode(initialMode); }, [initialMode]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const handleModeChange = (m) => {
    setMode(m);
    if (m === "none") {
      onChange?.({ assignedGroupId: null, assignedVolunteerId: null, assignedVolunteerName: null, assignmentType: null });
    } else if (m === "group") {
      onChange?.({ assignedVolunteerId: null, assignedVolunteerName: null });
    } else if (m === "volunteer") {
      onChange?.({ assignedGroupId: null });
    }
  };

  const filteredVolunteers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allVolunteers.slice(0, 30);
    return allVolunteers.filter((v) => {
      const name = volName(v).toLowerCase();
      const first = (v.firstName || v.first || "").toLowerCase();
      const last = (v.lastName || v.last || "").toLowerCase();
      const phone = volPhone(v).toLowerCase();
      const email = volEmail(v).toLowerCase();
      return name.includes(q) || first.includes(q) || last.includes(q) || phone.includes(q) || email.includes(q);
    }).slice(0, 30);
  }, [allVolunteers, search]);

  const selectedVolunteerLabel = row.assignedVolunteerId
    ? (row.assignedVolunteerName ||
       volName(allVolunteers.find((v) => v.id === row.assignedVolunteerId) || {}) ||
       "מתנדב")
    : "";

  return (
    <div ref={wrapRef} style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 200 }}>
      <select
        className="inline-select"
        value={mode}
        onChange={(e) => handleModeChange(e.target.value)}
      >
        <option value="none">ללא שיבוץ</option>
        <option value="group">קבוצה מתוך הפרויקט</option>
        <option value="volunteer">מתנדב אחר</option>
      </select>

      {mode === "group" && (
        <select
          className="inline-select"
          value={row.assignedGroupId || ""}
          onChange={(e) => {
            const v = e.target.value;
            onChange?.({ assignedGroupId: v || null, assignmentType: v ? "group" : null });
          }}
        >
          <option value="">בחר קבוצה...</option>
          {projectGroups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      )}

      {mode === "volunteer" && (
        <div style={{ position: "relative" }}>
          <input
            className="inline-select"
            type="text"
            placeholder="חיפוש מתנדב..."
            value={open ? search : selectedVolunteerLabel || search}
            onFocus={() => { setOpen(true); setSearch(""); }}
            onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
            style={{ width: "100%" }}
          />
          {open && (
            <div
              style={{
                position: "absolute", top: "100%", insetInlineStart: 0, zIndex: 20,
                background: "#fff", border: "1px solid #ddd", borderRadius: 8,
                width: 280, maxHeight: 220, overflowY: "auto",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)", marginTop: 2,
              }}
            >
              {filteredVolunteers.length === 0 ? (
                <div style={{ padding: 8, color: "#888", fontSize: 13 }}>לא נמצאו מתנדבים</div>
              ) : filteredVolunteers.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    onChange?.({
                      assignedVolunteerId: v.id,
                      assignedVolunteerName: volName(v),
                      assignmentType: "volunteer",
                      assignedGroupId: null,
                    });
                    setOpen(false);
                    setSearch("");
                  }}
                  style={{
                    display: "block", width: "100%", textAlign: "right",
                    padding: "6px 10px", border: "none", background: "transparent",
                    cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  <strong>{volName(v) || "—"}</strong>
                  <span style={{ color: "#666" }}>
                    {volPhone(v) ? ` — ${volPhone(v)}` : ""}
                    {` — ${volStatus(v)}`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Groups list view (entry from main page button)
============================================================ */



function GroupsListView({ onBack, allGroups = [], volunteersByGroupId = {} }) {
  const [group, setGroup] = useState(null);
  const groupRows = allGroups.map((g) => ({
    ...g,
    members: groupMembers(g, volunteersByGroupId[g.id]),
  }));
  const volRows = group
    ? (volunteersByGroupId[group.id] || []).map((v) => ({
        id: v.id,
        name: volName(v),
        phone: volPhone(v),
        email: volEmail(v),
        status: volStatus(v),
        notes: volNotes(v),
      }))
    : [];
  return (
    <AdminPageLayout heroImage="/admin-heroes/projects_hero.png" title="רשימות לפי קבוצות" subtitle="קבוצות מתנדבים במערכת">
      <button className="back-link" onClick={onBack}>→ חזרה לפרויקטים</button>
      {!group ? (
        <SectionCard title="קבוצות מתנדבים">
          <DataTable
            columns={[
              { key: "name",    label: "שם הקבוצה", render: (r) => (
                <button className="cell-link" onClick={() => setGroup(r)}>{r.name}</button>
              )},
              { key: "type",    label: "סוג קבוצה" },
              { key: "members", label: "מספר מתנדבים" },
              { key: "notes",   label: "הערות" },
            ]}
            data={groupRows}
          />
        </SectionCard>
      ) : (
        <>
          <button className="back-link" onClick={() => setGroup(null)}>→ חזרה לרשימת הקבוצות</button>
          <SectionCard title={`מתנדבים בקבוצה: ${group.name}`}>
            <DataTable
              columns={[
                { key: "name",   label: "שם מתנדב" },
                { key: "phone",  label: "טלפון" },
                { key: "email",  label: "מייל" },
                { key: "status", label: "סטטוס", render: (r) => <span className="badge badge-green">{r.status}</span> },
                { key: "notes",  label: "הערות" },
              ]}
              data={volRows}
            />
          </SectionCard>
        </>
      )}
    </AdminPageLayout>
  );
}

/* ============================================================
   Project Detail
============================================================ */

function ProjectDetail({
  project,
  onBack,
  onUpdate,
  onStatsChange,
  allGroups = [],
  allVolunteers = [],
  volunteersByGroupId = {},
  allElderlyResidents = [],
}) {
  const [tab, setTab] = useState("dist");
  const [neighborhood, setNeighborhood] = useState(null);
  const [group, setGroup] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [elderlyByNeighborhood, setElderlyByNeighborhood] = useState({});
  const [elderlyLoading, setElderlyLoading] = useState(true);

  // Real neighborhoods source — same data used by Elderly + Volunteers.
  const { allNeighborhoods } = useAreasAndNeighborhoods();

  // The neighborhoods that belong to THIS project.
  const projectNeighborhoods = useMemo(() => {
    if (project.allElderly) return allNeighborhoods;
    return Array.isArray(project.neighborhoods) ? project.neighborhoods : [];
  }, [project.allElderly, project.neighborhoods, allNeighborhoods]);


  // Load elderly participants for this project from Firestore.
  useEffect(() => {
    let cancelled = false;
    setElderlyLoading(true);
    (async () => {
      try {
        const list = await getElderlyParticipants(project.id);
        if (cancelled) return;
        const grouped = {};
        list.forEach((p) => {
          const key = p.neighborhood || "ללא שכונה";
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(p);
        });
        Object.keys(grouped).forEach((k) => {
          grouped[k] = grouped[k].map((e, i) => ({ ...e, n: i + 1 }));
        });
        setElderlyByNeighborhood(grouped);
      } catch (err) {
        console.error("Failed to load elderly participants", err);
      } finally {
        if (!cancelled) setElderlyLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [project.id]);

  // Per-neighborhood stats derived from participants in the project.
  const neighborhoodRows = useMemo(() => {
    return projectNeighborhoods.map((name) => {
      const rows = elderlyByNeighborhood[name] || [];
      const packages = rows.filter((r) => r.receives === "כן").length;
      const delivered = rows.filter((r) => r.delivery === "נמסר").length;
      const notes = rows.filter((r) => r.notes && r.notes.trim()).length;
      return { name, elderly: rows.length, packages, delivered, notes };
    });
  }, [projectNeighborhoods, elderlyByNeighborhood]);

  // Totals across all neighborhoods for THIS project — drive both the summary
  // cards in the detail view and the row in the main Projects table.
  const projectTotals = useMemo(() => {
    const all = Object.values(elderlyByNeighborhood).flat();
    return {
      elderly: all.length,
      packages: all.filter((r) => r.receives === "כן").length,
      delivered: all.filter((r) => r.delivery === "נמסר").length,
    };
  }, [elderlyByNeighborhood]);

  useEffect(() => {
    if (elderlyLoading) return;
    onStatsChange?.(projectTotals);
  }, [projectTotals, elderlyLoading]); // eslint-disable-line react-hooks/exhaustive-deps



  const [showPrint, setShowPrint] = useState(false);
  const [showAddElderly, setShowAddElderly] = useState(false);
  const [notesEditing, setNotesEditing] = useState(null); // { neighName, elderly }
  const [partnerGroup, setPartnerGroup] = useState(null); // existing group profile modal
  const [elderlyProfile, setElderlyProfile] = useState(null); // elderly profile modal

  // Groups attached to this project + selected volunteers per group
  const [projectGroupIds, setProjectGroupIds] = useState([]);
  const [projectVolunteers, setProjectVolunteers] = useState({});
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showAddVolunteer, setShowAddVolunteer] = useState(false);
  const [showAddVolunteerToGroup, setShowAddVolunteerToGroup] = useState(false);
  const [showAddElderlyToGroup, setShowAddElderlyToGroup] = useState(false);
  const [showPrintGroup, setShowPrintGroup] = useState(false);

  // Load project groups + selected volunteers from Firestore.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getProjectGroups(project.id);
        if (cancelled) return;
        setProjectGroupIds(list.map((g) => g.id));
        const vols = {};
        list.forEach((g) => { vols[g.id] = Array.isArray(g.volunteerIds) ? g.volunteerIds : []; });
        setProjectVolunteers(vols);
      } catch (err) {
        console.error("Failed to load project groups", err);
      }
    })();
    return () => { cancelled = true; };
  }, [project.id]);

  // Flat list of all elderly participants in this project (across all neighborhoods).
  const allParticipants = useMemo(
    () => Object.values(elderlyByNeighborhood).flat(),
    [elderlyByNeighborhood]
  );

  // Map: elderlyId -> regular volunteer name (from main elderly database).
  // This is the resident's daily/routine volunteer — display only inside the project.
  const regularVolunteerByElderlyId = useMemo(() => {
    const map = {};
    allElderlyResidents.forEach((e) => {
      const name = e.volunteerName || "";
      if (name && name.trim()) map[e.id] = name.trim();
    });
    return map;
  }, [allElderlyResidents]);

  // Per-group counts inside this project — derived from project participants
  // with a matching `assignedGroupId`.
  const elderlyCountByProjectGroup = useMemo(() => {
    const map = {};
    allParticipants.forEach((p) => {
      const gid = p.assignedGroupId;
      if (!gid) return;
      if (!map[gid]) map[gid] = { elderly: 0, packages: 0 };
      map[gid].elderly += 1;
      if (p.receives === "כן") map[gid].packages += 1;
    });
    return map;
  }, [allParticipants]);

  const projectGroups = useMemo(
    () => allGroups.filter((g) => projectGroupIds.includes(g.id))
      .map((g) => ({
        ...g,
        members: (projectVolunteers[g.id] || []).length,
        assignedElderly: elderlyCountByProjectGroup[g.id]?.elderly || 0,
        assignedPackages: elderlyCountByProjectGroup[g.id]?.packages || 0,
      })),
    [allGroups, projectGroupIds, projectVolunteers, elderlyCountByProjectGroup]
  );

  const addGroupsToProject = async (ids) => {
    const newIds = ids.filter((id) => !projectGroupIds.includes(id));
    if (newIds.length === 0) return;
    setProjectGroupIds((prev) => Array.from(new Set([...prev, ...newIds])));
    // Pre-fill with the volunteers that already belong to each group.
    setProjectVolunteers((prev) => {
      const next = { ...prev };
      newIds.forEach((id) => {
        if (!next[id]) next[id] = (volunteersByGroupId[id] || []).map((v) => v.id);
      });
      return next;
    });
    try {
      await addProjectGroups(project.id, newIds);
      await Promise.all(
        newIds.map((id) => {
          const vIds = (volunteersByGroupId[id] || []).map((v) => v.id);
          if (vIds.length === 0) return Promise.resolve();
          return setProjectGroupVolunteers(project.id, id, vIds);
        })
      );
    } catch (err) {
      console.error("Failed to add project groups", err);
    }
  };
  const removeGroupFromProject = async (id) => {
    if (!confirm("להסיר את הקבוצה מהפרויקט? (הקבוצה לא תימחק מהמערכת)")) return;
    setProjectGroupIds((prev) => prev.filter((g) => g !== id));
    setProjectVolunteers((prev) => { const n = { ...prev }; delete n[id]; return n; });
    try { await removeProjectGroup(project.id, id); }
    catch (err) { console.error("Failed to remove project group", err); }
  };
  const addVolunteersToGroup = async (gid, vids) => {
    const current = projectVolunteers[gid] || [];
    const next = Array.from(new Set([...current, ...vids]));
    setProjectVolunteers((prev) => ({ ...prev, [gid]: next }));
    try { await setProjectGroupVolunteers(project.id, gid, next); }
    catch (err) { console.error("Failed to update volunteers", err); }
  };
  const removeVolunteerFromGroup = async (gid, vid) => {
    if (!confirm("האם אתה בטוח שברצונך להסיר את המתנדב מהקבוצה?")) return;
    const next = (projectVolunteers[gid] || []).filter((v) => v !== vid);
    setProjectVolunteers((prev) => ({ ...prev, [gid]: next }));
    try { await setProjectGroupVolunteers(project.id, gid, next); }
    catch (err) { console.error("Failed to update volunteers", err); }
  };


  // Partners auto-derived from project groups (deduped by group id).
  const partners = useMemo(() => {
    return projectGroups
      .filter((g) => groupContact(g))
      .map((g) => ({
        id: `grp-${g.id}`,
        groupId: g.id,
        org: g.name,
        contact: groupContact(g),
        phone: groupPhone(g),
        email: groupEmail(g),
        role: groupRole(g),
        source: "קבוצה",
      }));
  }, [projectGroups]);


  const updateElderly = (neighName, id, patch) => {
    // Optimistic UI update.
    setElderlyByNeighborhood((prev) => ({
      ...prev,
      [neighName]: (prev[neighName] || []).map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
    updateElderlyParticipant(project.id, id, patch).catch((err) => {
      console.error("Failed to update elderly participant", err);
    });
  };

  const removeElderly = (neighName, id) => {
    if (!confirm("להסיר את האזרח הוותיק מהפרויקט? (לא יימחק מהמאגר הראשי)")) return;
    setElderlyByNeighborhood((prev) => ({
      ...prev,
      [neighName]: (prev[neighName] || [])
        .filter((e) => e.id !== id)
        .map((e, i) => ({ ...e, n: i + 1 })),
    }));
    removeElderlyParticipant(project.id, id).catch((err) => {
      console.error("Failed to remove elderly participant", err);
    });
  };

  const addElderlyToProject = async (neighName, ids) => {
    const current = elderlyByNeighborhood[neighName] || [];
    const existingIds = new Set(current.map((e) => e.id));
    const newOnes = allElderlyResidents
      .filter((m) => ids.includes(m.id) && !existingIds.has(m.id))
      .map((m) => ({
        elderlyId: m.id,
        neighborhood: neighName,
        first: m.firstName || m.first || "",
        last: m.lastName || m.last || "",
        phone: m.mobile || m.homePhone || m.phone || "",
        address: m.address || "",
        receives: "כן",
        delivery: "ממתין למסירה",
        notes: "",
      }));
    if (newOnes.length === 0) return;
    // Optimistic UI update.
    setElderlyByNeighborhood((prev) => {
      const startN = (prev[neighName] || []).length;
      const display = newOnes.map((p, i) => ({ ...p, id: p.elderlyId, n: startN + i + 1 }));
      return { ...prev, [neighName]: [...(prev[neighName] || []), ...display] };
    });
    try {
      await addElderlyParticipants(project.id, newOnes);
    } catch (err) {
      console.error("Failed to add elderly participants", err);
    }
  };

  /* ---- Add / remove neighborhoods to this project (does not change the
     global areas/neighborhoods database). ---- */
  const [showAddNeighborhood, setShowAddNeighborhood] = useState(false);

  const addNeighborhoodsToProject = async (names) => {
    const current = projectNeighborhoods;
    const adding = names.filter((n) => !current.includes(n));
    if (adding.length === 0) return;
    const newList = [...current, ...adding];

    // Persist on the project doc (and stop treating it as "all elderly").
    onUpdate({ ...project, neighborhoods: newList, allElderly: false });

    // Collect existing elderly residents who belong to those neighborhoods.
    const participants = [];
    adding.forEach((nbh) => {
      allElderlyResidents
        .filter((e) => e.neighborhood === nbh)
        .forEach((e) => {
          participants.push({
            elderlyId: e.id,
            neighborhood: nbh,
            first: e.firstName || e.first || "",
            last: e.lastName || e.last || "",
            phone: e.mobile || e.homePhone || e.phone || "",
            address: e.address || "",
            receives: "כן",
            delivery: "ממתין למסירה",
            notes: "",
          });
        });
    });

    // Optimistic UI update.
    setElderlyByNeighborhood((prev) => {
      const next = { ...prev };
      adding.forEach((nbh) => { if (!next[nbh]) next[nbh] = []; });
      participants.forEach((p) => {
        const list = next[p.neighborhood] || [];
        list.push({ ...p, id: p.elderlyId, n: list.length + 1 });
        next[p.neighborhood] = list;
      });
      return next;
    });

    if (participants.length > 0) {
      try { await addElderlyParticipants(project.id, participants); }
      catch (err) { console.error("Failed to seed elderly participants", err); }
    }
  };

  const removeNeighborhoodFromProject = async (name) => {
    if (!confirm(`להסיר את השכונה "${name}" מהפרויקט?\n\nהאזרחים הוותיקים בשכונה זו יוסרו מהפרויקט בלבד ולא יימחקו מהמערכת.`)) return;
    const baseList = project.allElderly ? allNeighborhoods : projectNeighborhoods;
    const newList = baseList.filter((n) => n !== name);
    onUpdate({ ...project, neighborhoods: newList, allElderly: false });

    const toRemove = elderlyByNeighborhood[name] || [];
    setElderlyByNeighborhood((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    try {
      await Promise.all(toRemove.map((e) => removeElderlyParticipant(project.id, e.id)));
    } catch (err) {
      console.error("Failed to remove neighborhood participants", err);
    }
  };





  return (
    <AdminPageLayout heroImage="/admin-heroes/projects_hero.png"
      title={project.name}
      subtitle={`${project.type} • ${project.year} • תאריך חלוקה: ${project.date}`}
      actions={
        <>
          <button className="btn btn-primary" onClick={() => setShowEdit(true)}>עריכה</button>
        </>
      }
    >
      <button className="back-link" onClick={onBack}>→ חזרה לפרויקטים</button>

      <div className="stats-grid">
        <StatsCard icon="👵" title="אזרחים ותיקים" value={projectTotals.elderly} />
        <StatsCard icon="🎁" title="כמות חבילות"   value={projectTotals.packages} />
        <StatsCard icon="📦" title="נמסרו"          value={projectTotals.delivered} />
        <StatsCard icon="📝" title="הערות מיוחדות" value={project.notes} />
      </div>

      <div className="tabs">
        <button className={tab === "dist" ? "active" : ""}     onClick={() => { setTab("dist");     setNeighborhood(null); }}>ניהול חלוקה</button>
        <button className={tab === "groups" ? "active" : ""}   onClick={() => { setTab("groups");   setGroup(null); }}>רשימות לפי קבוצות</button>
        <button className={tab === "partners" ? "active" : ""} onClick={() => setTab("partners")}>שותפים ואנשי קשר</button>
      </div>

      {tab === "dist" && !neighborhood && (
        <SectionCard
          title="ניהול חלוקה לפי שכונות"
          actions={<button className="btn btn-primary" onClick={() => setShowAddNeighborhood(true)}>+ הוספת שכונה לפרויקט</button>}
        >
          <DataTable
            columns={[
              { key: "name", label: "שכונה", render: (r) => (
                <button className="cell-link" onClick={() => setNeighborhood(r)}>{r.name}</button>
              )},
              { key: "elderly",   label: "אזרחים ותיקים" },
              { key: "packages",  label: "כמות חבילות" },
              { key: "delivered", label: "נמסרו" },
              { key: "notes",     label: "הערות מיוחדות" },
              { key: "remove",    label: "", render: (r) => (
                <button className="btn-link btn-danger" onClick={() => removeNeighborhoodFromProject(r.name)}>הסר שכונה מהפרויקט</button>
              )},
            ]}
            data={neighborhoodRows}
          />
        </SectionCard>
      )}

      {tab === "dist" && neighborhood && (() => {
        const rows = elderlyByNeighborhood[neighborhood.name] || [];
        const neighStats = {
          elderly: rows.length,
          packages: rows.filter((r) => r.receives === "כן").length,
          delivered: rows.filter((r) => r.delivery === "נמסר").length,
        };
        return (
        <>
          <button className="back-link" onClick={() => setNeighborhood(null)}>→ חזרה לרשימת השכונות</button>

          <div className="stats-grid">
            <StatsCard icon="👵" title="אזרחים ותיקים בשכונה" value={neighStats.elderly} />
            <StatsCard icon="🎁" title="כמות חבילות" value={neighStats.packages} />
            <StatsCard icon="📦" title="נמסרו" value={neighStats.delivered} />
          </div>

          <SectionCard
            title={`שכונת ${neighborhood.name} — ${project.name}`}
            actions={
              <>
                <button className="btn btn-primary" onClick={() => setShowAddElderly(true)}>+ הוספת אזרח ותיק לפרויקט</button>
                <button className="btn" onClick={() => setShowPrint(true)}>הדפסת רשימה</button>
              </>
            }
          >
            <DataTable
              columns={[
                { key: "n",       label: "מס׳" },
                { key: "fullName", label: "שם מלא", render: (r) => (
                  <button className="cell-link" onClick={() => setElderlyProfile(r)}>{`${r.first} ${r.last}`}</button>
                )},
                { key: "phone",   label: "טלפון" },
                { key: "address", label: "כתובת" },
                { key: "regularVolunteer", label: "מתנדב קבוע", render: (r) => {
                  const name = regularVolunteerByElderlyId[r.id];
                  return name
                    ? <span>{name}</span>
                    : <span className="muted">אין מתנדב קבוע</span>;
                }},
                { key: "assignedGroupId", label: "שיבוץ בפרויקט", render: (r) => (
                  <ProjectAssignmentCell
                    row={r}
                    projectGroups={projectGroups}
                    allVolunteers={allVolunteers}
                    onChange={(patch) => updateElderly(neighborhood.name, r.id, patch)}
                  />
                )},
                { key: "receives", label: "מקבל חבילה", render: (r) => (
                  <select
                    className="inline-select"
                    value={r.receives}
                    onChange={(e) => {
                      const v = e.target.value;
                      // When the resident does NOT receive a package, force
                      // delivery status to "לא נמסר" so totals stay accurate
                      // and the delivery select is locked below.
                      const patch = v === "לא"
                        ? { receives: v, delivery: "לא נמסר" }
                        : { receives: v };
                      updateElderly(neighborhood.name, r.id, patch);
                    }}
                  >
                    <option value="כן">כן</option>
                    <option value="לא">לא</option>
                  </select>
                )},
                { key: "delivery", label: "סטטוס מסירה", render: (r) => {
                  const locked = r.receives === "לא";
                  return (
                    <select
                      className="inline-select"
                      value={r.delivery}
                      disabled={locked}
                      title={locked ? "לא ניתן לעדכן מסירה כאשר אינו מקבל חבילה" : ""}
                      onChange={(e) => updateElderly(neighborhood.name, r.id, { delivery: e.target.value })}
                    >
                      <option value="נמסר">נמסר</option>
                      <option value="ממתין למסירה">ממתין למסירה</option>
                      <option value="לא נמסר">לא נמסר</option>
                    </select>
                  );
                }},
                { key: "notes", label: "הערות", render: (r) => {
                  const has = !!(r.notes && r.notes.trim());
                  return (
                    <button
                      className="note-icon-btn"
                      title={has ? "צפייה / עריכת הערה" : "הוספת הערה"}
                      aria-label="הערות"
                      onClick={() => setNotesEditing({ neighName: neighborhood.name, elderly: r })}
                    >
                      <span className={`note-icon ${has ? "has-note" : ""}`} aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                          <line x1="8" y1="13" x2="16" y2="13"/>
                          <line x1="8" y1="17" x2="13" y2="17"/>
                        </svg>
                        {has && <span className="note-dot" />}
                      </span>
                    </button>
                  );
                }},
                { key: "remove",  label: "", render: (r) => (
                  <button className="btn-link btn-danger" onClick={() => removeElderly(neighborhood.name, r.id)}>הסר מהפרויקט</button>
                )},
              ]}
              data={elderlyByNeighborhood[neighborhood.name] || []}
            />
          </SectionCard>
          {showPrint && (
            <PrintModal
              title={`הדפסת רשימת אזרחים ותיקים — ${neighborhood.name}`}
              filters={[
                { label: "מקבל חבילה", options: ["הכול", "כן", "לא"] },
                { label: "סטטוס מסירה", options: ["הכול", "נמסר", "ממתין למסירה", "לא נמסר"] },
              ]}
              onClose={() => setShowPrint(false)}
            />
          )}
          {showAddElderly && (
            <SelectElderlyModal
              neighborhood={neighborhood.name}
              allElderly={allElderlyResidents}
              excludeIds={(elderlyByNeighborhood[neighborhood.name] || []).map((e) => e.id)}
              onClose={() => setShowAddElderly(false)}
              onAdd={(ids) => { addElderlyToProject(neighborhood.name, ids); setShowAddElderly(false); }}
            />
          )}
          {notesEditing && notesEditing.neighName === neighborhood.name && (
            <ElderlyNotesModal
              elderly={notesEditing.elderly}
              onClose={() => setNotesEditing(null)}
              onSave={(text) => {
                updateElderly(neighborhood.name, notesEditing.elderly.id, { notes: text });
                setNotesEditing(null);
              }}
              onDelete={() => {
                updateElderly(neighborhood.name, notesEditing.elderly.id, { notes: "" });
                setNotesEditing(null);
              }}
            />
          )}
        </>
        );
      })()}

      {tab === "groups" && !group && (
        <SectionCard
          title="קבוצות חלוקה בפרויקט"
          actions={<button className="btn btn-primary" onClick={() => setShowAddGroup(true)}>+ הוספת קבוצה לפרויקט</button>}
        >
          <DataTable
            columns={[
              { key: "name", label: "שם הקבוצה", render: (r) => (
                <button className="cell-link" onClick={() => setGroup(r)}>{r.name}</button>
              )},
              { key: "assignedElderly", label: "מספר אזרחים ותיקים" },
              { key: "assignedPackages", label: "כמות חבילות" },
              { key: "contact", label: "איש קשר", render: (r) => groupContact(r) || "—" },
              { key: "view", label: "", render: (r) => (
                <button className="btn-link" onClick={() => setGroup(r)}>צפייה ברשימה</button>
              )},
              { key: "remove",  label: "", render: (r) => (
                <button className="btn-link btn-danger" onClick={() => removeGroupFromProject(r.id)}>הסר מהפרויקט</button>
              )},
            ]}
            data={projectGroups}
          />
        </SectionCard>
      )}

      {tab === "groups" && group && (() => {
        const rows = allParticipants
          .filter((p) => p.assignedGroupId === group.id)
          .map((p, i) => ({ ...p, n: i + 1 }));
        const inGroupIds = rows.map((r) => r.id);
        return (
          <>
            <button className="back-link" onClick={() => setGroup(null)}>→ חזרה לרשימת הקבוצות</button>
            <div className="stats-grid">
              <StatsCard icon="👥" title="מתנדבים בקבוצה" value={(projectVolunteers[group.id] || []).length} />
              <StatsCard icon="👵" title="אזרחים ותיקים בקבוצה" value={rows.length} />
              <StatsCard icon="🎁" title="כמות חבילות" value={rows.filter((r) => r.receives === "כן").length} />
              <StatsCard icon="📦" title="נמסרו" value={rows.filter((r) => r.delivery === "נמסר").length} />
            </div>
            <SectionCard
              title={`מתנדבים בקבוצה — ${group.name}`}
              actions={
                <button className="btn btn-primary" onClick={() => setShowAddVolunteerToGroup(true)}>
                  + הוספת מתנדבים לקבוצה
                </button>
              }
            >
              <DataTable
                columns={[
                  { key: "name",   label: "שם מלא" },
                  { key: "phone",  label: "טלפון" },
                  { key: "email",  label: "אימייל" },
                  { key: "status", label: "סטטוס", render: (r) => <span className={`badge ${r.status === "פעיל" ? "badge-green" : "badge-gray"}`}>{r.status || "—"}</span> },
                  { key: "notes",  label: "הערות" },
                  { key: "actions", label: "פעולות", render: (r) => (
                    <button
                      className="btn-link btn-danger"
                      onClick={() => removeVolunteerFromGroup(group.id, r.id)}
                    >
                      הסר מהקבוצה
                    </button>
                  )},
                ]}
                data={(projectVolunteers[group.id] || [])
                  .map((vid) => allVolunteers.find((v) => v.id === vid))
                  .filter(Boolean)
                  .map((v) => ({
                    id: v.id,
                    name: volName(v),
                    phone: volPhone(v),
                    email: volEmail(v),
                    status: volStatus(v),
                    notes: volNotes(v),
                  }))}
              />
            </SectionCard>
            <SectionCard
              title={`רשימת אזרחים ותיקים — ${group.name}`}
              actions={
                <>
                  <button className="btn btn-primary" onClick={() => setShowAddElderlyToGroup(true)}>+ הוספת אזרחים ותיקים לקבוצה</button>
                  <button className="btn" onClick={() => setShowPrintGroup(true)}>הדפסת רשימה</button>
                </>
              }
            >
              <DataTable
                columns={[
                  { key: "n", label: "מס׳" },
                  { key: "fullName", label: "שם מלא", render: (r) => (
                    <button className="cell-link" onClick={() => setElderlyProfile(r)}>{`${r.first} ${r.last}`}</button>
                  )},
                  { key: "phone",        label: "טלפון" },
                  { key: "address",      label: "כתובת" },
                  { key: "neighborhood", label: "שכונה" },
                  { key: "notes", label: "הערות מיוחדות", render: (r) => (
                    <button
                      className="note-icon-btn"
                      title={r.notes ? "צפייה / עריכת הערה" : "הוספת הערה"}
                      aria-label="הערות"
                      onClick={() => setNotesEditing({ neighName: r.neighborhood, elderly: r })}
                    >
                      <span className={`note-icon ${r.notes ? "has-note" : ""}`} aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                          <line x1="8" y1="13" x2="16" y2="13"/>
                          <line x1="8" y1="17" x2="13" y2="17"/>
                        </svg>
                        {r.notes && <span className="note-dot" />}
                      </span>
                    </button>
                  )},
                  { key: "remove", label: "", render: (r) => (
                    <button
                      className="btn-link btn-danger"
                      onClick={() => {
                        if (!confirm("להסיר את האזרח הוותיק מהקבוצה? (לא יימחק מהפרויקט ולא מהמערכת)")) return;
                        updateElderly(r.neighborhood, r.id, { assignedGroupId: null });
                      }}
                    >
                      הסר מהקבוצה
                    </button>
                  )},
                ]}
                data={rows}
              />
            </SectionCard>
            {showAddVolunteerToGroup && (
              <SelectVolunteersForGroupModal
                group={group}
                allVolunteers={allVolunteers}
                allGroups={allGroups}
                excludeIds={projectVolunteers[group.id] || []}
                onClose={() => setShowAddVolunteerToGroup(false)}
                onAdd={async (ids) => {
                  try {
                    await addVolunteersToGroup(group.id, ids);
                    setShowAddVolunteerToGroup(false);
                  } catch (err) {
                    console.error("Failed to add volunteers to group", err);
                    alert("הוספת המתנדבים לקבוצה נכשלה");
                  }
                }}
              />
            )}
            {showAddElderlyToGroup && (
              <SelectElderlyForGroupModal
                group={group}
                allElderly={allElderlyResidents}
                projectParticipants={allParticipants}
                excludeIds={inGroupIds}
                onClose={() => setShowAddElderlyToGroup(false)}
                onAdd={async (ids) => {
                  // Split: those already in project just get their assignedGroupId updated;
                  // those not yet in project are added as participants in this group.
                  const inProjectIds = new Set(allParticipants.map((p) => p.id));
                  const toUpdate = ids.filter((id) => inProjectIds.has(id));
                  const toAdd = ids.filter((id) => !inProjectIds.has(id));

                  // 1) Update existing participants — keep their neighborhood unchanged.
                  toUpdate.forEach((id) => {
                    const part = allParticipants.find((p) => p.id === id);
                    if (!part) return;
                    updateElderly(part.neighborhood, id, { assignedGroupId: group.id });
                  });

                  // 2) Add new participants for residents who aren't in this project yet.
                  if (toAdd.length > 0) {
                    const newOnes = allElderlyResidents
                      .filter((m) => toAdd.includes(m.id))
                      .map((m) => ({
                        elderlyId: m.id,
                        neighborhood: m.neighborhood || "ללא שכונה",
                        first: m.firstName || m.first || "",
                        last: m.lastName || m.last || "",
                        phone: m.mobile || m.homePhone || m.phone || "",
                        address: m.address || "",
                        receives: "כן",
                        delivery: "ממתין למסירה",
                        notes: "",
                        assignedGroupId: group.id,
                      }));
                    setElderlyByNeighborhood((prev) => {
                      const next = { ...prev };
                      newOnes.forEach((p) => {
                        const list = next[p.neighborhood] || [];
                        list.push({ ...p, id: p.elderlyId, n: list.length + 1 });
                        next[p.neighborhood] = list;
                      });
                      return next;
                    });
                    try { await addElderlyParticipants(project.id, newOnes); }
                    catch (err) { console.error("Failed to add elderly to group", err); }
                  }
                  setShowAddElderlyToGroup(false);
                }}
              />
            )}
            {showPrintGroup && (
              <PrintModal
                title={`הדפסת רשימה — ${group.name}`}
                filters={[
                  { label: "מקבל חבילה",  options: ["הכול", "כן", "לא"] },
                  { label: "סטטוס מסירה", options: ["הכול", "נמסר", "ממתין למסירה", "לא נמסר"] },
                ]}
                onClose={() => setShowPrintGroup(false)}
              />
            )}
            {notesEditing && notesEditing.elderly && inGroupIds.includes(notesEditing.elderly.id) && (
              <ElderlyNotesModal
                elderly={notesEditing.elderly}
                onClose={() => setNotesEditing(null)}
                onSave={(text) => {
                  updateElderly(notesEditing.neighName, notesEditing.elderly.id, { notes: text });
                  setNotesEditing(null);
                }}
                onDelete={() => {
                  updateElderly(notesEditing.neighName, notesEditing.elderly.id, { notes: "" });
                  setNotesEditing(null);
                }}
              />
            )}
          </>
        );
      })()}


      {tab === "partners" && (
        <SectionCard title="שותפים ואנשי קשר">
          <DataTable
            columns={[
              { key: "org", label: "שם הגוף / השותף", render: (r) => (
                r.groupId
                  ? <button className="cell-link" onClick={() => setPartnerGroup(allGroups.find((g) => g.id === r.groupId))}>{r.org}</button>
                  : <span>{r.org}</span>
              )},
              { key: "contact", label: "איש קשר" },
              { key: "phone",   label: "טלפון" },
              { key: "email",   label: "מייל" },
              { key: "role",    label: "תפקיד / הערות" },
              { key: "source",  label: "מקור", render: (r) => <span className={`badge ${r.source === "קבוצה" ? "badge-green" : "badge-gray"}`}>{r.source}</span> },
            ]}
            data={partners}
          />
        </SectionCard>
      )}

      {partnerGroup && (
        <GroupProfileModal
          group={partnerGroup}
          volunteers={volunteersByGroupId[partnerGroup.id] || []}
          onClose={() => setPartnerGroup(null)}
        />
      )}

      {elderlyProfile && (
        <ElderlyProfileModal elderly={elderlyProfile} onClose={() => setElderlyProfile(null)} />
      )}

      {showAddGroup && (
        <SelectGroupsModal
          allGroups={allGroups}
          volunteersByGroupId={volunteersByGroupId}
          excludeIds={projectGroupIds}
          onClose={() => setShowAddGroup(false)}
          onAdd={(ids) => { addGroupsToProject(ids); setShowAddGroup(false); }}
        />
      )}

      {showAddNeighborhood && (
        <SelectNeighborhoodsModal
          allNeighborhoods={allNeighborhoods}
          excludeNames={projectNeighborhoods}
          allElderlyResidents={allElderlyResidents}
          onClose={() => setShowAddNeighborhood(false)}
          onAdd={(names) => { addNeighborhoodsToProject(names); setShowAddNeighborhood(false); }}
        />
      )}

      {showEdit && (
        <EditProjectModal
          project={project}
          onClose={() => setShowEdit(false)}
          onSave={(updated) => { onUpdate(updated); setShowEdit(false); }}
        />
      )}
    </AdminPageLayout>
  );
}

/* ============================================================
   Modals
============================================================ */

function EditProjectModal({ project, onClose, onSave }) {
  const [form, setForm] = useState({
    name: project.name,
    type: project.type,
    year: project.year,
    date: project.date,
    status: project.status,
    notesText: project.notesText || "",
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>עריכת פרויקט</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-section">
          <h4>פרטי פרויקט</h4>
          <div className="field"><label>שם הפרויקט</label>
            <input className="input" value={form.name} onChange={set("name")} />
          </div>
          <div className="row row-2">
            <div className="field"><label>סוג פרויקט</label>
              <select className="select" value={form.type} onChange={set("type")}>
                {PROJECT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="field"><label>שנה</label>
              <input className="input" type="number" value={form.year} onChange={set("year")} />
            </div>
            <div className="field"><label>תאריך חלוקה</label>
              <input className="input" value={form.date} onChange={set("date")} />
            </div>
            <div className="field"><label>סטטוס</label>
              <select className="select" value={form.status} onChange={set("status")}>
                {PROJECT_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label>הערות</label>
            <textarea className="textarea" rows={3} value={form.notesText} onChange={set("notesText")} />
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={() => onSave({ ...project, ...form, year: Number(form.year) })}>שמירה</button>
          <button className="btn" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

function PrintModal({ title, filters = [], onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-section">
          <h4>סינון להדפסה</h4>
          <div className="row row-2">
            {filters.map((f, i) => (
              <div className="field" key={i}>
                <label>{f.label}</label>
                <select className="select" defaultValue={f.options[0]}>
                  {f.options.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={() => window.print()}>תצוגה מקדימה</button>
          <button className="btn btn-primary" onClick={() => { window.print(); onClose(); }}>הדפסה</button>
          <button className="btn" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

function AddProjectModal({ onClose, onSave, allGroups = [], volunteersByGroupId = {} }) {
  const { allNeighborhoods, loading: areasLoading, isEmpty: areasEmpty } = useAreasAndNeighborhoods();
  const [name, setName] = useState("");
  const [type, setType] = useState(PROJECT_TYPES[0]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [startDate, setStartDate] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState(PROJECT_STATUSES[0]);
  const [notesText, setNotesText] = useState("");
  const [allElderly, setAllElderly] = useState(false);
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState([]);
  const [neighOpen, setNeighOpen] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const neighRef = useRef(null);
  const groupsRef = useRef(null);

  useEffect(() => {
    if (!neighOpen && !groupsOpen) return;
    const onDown = (e) => {
      if (neighOpen && neighRef.current && !neighRef.current.contains(e.target)) {
        setNeighOpen(false);
      }
      if (groupsOpen && groupsRef.current && !groupsRef.current.contains(e.target)) {
        setGroupsOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [neighOpen, groupsOpen]);


  const toggleNeigh = (name) =>
    setSelectedNeighborhoods((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  const toggleGroup = (id) =>
    setSelectedGroups((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );

  const onToggleAllElderly = (checked) => {
    setAllElderly(checked);
    if (checked) setSelectedNeighborhoods([...allNeighborhoods]);
  };

  const neighLabel =
    selectedNeighborhoods.length === 0
      ? "בחר שכונות..."
      : selectedNeighborhoods.length === allNeighborhoods.length
        ? "כל השכונות"
        : `${selectedNeighborhoods.length} שכונות נבחרו`;

  const filteredGroups = allGroups.filter((g) =>
    (g.name || "").toLowerCase().includes(groupSearch.toLowerCase())
  );
  const selectedGroupObjs = allGroups.filter((g) => selectedGroups.includes(g.id));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>הוספת פרויקט</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-section">
          <h4>פרטי פרויקט</h4>
          <div className="field"><label>שם הפרויקט</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="row row-2">
            <div className="field">
              <label>סוג פרויקט</label>
              <select className="select" value={type} onChange={(e) => setType(e.target.value)}>{PROJECT_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            </div>
            <div className="field"><label>שנה</label><input className="input" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /></div>
            <div className="field"><label>תאריך התחלה</label><input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div className="field"><label>תאריך חלוקה</label><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="field">
              <label>סטטוס</label>
              <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>{PROJECT_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h4>אוכלוסיית יעד</h4>
          <div className="field">
            <label>סינון לפי שכונה</label>
            <div className="multi-select" ref={neighRef}>
              <button
                type="button"
                className="multi-select-trigger"
                onClick={() => !allElderly && setNeighOpen((o) => !o)}
                disabled={allElderly}
              >
                <span>{neighLabel}</span>
                <span className="multi-select-caret">▾</span>
              </button>
              {neighOpen && !allElderly && (
                <div className="multi-select-menu">
                  {allNeighborhoods.map((name) => (
                    <label key={name} className="multi-select-option">
                      <input
                        type="checkbox"
                        checked={selectedNeighborhoods.includes(name)}
                        onChange={() => toggleNeigh(name)}
                      />
                      <span>{name}</span>
                    </label>
                  ))}
                </div>
              )}
              {selectedNeighborhoods.length > 0 && selectedNeighborhoods.length < allNeighborhoods.length && (
                <div className="chip-row">
                  {selectedNeighborhoods.map((n) => (
                    <span key={n} className="chip">
                      {n}
                      <button type="button" className="chip-x" onClick={() => toggleNeigh(n)}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="field">
            <label>
              <input
                type="checkbox"
                checked={allElderly}
                onChange={(e) => onToggleAllElderly(e.target.checked)}
              />{" "}
              בחירת כל האזרחים הוותיקים מהמערכת
            </label>
          </div>
        </div>

        <div className="form-section">
          <h4>קבוצות משתתפות</h4>
          <div className="field">
            <label>קבוצות מתנדבים</label>
            <div className="multi-select" ref={groupsRef}>
              <button
                type="button"
                className="multi-select-trigger"
                onClick={() => setGroupsOpen((o) => !o)}
              >
                <span>
                  {selectedGroups.length === 0
                    ? "בחר קבוצות מתנדבים..."
                    : `${selectedGroups.length} קבוצות נבחרו`}
                </span>
                <span className="multi-select-caret">▾</span>
              </button>
              {groupsOpen && (
                <div className="multi-select-menu">
                  <div className="multi-select-search">
                    <input
                      className="input"
                      placeholder="חיפוש קבוצה..."
                      value={groupSearch}
                      onChange={(e) => setGroupSearch(e.target.value)}
                    />
                  </div>
                  {filteredGroups.length === 0 ? (
                    <div className="multi-select-empty">לא נמצאו קבוצות</div>
                  ) : (
                    filteredGroups.map((g) => (
                      <label key={g.id} className="multi-select-option">
                        <input
                          type="checkbox"
                          checked={selectedGroups.includes(g.id)}
                          onChange={() => toggleGroup(g.id)}
                        />
                        <span className="ms-name">{g.name}</span>
                        <span className="ms-sub">{g.type} • {groupMembers(g, volunteersByGroupId[g.id])} מתנדבים</span>
                      </label>
                    ))
                  )}
                </div>
              )}
              {selectedGroupObjs.length > 0 && (
                <div className="chip-row">
                  {selectedGroupObjs.map((g) => (
                    <span key={g.id} className="chip">
                      {g.name}
                      <button type="button" className="chip-x" onClick={() => toggleGroup(g.id)}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="form-section">
          <h4>הערות</h4>
          <div className="field">
            <textarea className="textarea" rows={5} placeholder="הערות כלליות לפרויקט..." value={notesText} onChange={(e) => setNotesText(e.target.value)} />
          </div>
        </div>

        {saveError && <div style={{ color: "#b00020", padding: "8px 16px" }}>{saveError}</div>}

        <div className="modal-actions">
          <button
            className="btn btn-primary"
            disabled={saving || !name.trim()}
            onClick={async () => {
              setSaveError("");
              if (!name.trim()) { setSaveError("שם הפרויקט הוא שדה חובה"); return; }
              const sErr = validateDate(startDate, { required: false });
              if (sErr) { setSaveError(`תאריך התחלה: ${sErr}`); return; }
              const dErr = validateDate(date, { required: false });
              if (dErr) { setSaveError(`תאריך חלוקה: ${dErr}`); return; }
              setSaving(true);
              try {
                await onSave({
                  name: name.trim(),
                  type,
                  year,
                  startDate: startDate || "",
                  date: date || "",
                  status,
                  notesText,
                  allElderly,
                  neighborhoods: allElderly ? allNeighborhoods : selectedNeighborhoods,
                  groupIds: selectedGroups,
                  elderly: 0,
                  packages: 0,
                  assigned: 0,
                  delivered: 0,
                  notes: 0,
                });
                onClose();
              } catch (err) {
                console.error("Failed to save project", err);
                setSaveError("שמירת הפרויקט נכשלה");
                setSaving(false);
              }
            }}
          >
            {saving ? "שומר..." : "שמירה"}
          </button>
          <button className="btn" onClick={onClose} disabled={saving}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Selection modals (existing groups / existing volunteers)
============================================================ */

function SelectGroupsModal({ excludeIds = [], onClose, onAdd, allGroups = [], volunteersByGroupId = {} }) {
  const available = allGroups.filter((g) => !excludeIds.includes(g.id));
  const [selected, setSelected] = useState([]);
  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>בחירת קבוצות קיימות להוספה לפרויקט</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-section">
          {available.length === 0 ? (
            <div style={{ textAlign: "center", color: "#666", padding: "16px" }}>
              כל הקבוצות הקיימות כבר נוספו לפרויקט
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>שם הקבוצה</th>
                    <th>סוג קבוצה</th>
                    <th>מספר מתנדבים</th>
                    <th>איש קשר</th>
                    <th>הערות</th>
                  </tr>
                </thead>
                <tbody>
                  {available.map((g) => (
                    <tr key={g.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.includes(g.id)}
                          onChange={() => toggle(g.id)}
                        />
                      </td>
                      <td>{g.name}</td>
                      <td>{g.type}</td>
                      <td>{groupMembers(g, volunteersByGroupId[g.id])}</td>
                      <td>{g.contact}</td>
                      <td>{g.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button
            className="btn btn-primary"
            disabled={selected.length === 0}
            onClick={() => onAdd(selected)}
          >
            הוספה לפרויקט
          </button>
          <button className="btn" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

function SelectVolunteersModal({ group, groupVolunteers = [], excludeIds = [], onClose, onAdd }) {
  const available = groupVolunteers.filter((v) => !excludeIds.includes(v.id));
  const [selected, setSelected] = useState([]);
  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>בחירת מתנדבים מתוך הקבוצה לפרויקט</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-section">
          <div style={{ marginBottom: 8, color: "#666" }}>קבוצה: {group.name}</div>
          {available.length === 0 ? (
            <div style={{ textAlign: "center", color: "#666", padding: "16px" }}>
              כל המתנדבים בקבוצה זו כבר משתתפים בפרויקט
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>שם מתנדב</th>
                    <th>טלפון</th>
                    <th>מייל</th>
                    <th>סטטוס</th>
                    <th>הערות</th>
                  </tr>
                </thead>
                <tbody>
                  {available.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.includes(v.id)}
                          onChange={() => toggle(v.id)}
                        />
                      </td>
                      <td>{volName(v)}</td>
                      <td>{volPhone(v)}</td>
                      <td>{volEmail(v)}</td>
                      <td><span className="badge badge-green">{volStatus(v)}</span></td>
                      <td>{volNotes(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>


        <div className="modal-actions">
          <button
            className="btn btn-primary"
            disabled={selected.length === 0}
            onClick={() => onAdd(selected)}
          >
            הוספה לפרויקט
          </button>
          <button className="btn" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Select existing elderly residents from the system
   (filtered by neighborhood, excluding ones already in project)
============================================================ */

function SelectElderlyModal({ neighborhood, allElderly = [], excludeIds = [], onClose, onAdd }) {
  const available = allElderly.filter(
    (e) => e.neighborhood === neighborhood && !excludeIds.includes(e.id)
  );
  const [selected, setSelected] = useState([]);
  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const displayName = (e) =>
    `${e.firstName || e.first || ""} ${e.lastName || e.last || ""}`.trim();
  const displayPhone = (e) => e.mobile || e.homePhone || e.phone || "";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>בחירת אזרחים ותיקים קיימים להוספה לפרויקט</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-section">
          <div style={{ marginBottom: 8, color: "#666" }}>שכונה: {neighborhood}</div>
          {available.length === 0 ? (
            <div style={{ textAlign: "center", color: "#666", padding: "16px" }}>
              אין אזרחים ותיקים זמינים בשכונה זו להוספה לפרויקט
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>שם מלא</th>
                    <th>טלפון</th>
                    <th>כתובת</th>
                    <th>שכונה</th>
                    <th>סטטוס</th>
                    <th>הערות</th>
                  </tr>
                </thead>
                <tbody>
                  {available.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.includes(e.id)}
                          onChange={() => toggle(e.id)}
                        />
                      </td>
                      <td>{displayName(e)}</td>
                      <td>{displayPhone(e)}</td>
                      <td>{e.address || ""}</td>
                      <td>{neighborhood}</td>
                      <td><span className="badge badge-green">{e.status || "פעיל"}</span></td>
                      <td>{e.notes || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button
            className="btn btn-primary"
            disabled={selected.length === 0}
            onClick={() => onAdd(selected)}
          >
            הוספה לפרויקט
          </button>
          <button className="btn" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Elderly notes (project-scoped) — view / add / edit / delete
============================================================ */

function ElderlyNotesModal({ elderly, onClose, onSave, onDelete }) {
  const [text, setText] = useState(elderly.notes || "");
  const hasExisting = !!(elderly.notes && elderly.notes.trim());
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>הערות מיוחדות לאזרח ותיק בפרויקט</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-section">
          <div style={{ marginBottom: 8, color: "#666" }}>
            {elderly.first} {elderly.last}
          </div>
          <div className="field">
            <label>הערה</label>
            <textarea
              className="textarea"
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="הוספת הערה..."
            />
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={() => onSave(text)}>שמירה</button>
          {hasExisting && (
            <button className="btn btn-danger" onClick={onDelete}>מחיקת הערה</button>
          )}
          <button className="btn" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   View existing volunteer group profile (read-only)
============================================================ */

function GroupProfileModal({ group, volunteers = [], onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>פרופיל קבוצה: {group.name}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-section">
          <h4>פרטי קבוצה</h4>
          <div className="detail-grid">
            <div className="item"><label>שם הקבוצה</label><div>{group.name}</div></div>
            <div className="item"><label>סוג קבוצה</label><div>{group.type}</div></div>
            <div className="item"><label>איש קשר</label><div>{groupContact(group) || "—"}</div></div>
            <div className="item"><label>טלפון</label><div>{groupPhone(group) || "—"}</div></div>
            <div className="item"><label>מייל</label><div>{groupEmail(group) || "—"}</div></div>
            <div className="item"><label>תפקיד</label><div>{groupRole(group) || "—"}</div></div>
            <div className="item"><label>מספר מתנדבים</label><div>{volunteers.length}</div></div>
            <div className="item"><label>הערות</label><div>{group.notes || "—"}</div></div>
          </div>
        </div>

        <div className="form-section">
          <h4>מתנדבים בקבוצה</h4>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>שם מתנדב</th>
                  <th>טלפון</th>
                  <th>מייל</th>
                  <th>סטטוס</th>
                  <th>הערות</th>
                </tr>
              </thead>
              <tbody>
                {volunteers.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "#666" }}>אין מתנדבים בקבוצה</td></tr>
                ) : volunteers.map((v) => (
                  <tr key={v.id}>
                    <td>{volName(v)}</td>
                    <td>{volPhone(v)}</td>
                    <td>{volEmail(v)}</td>
                    <td><span className="badge badge-green">{volStatus(v)}</span></td>
                    <td>{volNotes(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>סגירה</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Elderly profile (read-only modal — opens existing record)
============================================================ */

function ElderlyProfileModal({ elderly, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>כרטיס אזרח ותיק: {elderly.first} {elderly.last}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-section">
          <h4>פרטים אישיים</h4>
          <div className="detail-grid">
            <div className="item"><label>שם מלא</label><div>{elderly.first} {elderly.last}</div></div>
            <div className="item"><label>טלפון</label><div>{elderly.phone || "—"}</div></div>
            <div className="item"><label>כתובת</label><div>{elderly.address || "—"}</div></div>
            <div className="item"><label>מקבל חבילה</label><div>{elderly.receives || "—"}</div></div>
            <div className="item"><label>סטטוס מסירה</label><div>{elderly.delivery || "—"}</div></div>
          </div>
        </div>

        <div className="form-section">
          <h4>הערות לפרויקט</h4>
          <div style={{ color: "var(--color-text)", whiteSpace: "pre-wrap" }}>
            {elderly.notes && elderly.notes.trim() ? elderly.notes : "אין הערות"}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>סגירה</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Select existing neighborhoods from the database to attach
   to this project (does NOT create new neighborhoods).
============================================================ */

function SelectNeighborhoodsModal({
  allNeighborhoods = [],
  excludeNames = [],
  allElderlyResidents = [],
  onClose,
  onAdd,
}) {
  const available = allNeighborhoods.filter((n) => !excludeNames.includes(n));
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");
  const toggle = (name) =>
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );

  const countByNeighborhood = useMemo(() => {
    const map = {};
    allElderlyResidents.forEach((e) => {
      if (!e.neighborhood) return;
      map[e.neighborhood] = (map[e.neighborhood] || 0) + 1;
    });
    return map;
  }, [allElderlyResidents]);

  const filtered = available.filter((n) =>
    n.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>בחירת שכונות קיימות להוספה לפרויקט</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-section">
          <div className="field">
            <input
              className="input"
              placeholder="חיפוש שכונה..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {available.length === 0 ? (
            <div style={{ textAlign: "center", color: "#666", padding: "16px" }}>
              כל השכונות הקיימות כבר נוספו לפרויקט
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", color: "#666", padding: "16px" }}>
              לא נמצאו שכונות
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>שכונה</th>
                    <th>אזרחים ותיקים במאגר</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((n) => (
                    <tr key={n}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.includes(n)}
                          onChange={() => toggle(n)}
                        />
                      </td>
                      <td>{n}</td>
                      <td>{countByNeighborhood[n] || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button
            className="btn btn-primary"
            disabled={selected.length === 0}
            onClick={() => onAdd(selected)}
          >
            הוספה לפרויקט
          </button>
          <button className="btn" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Select existing elderly residents to add to a project group.
   - Shows all elderly residents in the system, excluding ones
     already assigned to this group.
   - Indicates which residents are already in the project (their
     assignedGroupId will be updated) vs. residents that are not
     yet in the project (they'll be added with assignedGroupId set).
============================================================ */

function SelectElderlyForGroupModal({
  group,
  allElderly = [],
  projectParticipants = [],
  excludeIds = [],
  onClose,
  onAdd,
}) {
  const inProjectIds = new Set(projectParticipants.map((p) => p.id));
  const groupAssignmentByElderlyId = {};
  projectParticipants.forEach((p) => {
    if (p.assignedGroupId) groupAssignmentByElderlyId[p.id] = p.assignedGroupId;
  });

  const available = allElderly.filter((e) => !excludeIds.includes(e.id));
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");
  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const displayName = (e) =>
    `${e.firstName || e.first || ""} ${e.lastName || e.last || ""}`.trim();
  const displayPhone = (e) => e.mobile || e.homePhone || e.phone || "";

  const filtered = available.filter((e) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      displayName(e).toLowerCase().includes(s) ||
      (e.neighborhood || "").toLowerCase().includes(s) ||
      (e.address || "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>הוספת אזרחים ותיקים לקבוצה: {group.name}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-section">
          <div className="field">
            <input
              className="input"
              placeholder="חיפוש לפי שם, שכונה או כתובת..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", color: "#666", padding: "16px" }}>
              אין אזרחים ותיקים זמינים להוספה לקבוצה זו
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>שם מלא</th>
                    <th>טלפון</th>
                    <th>שכונה</th>
                    <th>כתובת</th>
                    <th>סטטוס בפרויקט</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => {
                    const inProject = inProjectIds.has(e.id);
                    const otherGroupId = groupAssignmentByElderlyId[e.id];
                    const inOtherGroup = otherGroupId && otherGroupId !== group.id;
                    return (
                      <tr key={e.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.includes(e.id)}
                            onChange={() => toggle(e.id)}
                          />
                        </td>
                        <td>{displayName(e)}</td>
                        <td>{displayPhone(e)}</td>
                        <td>{e.neighborhood || "—"}</td>
                        <td>{e.address || "—"}</td>
                        <td>
                          {inOtherGroup ? (
                            <span className="badge badge-orange">משובץ בקבוצה אחרת</span>
                          ) : inProject ? (
                            <span className="badge badge-gray">בפרויקט — ללא שיבוץ</span>
                          ) : (
                            <span className="badge badge-green">אינו בפרויקט — יתווסף</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button
            className="btn btn-primary"
            disabled={selected.length === 0}
            onClick={() => onAdd(selected)}
          >
            הוספה לקבוצה
          </button>
          <button className="btn" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}
/* ============================================================
   Select existing volunteers to add to a project group.
   - Shows all volunteers in the system, excluding ones already
     linked to this project group (via projectVolunteers).
   - Mirrors the elderly-selection modal in UX & style.
============================================================ */

function SelectVolunteersForGroupModal({
  group,
  allVolunteers = [],
  allGroups = [],
  excludeIds = [],
  onClose,
  onAdd,
}) {
  const excludeSet = new Set(excludeIds);
  const groupNameById = useMemo(() => {
    const m = {};
    allGroups.forEach((g) => { m[g.id] = g.name; });
    return m;
  }, [allGroups]);

  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");
  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const available = allVolunteers.filter((v) => !excludeSet.has(v.id));

  const filtered = available.filter((v) => {
    if (!search) return true;
    const s = search.toLowerCase();
    const grpName = v.group || groupNameById[v.groupId] || "";
    return (
      (volName(v) || "").toLowerCase().includes(s) ||
      (volPhone(v) || "").toLowerCase().includes(s) ||
      (v.neighborhood || "").toLowerCase().includes(s) ||
      (v.address || "").toLowerCase().includes(s) ||
      (grpName || "").toLowerCase().includes(s) ||
      (volStatus(v) || "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>הוספת מתנדבים לקבוצה: {group.name}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-section">
          <div className="field">
            <input
              className="input"
              placeholder="חיפוש לפי שם, טלפון, שכונה, כתובת, קבוצה או סטטוס..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", color: "#666", padding: "16px" }}>
              אין מתנדבים זמינים להוספה לקבוצה זו
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>שם מלא</th>
                    <th>טלפון</th>
                    <th>שכונה</th>
                    <th>כתובת</th>
                    <th>קבוצה</th>
                    <th>סטטוס</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => {
                    const grpName = v.group || groupNameById[v.groupId] || "—";
                    const status = volStatus(v);
                    return (
                      <tr key={v.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.includes(v.id)}
                            onChange={() => toggle(v.id)}
                          />
                        </td>
                        <td>{volName(v) || "—"}</td>
                        <td>{volPhone(v) || "—"}</td>
                        <td>{v.neighborhood || "—"}</td>
                        <td>{v.address || "—"}</td>
                        <td>{grpName}</td>
                        <td>
                          <span className={`badge ${status === "פעיל" ? "badge-green" : "badge-gray"}`}>
                            {status || "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button
            className="btn btn-primary"
            disabled={selected.length === 0}
            onClick={() => onAdd(selected)}
          >
            הוספה לקבוצה
          </button>
          <button className="btn" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}
