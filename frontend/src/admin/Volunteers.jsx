import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import AdminLayout from "@/components/admin/AdminLayout.jsx";
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

/* =========================
   Options
========================= */

const GROUP_TYPE_OPTIONS = ["סטודנטים", "בית ספר", "חברה", "עמותה", "מתנדבים פרטיים", "אחר"];

const GROUP_AREA_OPTIONS = ["מרכז", "דרום", "צפון", "מערב", "מזרח", "גילה", "בית הכרם"];

const GROUP_STATUS_OPTIONS = ["פעילה", "לא פעילה", "בהקמה"];

const AREA_OPTIONS = ["מרכז", "דרום", "צפון", "מערב", "מזרח", "גילה", "בית הכרם"];

const NEIGHBORHOOD_OPTIONS = ["גילה", "בית הכרם", "קטמון", "רחביה", "רוממה", "ארנונה", "תלפיות"];

const PARLIAMENT_OPTIONS = [
  "ללא פרלמנט",
  "פרלמנט גילה",
  "פרלמנט קטמון",
  "פרלמנט רחביה",
  "פרלמנט בית הכרם",
  "פרלמנט רוממה",
];

const FILTERS = [
  { key: "area", label: "אזור", options: ["מרכז", "צפון", "דרום", "מערב"] },
  {
    key: "neighborhood",
    label: "שכונה",
    options: ["רחביה", "גילה", "בית הכרם", "פסגת זאב"],
  },
  {
    key: "status",
    label: "סטטוס",
    options: ["פעיל", "ממתין לשיבוץ", "לא פעיל"],
  },
  {
    key: "type",
    label: "סוג מתנדב",
    options: ["סטודנט", "תלמיד", "עצמאי", "ארגון", "תרבות"],
  },
  { key: "insurance", label: "ביטוח", options: ["כן", "לא"] },
];

const REPORTS_SEED = {};

const statusBadge = (s) => (s === "פעיל" ? "badge-green" : s === "ממתין לשיבוץ" ? "badge-orange" : "badge-gray");

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

  /* =========================
     Load Firebase data
  ========================= */

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const volunteersData = await getVolunteers();
        const groupsData = await getVolunteerGroups();

        setVolunteers(volunteersData);
        setGroups(groupsData);
      } catch (err) {
        console.error(err);
        setError("שגיאה בטעינת הנתונים מ-Firebase");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  /* =========================
     Derived data
  ========================= */

  const sorted = useMemo(() => {
    return [...volunteers].sort((a, b) => (a.name || "").localeCompare(b.name || "", "he"));
  }, [volunteers]);

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
          prev.map((g) =>
            g.id === volunteer.groupId ? { ...g, count: Math.max(0, (g.count || 0) - 1) } : g,
          ),
        );
        try {
          await editVolunteerGroup(volunteer.groupId, {
            count: Math.max(
              0,
              (groups.find((g) => g.id === volunteer.groupId)?.count || 1) - 1,
            ),
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
          v.id === volunteerId
            ? { ...v, groupId: null, group: "ללא קבוצה", groupRole: "", groupNotes: "" }
            : v,
        ),
      );

      if (groupId) {
        setGroups((prev) =>
          prev.map((g) =>
            g.id === groupId ? { ...g, count: Math.max(0, (g.count || 0) - 1) } : g,
          ),
        );
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
          v.groupId === group.id
            ? { ...v, groupId: null, group: "ללא קבוצה", groupRole: "", groupNotes: "" }
            : v,
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
    <AdminLayout
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
          <StatsCard title="סה״כ מתנדבים" value={String(volunteers.length)} />
          <StatsCard title="פעילים" value={String(volunteers.filter((v) => v.status === "פעיל").length)} />
          <StatsCard
            title="ממתינים לשיבוץ"
            value={String(volunteers.filter((v) => v.status === "ממתין לשיבוץ").length)}
          />
          <StatsCard title="קבוצות פעילות" value={String(activeGroupsCount)} />
        </div>
      ) : (
        <div className="stats-grid">
          <StatsCard title="סה״כ קבוצות" value={String(groups.length)} />
          <StatsCard title="מתנדבים בקבוצות" value={String(volunteersInGroups)} />
          <StatsCard title="קבוצות פעילות" value={String(activeGroupsCount)} />
          <StatsCard title="קבוצות בהקמה" value={String(groups.filter((g) => g.status === "בהקמה").length)} />
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
          <SearchFilters
            searchPlaceholder="חיפוש לפי שם, טלפון, קבוצה, שכונה או אזרח ותיק משויך..."
            filters={FILTERS}
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
                  key: "type",
                  label: "סוג מתנדב",
                  render: (r) => <span className="badge">{r.type || "—"}</span>,
                },
                {
                  key: "group",
                  label: "קבוצה",
                  render: (r) => r.group || "ללא קבוצה",
                },
                {
                  key: "assigned",
                  label: "משויך ל",
                  render: (r) =>
                    r.assignedId ? (
                      <Link className="link-btn" to={`/admin/elderly/${r.assignedId}`}>
                        {r.assigned}
                      </Link>
                    ) : (
                      r.assigned || "ממתין לשיבוץ"
                    ),
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
              data={sorted}
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
          reports={REPORTS_SEED[openVolunteer.id] || []}
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
    </AdminLayout>
  );
}

/* =========================
   Volunteer Profile Modal
========================= */

function VolunteerProfileModal({ volunteer, reports, groups = [], onClose, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(volunteer);

  const set = (key) => (e) => {
    const value = e.target.value;

    if (key === "groupId") {
      const selectedGroup = groups.find((g) => g.id === value);

      setForm({
        ...form,
        groupId: selectedGroup ? selectedGroup.id : null,
        group: selectedGroup ? selectedGroup.name : "ללא קבוצה",
      });

      return;
    }

    setForm({
      ...form,
      [key]: value,
    });
  };

  const handleSave = () => {
    onSave?.(form);
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
                <label>טלפון</label>
                <div>{form.phone}</div>
              </div>
              <div className="item">
                <label>כתובת</label>
                <div>{form.address}</div>
              </div>
              <div className="item">
                <label>שכונה</label>
                <div>{form.neighborhood}</div>
              </div>
              <div className="item">
                <label>אזור</label>
                <div>{form.area}</div>
              </div>
              <div className="item">
                <label>סוג מתנדב</label>
                <div>{form.type}</div>
              </div>
              <div className="item">
                <label>קבוצה</label>
                <div>{form.group || "ללא קבוצה"}</div>
              </div>
              <div className="item">
                <label>אזרח ותיק משויך</label>
                <div>{form.assigned || "ממתין לשיבוץ"}</div>
              </div>
              <div className="item">
                <label>פרויקט משויך</label>
                <div>{form.project || "—"}</div>
              </div>
              <div className="item">
                <label>פרלמנט משויך</label>
                <div>{form.parliament || "ללא פרלמנט"}</div>
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
              <div className="row row-2">
                <div className="field">
                  <label>שם מלא</label>
                  <input className="input" value={form.name || ""} onChange={set("name")} />
                </div>

                <div className="field">
                  <label>טלפון</label>
                  <input className="input" value={form.phone || ""} onChange={set("phone")} />
                </div>

                <div className="field">
                  <label>כתובת</label>
                  <input className="input" value={form.address || ""} onChange={set("address")} />
                </div>

                <div className="field">
                  <label>שכונה</label>
                  <select className="select" value={form.neighborhood || ""} onChange={set("neighborhood")}>
                    <option value="">בחר שכונה</option>
                    {NEIGHBORHOOD_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>אזור</label>
                  <select className="select" value={form.area || ""} onChange={set("area")}>
                    <option value="">בחר אזור</option>
                    {AREA_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>סוג מתנדב</label>
                  <select className="select" value={form.type || ""} onChange={set("type")}>
                    <option>סטודנט</option>
                    <option>תלמיד</option>
                    <option>עצמאי</option>
                    <option>ארגון</option>
                    <option>תרבות</option>
                    <option>אחר</option>
                  </select>
                </div>

                <div className="field">
                  <label>קבוצה</label>
                  <select className="select" value={form.groupId || ""} onChange={set("groupId")}>
                    <option value="">ללא קבוצה</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>אזרח ותיק משויך</label>
                  <input className="input" value={form.assigned || ""} onChange={set("assigned")} />
                </div>

                <div className="field">
                  <label>פרויקט משויך</label>
                  <input className="input" value={form.project || ""} onChange={set("project")} />
                </div>

                <div className="field">
                  <label>פרלמנט משויך</label>
                  <select className="select" value={form.parliament || ""} onChange={set("parliament")}>
                    <option value="">בחר פרלמנט</option>
                    {PARLIAMENT_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>ביטוח</label>
                  <select className="select" value={form.insurance || "כן"} onChange={set("insurance")}>
                    <option>כן</option>
                    <option>לא</option>
                  </select>
                </div>

                <div className="field">
                  <label>תאריך התחלה</label>
                  <input className="input" type="date" value={form.start || ""} onChange={set("start")} />
                </div>

                <div className="field">
                  <label>סטטוס</label>
                  <select className="select" value={form.status || ""} onChange={set("status")}>
                    <option>פעיל</option>
                    <option>ממתין לשיבוץ</option>
                    <option>לא פעיל</option>
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
                    setForm(volunteer);
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
                  {reports.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          textAlign: "center",
                          color: "var(--color-text-muted)",
                          padding: 20,
                        }}
                      >
                        אין דוחות להצגה
                      </td>
                    </tr>
                  ) : (
                    reports.map((r, i) => (
                      <tr key={i}>
                        <td>{r.date}</td>
                        <td>{r.elderly}</td>
                        <td>{r.type}</td>
                        <td>{r.status}</td>
                        <td>{r.followup}</td>
                        <td>{r.notes}</td>
                        <td>{r.reportStatus}</td>
                      </tr>
                    ))
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

function GroupManageModal({ group, volunteers, allVolunteers = [], onClose, onSave, onAddVolunteer, onDeleteGroup, onRemoveVolunteer }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(group);
  const [showAddVol, setShowAddVol] = useState(false);

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
                  <select className="select" value={form.area || ""} onChange={set("area")}>
                    <option value="">בחר אזור</option>
                    {GROUP_AREA_OPTIONS.map((o) => (
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
                            <button
                              className="btn btn-danger"
                              onClick={() => onRemoveVolunteer(v.id, group.id)}
                            >
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

  const set = (key) => (e) => {
    setForm({
      ...form,
      [key]: e.target.value,
    });
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      alert("יש למלא שם קבוצה");
      return;
    }

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
              <label>שם קבוצה</label>
              <input className="input" value={form.name} onChange={set("name")} />
            </div>

            <div className="field">
              <label>סוג קבוצה</label>
              <select className="select" value={form.type} onChange={set("type")}>
                <option value="" disabled>
                  בחר סוג
                </option>
                {GROUP_TYPE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>איש קשר</label>
              <input className="input" value={form.contact} onChange={set("contact")} />
            </div>

            <div className="field">
              <label>טלפון איש קשר</label>
              <input className="input" value={form.phone} onChange={set("phone")} />
            </div>

            <div className="field">
              <label>אימייל איש קשר</label>
              <input className="input" type="email" value={form.email} onChange={set("email")} />
            </div>

            <div className="field">
              <label>אזור פעילות</label>
              <select className="select" value={form.area} onChange={set("area")}>
                <option value="" disabled>
                  בחר אזור
                </option>
                {GROUP_AREA_OPTIONS.map((o) => (
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
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    idNumber: "",
    phone: "",
    address: "",
    neighborhood: "",
    area: "",
    type: "סטודנט",
    status: "פעיל",
    start: "",
    availability: "",
    notes: "",
    groupId: null,
    group: "ללא קבוצה",
    groupRole: "",
    assigned: "ממתין לשיבוץ",
    assignedId: null,
    project: "—",
    parliament: "ללא פרלמנט",
    insurance: "כן",
    insuranceUpdateDate: "",
    rating: "—",
  });

  const set = (key) => (e) => {
    const value = e.target.value;

    if (key === "groupId") {
      const selectedGroup = groups.find((g) => g.id === value);

      setForm({
        ...form,
        groupId: selectedGroup ? selectedGroup.id : null,
        group: selectedGroup ? selectedGroup.name : "ללא קבוצה",
      });

      return;
    }

    setForm({
      ...form,
      [key]: value,
    });
  };

  const handleSave = () => {
    if (!form.firstName.trim()) {
      alert("יש למלא שם פרטי");
      return;
    }

    if (!form.lastName.trim()) {
      alert("יש למלא שם משפחה");
      return;
    }

    if (!form.phone.trim()) {
      alert("יש למלא טלפון");
      return;
    }

    const volunteerToSave = {
      ...form,
      name: `${form.firstName} ${form.lastName}`,
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
              <label>שם פרטי</label>
              <input className="input" value={form.firstName} onChange={set("firstName")} />
            </div>

            <div className="field">
              <label>שם משפחה</label>
              <input className="input" value={form.lastName} onChange={set("lastName")} />
            </div>

            <div className="field">
              <label>ת.ז</label>
              <input className="input" value={form.idNumber} onChange={set("idNumber")} />
            </div>

            <div className="field">
              <label>טלפון</label>
              <input className="input" value={form.phone} onChange={set("phone")} />
            </div>

            <div className="field">
              <label>כתובת</label>
              <input className="input" value={form.address} onChange={set("address")} />
            </div>

            <div className="field">
              <label>שכונה</label>
              <select className="select" value={form.neighborhood} onChange={set("neighborhood")}>
                <option value="" disabled>
                  בחר שכונה
                </option>
                {NEIGHBORHOOD_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>אזור</label>
              <select className="select" value={form.area} onChange={set("area")}>
                <option value="" disabled>
                  בחר אזור
                </option>
                {AREA_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h4>פרטי התנדבות</h4>

          <div className="row row-2">
            <div className="field">
              <label>סוג מתנדב</label>
              <select className="select" value={form.type} onChange={set("type")}>
                <option>סטודנט</option>
                <option>תלמיד</option>
                <option>עצמאי</option>
                <option>ארגון</option>
                <option>תרבות</option>
                <option>אחר</option>
              </select>
            </div>

            <div className="field">
              <label>סטטוס</label>
              <select className="select" value={form.status} onChange={set("status")}>
                <option>פעיל</option>
                <option>ממתין לשיבוץ</option>
                <option>לא פעיל</option>
              </select>
            </div>

            <div className="field">
              <label>תאריך תחילת התנדבות</label>
              <input className="input" type="date" value={form.start} onChange={set("start")} />
            </div>

            <div className="field">
              <label>זמינות</label>
              <input className="input" value={form.availability} onChange={set("availability")} />
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
                <option value="">ללא קבוצה</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>אזרח ותיק משויך</label>
              <input className="input" value={form.assigned} onChange={set("assigned")} />
            </div>

            <div className="field">
              <label>פרויקט משויך</label>
              <input className="input" value={form.project} onChange={set("project")} />
            </div>

            <div className="field">
              <label>פרלמנט משויך</label>
              <select className="select" value={form.parliament} onChange={set("parliament")}>
                {PARLIAMENT_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
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
    setSel({
      ...sel,
      [key]: e.target.value,
    });
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
              const opts =
                FILTERS.find((f) => f.key === key)?.options ||
                (key === "availability" ? ["בוקר", "צהריים", "ערב"] : []);

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