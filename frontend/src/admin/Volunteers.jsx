import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import AdminPageLayout from "@/components/admin/AdminPageLayout.jsx";
import StatsCard from "@/components/admin/StatsCard.jsx";
import SearchFilters from "@/components/admin/SearchFilters.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import DataTable from "@/components/admin/DataTable.jsx";

import {
  getVolunteers,
  createVolunteer,
  editVolunteer,
  deleteVolunteer,
  getVolunteerGroups,
  createVolunteerGroup,
  editVolunteerGroup,
  addVolunteerToGroup,
  increaseGroupCount,
  removeVolunteerFromGroup,
  deleteVolunteerGroup,
  clearGroupFromVolunteers,
} from "../services/volunteersService";
import { getReportsForVolunteer } from "../services/reportsService";
import { getTasksForVolunteer, taskStatusLabel, taskTypeLabel, taskStatusBadge } from "../services/tasksService";
import { getElderly } from "../services/elderlyService";

import useAreasAndNeighborhoods from "../hooks/useAreasAndNeighborhoods";

/* =========================
   Options
   Areas & neighborhoods are loaded from Firestore (settings/general) via the
   useAreasAndNeighborhoods hook — no hardcoded lists.
========================= */

const GROUP_TYPE_OPTIONS = ["סטודנטים", "בית ספר", "חברה", "עמותה", "אחר"];
const VOLUNTEER_STATUS_OPTIONS = ["משויך לאזרח ותיק", "ממתין לשיבוץ", "בארכיון"];

/* =========================
   Validation helpers
========================= */
import {
  validatePhone as _validatePhone,
  validateId as _validateId,
  validateName as _validateName,
  validateEmail as _validateEmail,
  filterDigits,
  filterName,
} from "@/utils/validation";

const LETTERS_RE = /^[\u0590-\u05FF\u0600-\u06FFa-zA-Z\s'"\-]+$/;
const isLettersOnly = (v) => LETTERS_RE.test((v || "").trim());
const isNumbersOnly = (v) => /^\d+$/.test((v || "").trim());
const Req = () => <span style={{ color: "#dc2626", marginInlineStart: 4 }}>*</span>;
const FieldError = ({ msg }) =>
  msg ? <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{msg}</div> : null;

const GROUP_STATUS_OPTIONS = ["פעילה", "לא פעילה", "בהקמה"];

const PARLIAMENT_OPTIONS = [
  "ללא פרלמנט",
  "פרלמנט גילה",
  "פרלמנט קטמון",
  "פרלמנט רחביה",
  "פרלמנט בית הכרם",
  "פרלמנט רוממה",
];

// Non-area/neighborhood filters kept as static defaults; area & neighborhood
// are injected dynamically inside the component from the shared hook.
const BASE_FILTERS = [
  {
    key: "status",
    label: "סטטוס",
    options: ["", ...VOLUNTEER_STATUS_OPTIONS],
  },
  { key: "insurance", label: "ביטוח", options: ["", "כן", "לא"] },
];

const REPORTS_SEED = {};

const statusBadge = (s) =>
  s === "משויך לאזרח ותיק" ? "badge-green" : s === "ממתין לשיבוץ" ? "badge-orange" : "badge-gray";

const insBadge = (i) => (i === "כן" ? "badge-green" : "badge-orange");

const groupStatusBadge = (s) => (s === "פעילה" ? "badge-green" : s === "בהקמה" ? "badge-orange" : "badge-gray");

/* =========================
   Main Component
========================= */

export default function Volunteers() {
  const [tab, setTab] = useState("volunteers");

  const [showAdd, setShowAdd] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const [openVolunteerId, setOpenVolunteerId] = useState(null);
  const [openGroupId, setOpenGroupId] = useState(null);

  const [volunteers, setVolunteers] = useState([]);
  const [groups, setGroups] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Shared area/neighborhood data — drives both filters and form dropdowns.
  const {
    areaNames,
    getNeighborhoods,
    loading: areasLoading,
    error: areasError,
    isEmpty: areasEmpty,
  } = useAreasAndNeighborhoods();

  // Filter state (area + neighborhood are wired to actual filtering).
  const [filterArea, setFilterArea] = useState("");
  const [filterNeighborhood, setFilterNeighborhood] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterInsurance, setFilterInsurance] = useState("");
  const [search, setSearch] = useState("");

  // Reset neighborhood when area changes if it's no longer valid for that area.
  useEffect(() => {
    if (!filterNeighborhood) return;
    if (!getNeighborhoods(filterArea).includes(filterNeighborhood)) {
      setFilterNeighborhood("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterArea]);

  /* =========================
     Load Firebase data
  ========================= */

  const [elderlyList, setElderlyList] = useState([]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const [volunteersData, groupsData, elderlyData] = await Promise.all([
          getVolunteers(),
          getVolunteerGroups(),
          getElderly().catch(() => []),
        ]);

        setVolunteers(volunteersData);
        setGroups(groupsData);
        setElderlyList(elderlyData);
      } catch (err) {
        console.error(err);
        setError("שגיאה בטעינת הנתונים מ-Firebase");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Build a map: volunteerId -> [elderly names] using real DB relationships.
  const elderlyByVolunteer = useMemo(() => {
    const map = new Map();
    for (const e of elderlyList) {
      if (!e.volId) continue;
      const name = `${e.firstName || ""} ${e.lastName || ""}`.trim() || e.name || "אזרח ותיק";
      const arr = map.get(e.volId) || [];
      arr.push({ id: e.id, name });
      map.set(e.volId, arr);
    }
    return map;
  }, [elderlyList]);

  /* =========================
     Derived data
  ========================= */

  const sorted = useMemo(() => {
    return [...volunteers].sort((a, b) => (a.name || "").localeCompare(b.name || "", "he"));
  }, [volunteers]);

  const visibleVolunteers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter((v) => {
      if (filterArea && v.area !== filterArea) return false;
      if (filterNeighborhood && v.neighborhood !== filterNeighborhood) return false;
      if (filterStatus && v.status !== filterStatus) return false;
      if (filterInsurance && (v.insurance || "לא") !== filterInsurance) return false;
      if (q) {
        const assigned = (elderlyByVolunteer.get(v.id) || []).map((e) => e.name).join(" ");
        const hay = [v.name, v.phone, v.group, v.neighborhood, v.area, assigned]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sorted, filterArea, filterNeighborhood, filterStatus, filterInsurance, search, elderlyByVolunteer]);

  const openVolunteer = sorted.find((v) => v.id === openVolunteerId) || null;

  const openGroup = groups.find((g) => g.id === openGroupId) || null;

  const activeGroupsCount = groups.filter((g) => g.status === "פעילה").length;

  const volunteersInGroups = volunteers.filter((v) => v.groupId && v.group && v.group !== "ללא קבוצה").length;

  const groupVolunteersFor = (group) => {
    if (!group) return [];

    return sorted.filter((v) => v.groupId === group.id || v.group === group.name);
  };

  /* =========================
     Firebase Actions
  ========================= */

  const handleAddVolunteer = async (newVolunteer) => {
    try {
      const savedVolunteer = await createVolunteer(newVolunteer);

      setVolunteers((prev) => [savedVolunteer, ...prev]);

      if (newVolunteer.groupId) {
        await increaseGroupCount(newVolunteer.groupId);

        setGroups((prev) => prev.map((g) => (g.id === newVolunteer.groupId ? { ...g, count: (g.count || 0) + 1 } : g)));
      }

      setShowAdd(false);
    } catch (err) {
      console.error(err);
      alert("שגיאה בהוספת מתנדב");
    }
  };

  const handleUpdateVolunteer = async (updatedVolunteer) => {
    try {
      await editVolunteer(updatedVolunteer.id, updatedVolunteer);

      setVolunteers((prev) => prev.map((v) => (v.id === updatedVolunteer.id ? { ...v, ...updatedVolunteer } : v)));

      setOpenVolunteerId(null);
    } catch (err) {
      console.error(err);
      alert("שגיאה בעדכון פרטי המתנדב");
    }
  };

  const handleCreateGroup = async (newGroup) => {
    try {
      const savedGroup = await createVolunteerGroup(newGroup);

      setGroups((prev) => [savedGroup, ...prev]);
      setShowCreateGroup(false);
    } catch (err) {
      console.error(err);
      alert("שגיאה ביצירת קבוצה");
    }
  };

  const handleUpdateGroup = async (updatedGroup) => {
    try {
      await editVolunteerGroup(updatedGroup.id, updatedGroup);

      setGroups((prev) => prev.map((g) => (g.id === updatedGroup.id ? { ...g, ...updatedGroup } : g)));
    } catch (err) {
      console.error(err);
      alert("שגיאה בעדכון הקבוצה");
    }
  };

  const handleAddVolunteerToGroup = async (groupId, entry) => {
    try {
      const group = groups.find((g) => g.id === groupId);
      if (!group) return;

      const volunteer = volunteers.find((v) => v.id === entry.volunteerId);
      if (!volunteer) return;

      if (volunteer.groupId === group.id || volunteer.group === group.name) {
        alert("המתנדב כבר קיים בקבוצה זו");
        return;
      }

      await addVolunteerToGroup(entry.volunteerId, group, entry.role, entry.notes);

      setVolunteers((prev) =>
        prev.map((v) =>
          v.id === entry.volunteerId
            ? {
                ...v,
                groupId: group.id,
                group: group.name,
                groupRole: entry.role || "חבר קבוצה",
                groupNotes: entry.notes || "",
              }
            : v,
        ),
      );

      setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, count: (g.count || 0) + 1 } : g)));
    } catch (err) {
      console.error(err);
      alert("שגיאה בהוספת מתנדב לקבוצה");
    }
  };

  const handleDeleteVolunteer = async (volunteer) => {
    if (!volunteer) return;
    const ok = window.confirm(`האם אתה בטוח שברצונך למחוק את המתנדב "${volunteer.name}"?`);
    if (!ok) return;

    try {
      await deleteVolunteer(volunteer.id);

      setVolunteers((prev) => prev.filter((v) => v.id !== volunteer.id));

      if (volunteer.groupId) {
        setGroups((prev) =>
          prev.map((g) => (g.id === volunteer.groupId ? { ...g, count: Math.max(0, (g.count || 0) - 1) } : g)),
        );
        try {
          await editVolunteerGroup(volunteer.groupId, {
            count: Math.max(0, (groups.find((g) => g.id === volunteer.groupId)?.count || 1) - 1),
          });
        } catch (e) {
          console.warn("group count update failed", e);
        }
      }

      setOpenVolunteerId(null);
    } catch (err) {
      console.error(err);
      alert("שגיאה במחיקת המתנדב");
    }
  };

  const handleRemoveVolunteerFromGroup = async (volunteerId, groupId) => {
    const ok = window.confirm("האם להסיר את המתנדב מהקבוצה?");
    if (!ok) return;

    try {
      await removeVolunteerFromGroup(volunteerId, groupId);

      setVolunteers((prev) =>
        prev.map((v) =>
          v.id === volunteerId ? { ...v, groupId: null, group: "ללא קבוצה", groupRole: "", groupNotes: "" } : v,
        ),
      );

      if (groupId) {
        setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, count: Math.max(0, (g.count || 0) - 1) } : g)));
      }
    } catch (err) {
      console.error(err);
      alert("שגיאה בהסרת המתנדב מהקבוצה");
    }
  };

  const handleDeleteGroup = async (group) => {
    if (!group) return;
    const ok = window.confirm(`האם למחוק את הקבוצה "${group.name}"? המתנדבים עצמם לא יימחקו.`);
    if (!ok) return;

    try {
      await clearGroupFromVolunteers(group.id);
      await deleteVolunteerGroup(group.id);

      setVolunteers((prev) =>
        prev.map((v) =>
          v.groupId === group.id ? { ...v, groupId: null, group: "ללא קבוצה", groupRole: "", groupNotes: "" } : v,
        ),
      );
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
      setOpenGroupId(null);
    } catch (err) {
      console.error(err);
      alert("שגיאה במחיקת הקבוצה");
    }
  };

  /* =========================
     UI
  ========================= */

  return (
    <AdminPageLayout heroImage="/admin-heroes/volunteers_hero.png"
      title="ניהול מתנדבים"
      subtitle="ניהול מתנדבים, קבוצות התנדבות, שיוך לאזרחים ותיקים, סטטוס פעילות וביטוח."
      actions={
        tab === "volunteers" ? (
          <>
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
              + הוספת מתנדב
            </button>
            <button className="btn" onClick={() => setShowPrint(true)}>
              הדפסת רשימה
            </button>
          </>
        ) : null
      }
    >
      {error && (
        <SectionCard>
          <p style={{ color: "red", fontWeight: 600 }}>{error}</p>
        </SectionCard>
      )}

      {tab === "volunteers" ? (
        <div className="stats-grid">
          <StatsCard icon="👥" title="סה״כ מתנדבים" value={String(volunteers.length)} />
          <StatsCard
            icon="🤝"
            title="משויכים לאזרח ותיק"
            value={String(volunteers.filter((v) => v.status === "משויך לאזרח ותיק").length)}
          />
          <StatsCard
            icon="⏳"
            title="ממתינים לשיבוץ"
            value={String(volunteers.filter((v) => v.status === "ממתין לשיבוץ").length)}
          />
          <StatsCard icon="🟢" title="קבוצות פעילות" value={String(activeGroupsCount)} />
        </div>
      ) : (
        <div className="stats-grid">
          <StatsCard icon="🗂️" title="סה״כ קבוצות" value={String(groups.length)} />
          <StatsCard icon="👥" title="מתנדבים בקבוצות" value={String(volunteersInGroups)} />
          <StatsCard icon="🟢" title="קבוצות פעילות" value={String(activeGroupsCount)} />
          <StatsCard icon="🟡" title="קבוצות בהקמה" value={String(groups.filter((g) => g.status === "בהקמה").length)} />
        </div>
      )}

      <div className="tab-bar">
        <button className={tab === "volunteers" ? "active" : ""} onClick={() => setTab("volunteers")}>
          מתנדבים
        </button>
        <button className={tab === "groups" ? "active" : ""} onClick={() => setTab("groups")}>
          ניהול קבוצות מתנדבים
        </button>
      </div>

      {tab === "volunteers" && (
        <SectionCard>
          {areasError && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 8 }}>{areasError}</div>}
          {areasLoading && (
            <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 8 }}>טוען אזורים ושכונות...</div>
          )}
          {areasEmpty && <div style={{ color: "#92400e", fontSize: 13, marginBottom: 8 }}>לא נמצאו אזורים ושכונות</div>}
          <SearchFilters
            searchPlaceholder="חיפוש לפי שם, טלפון, קבוצה, שכונה או אזרח ותיק משויך..."
            searchValue={search}
            onSearchChange={(e) => setSearch(e.target.value)}
            filters={[
              {
                key: "area",
                label: "אזור",
                value: filterArea,
                onChange: (e) => setFilterArea(e.target.value),
                options: ["", ...areaNames],
              },
              {
                key: "neighborhood",
                label: "שכונה",
                value: filterNeighborhood,
                onChange: (e) => setFilterNeighborhood(e.target.value),
                options: ["", ...getNeighborhoods(filterArea)],
              },
              {
                ...BASE_FILTERS[0],
                value: filterStatus,
                onChange: (e) => setFilterStatus(e.target.value),
              },
              {
                ...BASE_FILTERS[1],
                value: filterInsurance,
                onChange: (e) => setFilterInsurance(e.target.value),
              },
            ]}
          />


          {loading ? (
            <p style={{ padding: 20 }}>טוען מתנדבים...</p>
          ) : (
            <DataTable
              columns={[
                {
                  key: "name",
                  label: "שם",
                  render: (r) => (
                    <button className="link-btn" onClick={() => setOpenVolunteerId(r.id)}>
                      {r.name}
                    </button>
                  ),
                },
                { key: "phone", label: "טלפון" },
                {
                  key: "area",
                  label: "שכונה / אזור",
                  render: (r) => `${r.neighborhood || "—"} / ${r.area || "—"}`,
                },
                {
                  key: "group",
                  label: "קבוצה",
                  render: (r) => r.group || "עצמאי",
                },
                {
                  key: "assigned",
                  label: "משויך ל",
                  render: (r) => {
                    const list = elderlyByVolunteer.get(r.id) || [];
                    if (list.length === 0) {
                      return <span style={{ color: "#6b7280" }}>לא משויך</span>;
                    }
                    const first = list[0];
                    const extra = list.length - 1;
                    return (
                      <Link className="link-btn" to={`/admin/elderly/${first.id}`} title={list.map((e) => e.name).join(", ")}>
                        {first.name}
                        {extra > 0 ? ` + ${extra} נוספים` : ""}
                      </Link>
                    );
                  },
                },
                {
                  key: "insurance",
                  label: "ביטוח",
                  render: (r) => <span className={`badge ${insBadge(r.insurance)}`}>{r.insurance || "לא"}</span>,
                },
                { key: "start", label: "תאריך התחלה" },
                {
                  key: "status",
                  label: "סטטוס",
                  render: (r) => <span className={`badge ${statusBadge(r.status)}`}>{r.status || "—"}</span>,
                },
                { key: "rating", label: "דירוג" },
              ]}
              data={visibleVolunteers}
            />
          )}
        </SectionCard>
      )}

      {tab === "groups" && (
        <SectionCard
          title="ניהול קבוצות מתנדבים"
          actions={
            <button className="btn btn-primary" onClick={() => setShowCreateGroup(true)}>
              + יצירת קבוצה
            </button>
          }
        >
          {loading ? (
            <p style={{ padding: 20 }}>טוען קבוצות...</p>
          ) : (
            <DataTable
              columns={[
                {
                  key: "name",
                  label: "שם קבוצה",
                  render: (r) => (
                    <button className="link-btn" onClick={() => setOpenGroupId(r.id)}>
                      {r.name}
                    </button>
                  ),
                },
                { key: "type", label: "סוג" },
                { key: "contact", label: "איש קשר" },
                { key: "phone", label: "טלפון" },
                { key: "count", label: "מס׳ מתנדבים" },
                {
                  key: "status",
                  label: "סטטוס",
                  render: (r) => <span className={`badge ${groupStatusBadge(r.status)}`}>{r.status}</span>,
                },
                { key: "notes", label: "הערות" },
              ]}
              data={groups}
            />
          )}
        </SectionCard>
      )}

      {showAdd && <AddVolunteerModal groups={groups} onClose={() => setShowAdd(false)} onSave={handleAddVolunteer} />}

      {showPrint && <PrintReportModal volunteers={sorted} onClose={() => setShowPrint(false)} />}

      {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} onSave={handleCreateGroup} />}

      {openVolunteer && (
        <VolunteerProfileModal
          volunteer={openVolunteer}
          groups={groups}
          onClose={() => setOpenVolunteerId(null)}
          onSave={handleUpdateVolunteer}
          onDelete={handleDeleteVolunteer}
        />
      )}

      {openGroup && (
        <GroupManageModal
          group={openGroup}
          volunteers={groupVolunteersFor(openGroup)}
          allVolunteers={sorted}
          onClose={() => setOpenGroupId(null)}
          onSave={handleUpdateGroup}
          onAddVolunteer={(entry) => handleAddVolunteerToGroup(openGroup.id, entry)}
          onDeleteGroup={handleDeleteGroup}
          onRemoveVolunteer={handleRemoveVolunteerFromGroup}
        />
      )}
    </AdminPageLayout>
  );
}

/* =========================
   Volunteer Profile Modal
========================= */

function VolunteerProfileModal({ volunteer, groups = [], onClose, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => {
    const firstName = volunteer.firstName || (volunteer.name ? volunteer.name.split(" ")[0] : "");
    const lastName = volunteer.lastName || (volunteer.name ? volunteer.name.split(" ").slice(1).join(" ") : "");
    return { ...volunteer, firstName, lastName };
  });
  const [errors, setErrors] = useState({});
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const {
    areaNames,
    getNeighborhoods,
    loading: areasLoading,
    error: areasError,
    isEmpty: areasEmpty,
  } = useAreasAndNeighborhoods();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setReportsLoading(true);
        setTasksLoading(true);
        const [r, t] = await Promise.all([
          getReportsForVolunteer(volunteer.id),
          getTasksForVolunteer(volunteer.id),
        ]);
        if (!cancelled) {
          setReports(r);
          setTasks(t);
        }
      } catch (err) {
        console.error("load volunteer data error:", err);
      } finally {
        if (!cancelled) {
          setReportsLoading(false);
          setTasksLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [volunteer.id]);

  const set = (key) => (e) => {
    const value = e.target.value;

    if (key === "groupId") {
      const selectedGroup = groups.find((g) => g.id === value);
      setForm({
        ...form,
        groupId: selectedGroup ? selectedGroup.id : null,
        group: selectedGroup ? selectedGroup.name : "עצמאי",
      });
      return;
    }

    if (key === "area") {
      setForm({ ...form, area: value, neighborhood: "" });
      return;
    }

    let v = value;
    if (key === "phone") v = filterDigits(v, 10);
    else if (key === "idNumber") v = filterDigits(v, 9);
    else if (key === "firstName" || key === "lastName") v = filterName(v, 80);
    setForm({
      ...form,
      [key]: v,
    });
  };

  const validate = () => {
    const e = {};
    const fn = _validateName(form.firstName); if (fn) e.firstName = fn;
    const ln = _validateName(form.lastName); if (ln) e.lastName = ln;
    const idErr = _validateId(form.idNumber); if (idErr) e.idNumber = idErr;
    const phErr = _validatePhone(form.phone); if (phErr) e.phone = phErr;
    const emErr = _validateEmail(form.email, { required: false }); if (emErr) e.email = emErr;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const updated = {
      ...form,
      name: `${form.firstName || ""} ${form.lastName || ""}`.trim(),
    };
    onSave?.(updated);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900 }}>
        <div className="modal-header">
          <h2>פרופיל מתנדב — {form.name}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="form-section">
          <div className="section-card-header" style={{ marginBottom: 12 }}>
            <h4>פרטים אישיים</h4>
            {!editing && (
              <button className="btn btn-primary" onClick={() => setEditing(true)}>
                עריכת פרטים
              </button>
            )}
          </div>

          {!editing ? (
            <div className="detail-grid">
              <div className="item">
                <label>שם מלא</label>
                <div>{form.name}</div>
              </div>
              <div className="item">
                <label>ת.ז</label>
                <div>{form.idNumber || "—"}</div>
              </div>
              <div className="item">
                <label>טלפון</label>
                <div>{form.phone}</div>
              </div>
              <div className="item">
                <label>אזור</label>
                <div>{form.area}</div>
              </div>
              <div className="item">
                <label>שכונה</label>
                <div>{form.neighborhood}</div>
              </div>
              <div className="item">
                <label>כתובת</label>
                <div>{form.address}</div>
              </div>
              <div className="item">
                <label>קבוצה</label>
                <div>{form.group || "עצמאי"}</div>
              </div>
              <div className="item">
                <label>ביטוח</label>
                <div>{form.insurance}</div>
              </div>
              <div className="item">
                <label>תאריך התחלה</label>
                <div>{form.start}</div>
              </div>
              <div className="item">
                <label>סטטוס</label>
                <div>{form.status}</div>
              </div>
              <div className="item" style={{ gridColumn: "1 / -1" }}>
                <label>הערות</label>
                <div>{form.notes || "—"}</div>
              </div>
            </div>
          ) : (
            <>
              <div className="form-section">
                <h4>פרטים אישיים</h4>
                <div className="row row-2">
                  <div className="field">
                    <label>
                      שם פרטי
                      <Req />
                    </label>
                    <input className="input" value={form.firstName || ""} onChange={set("firstName")} />
                    <FieldError msg={errors.firstName} />
                  </div>

                  <div className="field">
                    <label>
                      שם משפחה
                      <Req />
                    </label>
                    <input className="input" value={form.lastName || ""} onChange={set("lastName")} />
                    <FieldError msg={errors.lastName} />
                  </div>

                  <div className="field">
                    <label>
                      ת.ז
                      <Req />
                    </label>
                    <input
                      className="input"
                      inputMode="numeric"
                      value={form.idNumber || ""}
                      onChange={set("idNumber")}
                    />
                    <FieldError msg={errors.idNumber} />
                  </div>

                  <div className="field">
                    <label>
                      טלפון
                      <Req />
                    </label>
                    <input className="input" inputMode="numeric" value={form.phone || ""} onChange={set("phone")} />
                    <FieldError msg={errors.phone} />
                  </div>

                  <div className="field">
                    <label>אזור</label>
                    <select
                      className="select"
                      value={form.area || ""}
                      onChange={set("area")}
                      disabled={areasLoading || areasEmpty}
                    >
                      <option value="">
                        {areasLoading ? "טוען אזורים..." : areasEmpty ? "לא נמצאו אזורים" : "בחר אזור"}
                      </option>
                      {areaNames.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                    {areasError && <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>{areasError}</div>}
                  </div>

                  <div className="field">
                    <label>שכונה</label>
                    <select
                      className="select"
                      value={form.neighborhood || ""}
                      onChange={set("neighborhood")}
                      disabled={!form.area}
                    >
                      <option value="">{form.area ? "בחר שכונה" : "בחר אזור תחילה"}</option>
                      {getNeighborhoods(form.area).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>כתובת</label>
                    <input className="input" value={form.address || ""} onChange={set("address")} />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h4>פרטי התנדבות</h4>
                <div className="row row-2">
                  <div className="field">
                    <label>סטטוס</label>
                    <select className="select" value={form.status || ""} onChange={set("status")}>
                      {VOLUNTEER_STATUS_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>תאריך תחילת התנדבות</label>
                    <input className="input" type="date" value={form.start || ""} onChange={set("start")} />
                  </div>
                </div>

                <div className="field">
                  <label>הערות</label>
                  <textarea className="textarea" rows={2} value={form.notes || ""} onChange={set("notes")} />
                </div>
              </div>

              <div className="form-section">
                <h4>שיוך</h4>
                <div className="row row-2">
                  <div className="field">
                    <label>קבוצה / גוף התנדבות</label>
                    <select className="select" value={form.groupId || ""} onChange={set("groupId")}>
                      <option value="">עצמאי</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h4>ביטוח</h4>
                <div className="row row-2">
                  <div className="field">
                    <label>ביטוח</label>
                    <select className="select" value={form.insurance || "כן"} onChange={set("insurance")}>
                      <option>כן</option>
                      <option>לא</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>תאריך עדכון ביטוח</label>
                    <input
                      className="input"
                      type="date"
                      value={form.insuranceUpdateDate || ""}
                      onChange={set("insuranceUpdateDate")}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button className="btn btn-primary" onClick={handleSave}>
                  שמירה
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    const firstName = volunteer.firstName || (volunteer.name ? volunteer.name.split(" ")[0] : "");
                    const lastName =
                      volunteer.lastName || (volunteer.name ? volunteer.name.split(" ").slice(1).join(" ") : "");
                    setForm({ ...volunteer, firstName, lastName });
                    setErrors({});
                    setEditing(false);
                  }}
                >
                  ביטול
                </button>
              </div>
            </>
          )}
        </div>

        {!editing && (
          <div className="form-section">
            <h4>דוחות מתנדב</h4>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>תאריך</th>
                    <th>אזרח ותיק</th>
                    <th>סוג מפגש</th>
                    <th>סטטוס מפגש</th>
                    <th>נדרש מעקב</th>
                    <th>הערות</th>
                    <th>סטטוס דוח</th>
                  </tr>
                </thead>
                <tbody>
                  {reportsLoading ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: 20 }}>
                        טוען דוחות...
                      </td>
                    </tr>
                  ) : reports.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", color: "var(--color-text-muted)", padding: 20 }}>
                        אין דוחות להצגה
                      </td>
                    </tr>
                  ) : (
                    reports.map((r) => {
                      const d = r.reportDate || r.createdAt;
                      const dateStr = !d
                        ? "—"
                        : typeof d === "string"
                          ? d
                          : d?.seconds
                            ? new Date(d.seconds * 1000).toLocaleDateString("he-IL")
                            : new Date(d).toLocaleDateString("he-IL");
                      const statusLbl = r.status === "reviewed" ? "אושר" : r.status === "rejected" ? "נדחה" : "ממתין";
                      return (
                        <tr key={r.id}>
                          <td>{dateStr}</td>
                          <td>{r.elderlyName || "—"}</td>
                          <td>{r.reportType || "—"}</td>
                          <td>{r.wasMeetingHeld || "—"}</td>
                          <td>{r.needsFollowUp || "—"}</td>
                          <td>{r.notes || "—"}</td>
                          <td>{statusLbl}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!editing && (
          <div className="form-section">
            <h4>משימות המתנדב</h4>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>כותרת</th>
                    <th>סוג</th>
                    <th>אזרח ותיק</th>
                    <th>תאריך יעד</th>
                    <th>סטטוס</th>
                  </tr>
                </thead>
                <tbody>
                  {tasksLoading ? (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: 20 }}>טוען משימות...</td></tr>
                  ) : tasks.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--color-text-muted)", padding: 20 }}>אין משימות להצגה</td></tr>
                  ) : (
                    tasks.map((t) => {
                      const d = t.dueDate;
                      const dateStr = !d ? "—" : typeof d === "string" ? d : d?.seconds ? new Date(d.seconds * 1000).toLocaleDateString("he-IL") : new Date(d).toLocaleDateString("he-IL");
                      return (
                        <tr key={t.id}>
                          <td>{t.title || "—"}</td>
                          <td>{taskTypeLabel(t.taskType)}</td>
                          <td>{t.elderlyName || "—"}</td>
                          <td>{dateStr}</td>
                          <td><span className={`badge ${taskStatusBadge(t.status)}`}>{taskStatusLabel(t.status)}</span></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}


        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            סגירה
          </button>
          {onDelete && (
            <button className="btn btn-danger" onClick={() => onDelete(volunteer)}>
              מחיקת מתנדב
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================
   Group Manage Modal
========================= */

function GroupManageModal({
  group,
  volunteers,
  allVolunteers = [],
  onClose,
  onSave,
  onAddVolunteer,
  onDeleteGroup,
  onRemoveVolunteer,
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(group);
  const [showAddVol, setShowAddVol] = useState(false);
  const { areaNames, loading: areasLoading, isEmpty: areasEmpty } = useAreasAndNeighborhoods();

  const set = (key) => (e) => {
    setForm({
      ...form,
      [key]: e.target.value,
    });
  };

  const handleSave = () => {
    onSave?.(form);
    setEditing(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900 }}>
        <div className="modal-header">
          <h2>{form.name}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="form-section">
          <div className="section-card-header" style={{ marginBottom: 12 }}>
            <h4>פרטי קבוצה</h4>
            {!editing && (
              <button className="btn btn-primary" onClick={() => setEditing(true)}>
                עריכת קבוצה
              </button>
            )}
          </div>

          {!editing ? (
            <div className="detail-grid">
              <div className="item">
                <label>שם קבוצה</label>
                <div>{form.name}</div>
              </div>
              <div className="item">
                <label>סוג קבוצה</label>
                <div>{form.type}</div>
              </div>
              <div className="item">
                <label>איש קשר</label>
                <div>{form.contact}</div>
              </div>
              <div className="item">
                <label>טלפון</label>
                <div>{form.phone}</div>
              </div>
              <div className="item">
                <label>אימייל</label>
                <div>{form.email || "—"}</div>
              </div>
              <div className="item">
                <label>אזור פעילות</label>
                <div>{form.area || "—"}</div>
              </div>
              <div className="item">
                <label>סטטוס</label>
                <div>{form.status}</div>
              </div>
              <div className="item">
                <label>מספר מתנדבים</label>
                <div>{form.count ?? volunteers.length}</div>
              </div>
              <div className="item" style={{ gridColumn: "1 / -1" }}>
                <label>הערות</label>
                <div>{form.notes || "—"}</div>
              </div>
            </div>
          ) : (
            <>
              <div className="row row-2">
                <div className="field">
                  <label>שם קבוצה</label>
                  <input className="input" value={form.name || ""} onChange={set("name")} />
                </div>

                <div className="field">
                  <label>סוג קבוצה</label>
                  <select className="select" value={form.type || ""} onChange={set("type")}>
                    <option value="">בחר סוג</option>
                    {GROUP_TYPE_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>איש קשר</label>
                  <input className="input" value={form.contact || ""} onChange={set("contact")} />
                </div>

                <div className="field">
                  <label>טלפון איש קשר</label>
                  <input className="input" value={form.phone || ""} onChange={set("phone")} />
                </div>

                <div className="field">
                  <label>אימייל איש קשר</label>
                  <input className="input" value={form.email || ""} onChange={set("email")} />
                </div>

                <div className="field">
                  <label>אזור פעילות</label>
                  <select
                    className="select"
                    value={form.area || ""}
                    onChange={set("area")}
                    disabled={areasLoading || areasEmpty}
                  >
                    <option value="">
                      {areasLoading ? "טוען אזורים..." : areasEmpty ? "לא נמצאו אזורים" : "בחר אזור"}
                    </option>
                    {areaNames.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>סטטוס קבוצה</label>
                  <select className="select" value={form.status || ""} onChange={set("status")}>
                    {GROUP_STATUS_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field">
                <label>הערות</label>
                <textarea className="textarea" rows={2} value={form.notes || ""} onChange={set("notes")} />
              </div>

              <div className="modal-actions">
                <button className="btn btn-primary" onClick={handleSave}>
                  שמירה
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    setForm(group);
                    setEditing(false);
                  }}
                >
                  ביטול
                </button>
              </div>
            </>
          )}
        </div>

        {!editing && (
          <div className="form-section">
            <div className="section-card-header" style={{ marginBottom: 12 }}>
              <h4>מתנדבים בקבוצה</h4>
              <button className="btn btn-primary" onClick={() => setShowAddVol(true)}>
                + הוספת מתנדב לקבוצה
              </button>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>שם מתנדב</th>
                    <th>טלפון</th>
                    <th>שכונה / אזור</th>
                    <th>תפקיד בקבוצה</th>
                    <th>סטטוס</th>
                    <th>ביטוח</th>
                    <th>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {volunteers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          textAlign: "center",
                          color: "var(--color-text-muted)",
                          padding: 20,
                        }}
                      >
                        אין מתנדבים בקבוצה זו
                      </td>
                    </tr>
                  ) : (
                    volunteers.map((v) => (
                      <tr key={v.id}>
                        <td>{v.name}</td>
                        <td>{v.phone}</td>
                        <td>
                          {v.neighborhood || "—"} / {v.area || "—"}
                        </td>
                        <td>{v.groupRole || "חבר קבוצה"}</td>
                        <td>
                          <span className={`badge ${statusBadge(v.status)}`}>{v.status}</span>
                        </td>
                        <td>
                          <span className={`badge ${insBadge(v.insurance)}`}>{v.insurance}</span>
                        </td>
                        <td>
                          {onRemoveVolunteer && (
                            <button className="btn btn-danger" onClick={() => onRemoveVolunteer(v.id, group.id)}>
                              הסרה מהקבוצה
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!editing && (
          <div className="modal-actions">
            <button className="btn" onClick={onClose}>
              סגירה
            </button>
            {onDeleteGroup && (
              <button className="btn btn-danger" onClick={() => onDeleteGroup(group)}>
                מחיקת קבוצה
              </button>
            )}
          </div>
        )}

        {showAddVol && (
          <AddVolunteerToGroupModal
            allVolunteers={allVolunteers}
            existingIds={volunteers.map((v) => v.id)}
            onClose={() => setShowAddVol(false)}
            onAdd={(entry) => {
              onAddVolunteer?.(entry);
              setShowAddVol(false);
            }}
          />
        )}
      </div>
    </div>
  );
}

/* =========================
   Add Existing Volunteer To Group Modal
========================= */

function AddVolunteerToGroupModal({ allVolunteers, existingIds, onClose, onAdd }) {
  const [volunteerId, setVolunteerId] = useState("");
  const [role, setRole] = useState("חבר קבוצה");
  const [notes, setNotes] = useState("");
  const [warning, setWarning] = useState("");

  const handleSubmit = () => {
    if (!volunteerId) {
      setWarning("יש לבחור מתנדב");
      return;
    }

    if (existingIds.includes(volunteerId)) {
      setWarning("המתנדב כבר קיים בקבוצה זו");
      return;
    }

    onAdd({
      volunteerId,
      role,
      notes,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h2>הוספת מתנדב לקבוצה</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="form-section">
          <div className="field">
            <label>מתנדב</label>
            <select
              className="select"
              value={volunteerId}
              onChange={(e) => {
                setVolunteerId(e.target.value);
                setWarning("");
              }}
            >
              <option value="" disabled>
                בחר מתנדב
              </option>
              {allVolunteers.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>תפקיד בקבוצה</label>
            <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
              <option>חבר קבוצה</option>
              <option>איש קשר</option>
              <option>מוביל קבוצה</option>
              <option>מתנדב פעיל</option>
            </select>
          </div>

          <div className="field">
            <label>הערות</label>
            <textarea className="textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {warning && (
            <div
              style={{
                color: "var(--color-primary, #9f2f28)",
                fontWeight: 600,
                fontSize: 14,
                marginTop: 4,
              }}
            >
              {warning}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={handleSubmit}>
            הוספה לקבוצה
          </button>
          <button className="btn" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Create Group Modal
========================= */

function CreateGroupModal({ onClose, onSave }) {
  const { areaNames, loading: areasLoading, isEmpty: areasEmpty } = useAreasAndNeighborhoods();
  const [form, setForm] = useState({
    name: "",
    type: "",
    contact: "",
    phone: "",
    email: "",
    area: "",
    status: "פעילה",
    notes: "",
  });

  const [errors, setErrors] = useState({});

  const set = (key) => (e) => {
    setForm({
      ...form,
      [key]: e.target.value,
    });
  };

  const validate = () => {
    const e = {};
    const nm = _validateName(form.name); if (nm) e.name = nm;
    if (!form.type?.trim()) e.type = "שדה חובה";
    const ct = _validateName(form.contact); if (ct) e.contact = ct;
    const ph = _validatePhone(form.phone); if (ph) e.phone = ph;
    const em = _validateEmail(form.email, { required: false }); if (em) e.email = em;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave?.(form);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760 }}>
        <div className="modal-header">
          <h2>יצירת קבוצה</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="form-section">
          <h4>פרטי קבוצה</h4>

          <div className="row row-2">
            <div className="field">
              <label>
                שם קבוצה
                <Req />
              </label>
              <input className="input" value={form.name} onChange={set("name")} />
              <FieldError msg={errors.name} />
            </div>

            <div className="field">
              <label>
                סוג קבוצה
                <Req />
              </label>
              <select className="select" value={form.type} onChange={set("type")}>
                <option value="">בחר סוג</option>
                {GROUP_TYPE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <FieldError msg={errors.type} />
            </div>

            <div className="field">
              <label>
                איש קשר
                <Req />
              </label>
              <input className="input" value={form.contact} onChange={set("contact")} />
              <FieldError msg={errors.contact} />
            </div>

            <div className="field">
              <label>
                טלפון איש קשר
                <Req />
              </label>
              <input className="input" inputMode="numeric" value={form.phone} onChange={set("phone")} />
              <FieldError msg={errors.phone} />
            </div>

            <div className="field">
              <label>אימייל איש קשר</label>
              <input className="input" type="email" value={form.email} onChange={set("email")} />
            </div>

            <div className="field">
              <label>אזור פעילות</label>
              <select className="select" value={form.area} onChange={set("area")} disabled={areasLoading || areasEmpty}>
                <option value="" disabled>
                  {areasLoading ? "טוען אזורים..." : areasEmpty ? "לא נמצאו אזורים" : "בחר אזור"}
                </option>
                {areaNames.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>סטטוס קבוצה</label>
              <select className="select" value={form.status} onChange={set("status")}>
                {GROUP_STATUS_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label>הערות</label>
            <textarea className="textarea" rows={2} value={form.notes} onChange={set("notes")} />
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={handleSave}>
            שמירה
          </button>
          <button className="btn" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Add Volunteer Modal
========================= */

function AddVolunteerModal({ groups = [], onClose, onSave }) {
  const {
    areaNames,
    getNeighborhoods,
    loading: areasLoading,
    error: areasError,
    isEmpty: areasEmpty,
  } = useAreasAndNeighborhoods();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    idNumber: "",
    phone: "",
    address: "",
    neighborhood: "",
    area: "",
    status: "משויך לאזרח ותיק",
    start: "",
    notes: "",
    groupId: null,
    group: "עצמאי",
    groupRole: "",
    assigned: "ממתין לשיבוץ",
    assignedId: null,
    insurance: "כן",
    insuranceUpdateDate: "",
    rating: "—",
  });

  const [errors, setErrors] = useState({});

  const set = (key) => (e) => {
    const value = e.target.value;

    if (key === "groupId") {
      const selectedGroup = groups.find((g) => g.id === value);

      setForm({
        ...form,
        groupId: selectedGroup ? selectedGroup.id : null,
        group: selectedGroup ? selectedGroup.name : "עצמאי",
      });

      return;
    }

    if (key === "area") {
      setForm({ ...form, area: value, neighborhood: "" });
      return;
    }

    let v = value;
    if (key === "phone") v = filterDigits(v, 10);
    else if (key === "idNumber") v = filterDigits(v, 9);
    else if (key === "firstName" || key === "lastName") v = filterName(v, 80);
    setForm({
      ...form,
      [key]: v,
    });
  };

  const validate = () => {
    const e = {};
    const fn = _validateName(form.firstName); if (fn) e.firstName = fn;
    const ln = _validateName(form.lastName); if (ln) e.lastName = ln;
    const idErr = _validateId(form.idNumber); if (idErr) e.idNumber = idErr;
    const phErr = _validatePhone(form.phone); if (phErr) e.phone = phErr;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    const volunteerToSave = {
      ...form,
      name: `${form.firstName} ${form.lastName}`.trim(),
    };

    onSave?.(volunteerToSave);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>הוספת מתנדב</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="form-section">
          <h4>פרטים אישיים</h4>

          <div className="row row-2">
            <div className="field">
              <label>
                שם פרטי
                <Req />
              </label>
              <input className="input" value={form.firstName} onChange={set("firstName")} />
              <FieldError msg={errors.firstName} />
            </div>

            <div className="field">
              <label>
                שם משפחה
                <Req />
              </label>
              <input className="input" value={form.lastName} onChange={set("lastName")} />
              <FieldError msg={errors.lastName} />
            </div>

            <div className="field">
              <label>
                ת.ז
                <Req />
              </label>
              <input className="input" inputMode="numeric" value={form.idNumber} onChange={set("idNumber")} />
              <FieldError msg={errors.idNumber} />
            </div>

            <div className="field">
              <label>
                טלפון
                <Req />
              </label>
              <input className="input" inputMode="numeric" value={form.phone} onChange={set("phone")} />
              <FieldError msg={errors.phone} />
            </div>

            <div className="field">
              <label>אזור</label>
              <select className="select" value={form.area} onChange={set("area")} disabled={areasLoading || areasEmpty}>
                <option value="">
                  {areasLoading ? "טוען אזורים..." : areasEmpty ? "לא נמצאו אזורים" : "בחר אזור"}
                </option>
                {areaNames.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              {areasError && <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>{areasError}</div>}
            </div>

            <div className="field">
              <label>שכונה</label>
              <select className="select" value={form.neighborhood} onChange={set("neighborhood")} disabled={!form.area}>
                <option value="">{form.area ? "בחר שכונה" : "בחר אזור תחילה"}</option>
                {getNeighborhoods(form.area).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>כתובת</label>
              <input className="input" value={form.address} onChange={set("address")} />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h4>פרטי התנדבות</h4>

          <div className="row row-2">
            <div className="field">
              <label>סטטוס</label>
              <select className="select" value={form.status} onChange={set("status")}>
                {VOLUNTEER_STATUS_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>תאריך תחילת התנדבות</label>
              <input className="input" type="date" value={form.start} onChange={set("start")} />
            </div>
          </div>

          <div className="field">
            <label>הערות</label>
            <textarea className="textarea" rows={2} value={form.notes} onChange={set("notes")} />
          </div>
        </div>

        <div className="form-section">
          <h4>שיוך</h4>

          <div className="row row-2">
            <div className="field">
              <label>קבוצה / גוף התנדבות</label>
              <select className="select" value={form.groupId || ""} onChange={set("groupId")}>
                <option value="">עצמאי</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h4>ביטוח</h4>

          <div className="row row-2">
            <div className="field">
              <label>ביטוח</label>
              <select className="select" value={form.insurance} onChange={set("insurance")}>
                <option>כן</option>
                <option>לא</option>
              </select>
            </div>

            <div className="field">
              <label>תאריך עדכון ביטוח</label>
              <input
                className="input"
                type="date"
                value={form.insuranceUpdateDate}
                onChange={set("insuranceUpdateDate")}
              />
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={handleSave}>
            שמירה
          </button>
          <button className="btn" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Print Report Modal
========================= */

function PrintReportModal({ volunteers, onClose }) {
  const { areaNames, getNeighborhoods } = useAreasAndNeighborhoods();
  const [sel, setSel] = useState({
    area: "",
    neighborhood: "",
    status: "",
    type: "",
    group: "",
    insurance: "",
    availability: "",
  });

  const [showPreview, setShowPreview] = useState(false);

  const filtered = useMemo(() => {
    return volunteers.filter((v) => {
      if (sel.area && v.area !== sel.area) return false;
      if (sel.neighborhood && v.neighborhood !== sel.neighborhood) return false;
      if (sel.status && v.status !== sel.status) return false;
      if (sel.type && v.type !== sel.type) return false;
      if (sel.group && v.group !== sel.group) return false;
      if (sel.insurance && v.insurance !== sel.insurance) return false;
      return true;
    });
  }, [volunteers, sel]);

  const setF = (key) => (e) => {
    const value = e.target.value;
    if (key === "area") {
      const validNb = getNeighborhoods(value).includes(sel.neighborhood);
      setSel({ ...sel, area: value, neighborhood: validNb ? sel.neighborhood : "" });
      return;
    }
    setSel({ ...sel, [key]: value });
  };

  const handleDownload = () => {
    const headers = ["שם", "טלפון", "שכונה", "אזור", "סוג", "קבוצה", "משויך ל", "ביטוח", "סטטוס"];

    const rows = filtered.map((v) => [
      v.name,
      v.phone,
      v.neighborhood,
      v.area,
      v.type,
      v.group,
      v.assigned,
      v.insurance,
      v.status,
    ]);

    const csv =
      "\uFEFF" +
      [headers, ...rows].map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "volunteers-report.csv";
    a.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 980 }}>
        <div className="modal-header">
          <h2>הכנת דוח מתנדבים להדפסה</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="form-section no-print">
          <h4>סינון לדוח</h4>

          <div className="filters-row">
            {[
              ["area", "אזור"],
              ["neighborhood", "שכונה"],
              ["status", "סטטוס"],
              ["type", "סוג מתנדב"],
              ["group", "קבוצה"],
              ["insurance", "ביטוח"],
              ["availability", "זמינות"],
            ].map(([key, label]) => {
              let opts;
              if (key === "area") opts = areaNames;
              else if (key === "neighborhood") opts = getNeighborhoods(sel.area);
              else if (key === "availability") opts = ["בוקר", "צהריים", "ערב"];
              else opts = BASE_FILTERS.find((f) => f.key === key)?.options || [];

              return (
                <select key={key} className="filter-pill" value={sel[key]} onChange={setF(key)}>
                  <option value="">{label}</option>
                  {opts.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              );
            })}
          </div>
        </div>

        {showPreview && (
          <div className="form-section">
            <h4>תצוגה מקדימה ({filtered.length} מתנדבים)</h4>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>שם</th>
                    <th>טלפון</th>
                    <th>שכונה / אזור</th>
                    <th>סוג</th>
                    <th>קבוצה</th>
                    <th>משויך ל</th>
                    <th>ביטוח</th>
                    <th>סטטוס</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => (
                    <tr key={v.id}>
                      <td>{v.name}</td>
                      <td>{v.phone}</td>
                      <td>
                        {v.neighborhood} / {v.area}
                      </td>
                      <td>{v.type}</td>
                      <td>{v.group}</td>
                      <td>{v.assigned}</td>
                      <td>{v.insurance}</td>
                      <td>{v.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="modal-actions no-print">
          <button className="btn btn-primary" onClick={() => setShowPreview(true)}>
            תצוגה מקדימה
          </button>
          <button className="btn" onClick={handleDownload}>
            הורדת דוח
          </button>
          <button className="btn" onClick={() => window.print()}>
            הדפסה
          </button>
          <button className="btn" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}