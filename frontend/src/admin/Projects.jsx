import { useEffect, useMemo, useRef, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout.jsx";
import StatsCard from "@/components/admin/StatsCard.jsx";
import SearchFilters from "@/components/admin/SearchFilters.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import DataTable from "@/components/admin/DataTable.jsx";
import {
  getProjects,
  createProject,
  editProject,
  getElderlyParticipants,
  addElderlyParticipants,
  updateElderlyParticipant,
  removeElderlyParticipant,
  getProjectGroups,
  addProjectGroups,
  removeProjectGroup,
  setProjectGroupVolunteers,
} from "@/services/projectsService.js";

/* ============================================================
   Static reference data (project-detail screens still use these
   until Stages 2 & 3 wire participants/groups to Firestore).
============================================================ */

const PROJECT_TYPES = ["חלוקת חבילות", "אירוע קהילתי", "פעילות מיוחדת", "שי לחג"];
const PROJECT_STATUSES = ["פעיל", "הסתיים", "בוטל"];

const NEIGHBORHOODS_IN_PROJECT = [
  { name: "גילה",        elderly: 34, packages: 32, assigned: 30, delivered: 24, notes: 2 },
  { name: "בית הכרם",    elderly: 22, packages: 21, assigned: 21, delivered: 20, notes: 0 },
  { name: "רחביה",       elderly: 18, packages: 17, assigned: 16, delivered: 14, notes: 1 },
  { name: "קטמון",       elderly: 16, packages: 15, assigned: 14, delivered: 12, notes: 0 },
  { name: "ארמון הנציב", elderly: 14, packages: 14, assigned: 12, delivered: 11, notes: 0 },
  { name: "תלפיות",      elderly: 16, packages: 13, assigned: 11, delivered: 14, notes: 0 },
];

const INITIAL_ELDERLY_BY_NEIGHBORHOOD = {
  "גילה": [
    { id: "e-g-1", n: 1, first: "יוסף",  last: "ברקוביץ", phone: "054-9876543", address: "הפלמ\"ח 8", receives: "כן", delivery: "ממתין למסירה", notes: "להתקשר לפני הגעה" },
    { id: "e-g-2", n: 2, first: "אברהם", last: "כהן",     phone: "053-3334444", address: "מבוא 2",    receives: "לא", delivery: "לא נמסר",       notes: "ביקש לא לקבל חבילה השנה" },
    { id: "e-g-3", n: 3, first: "רחל",   last: "לוי",     phone: "052-1112233", address: "הזית 4",    receives: "כן", delivery: "נמסר",          notes: "" },
    { id: "e-g-4", n: 4, first: "דוד",   last: "ביטון",   phone: "050-7778888", address: "האלון 11",  receives: "כן", delivery: "נמסר",          notes: "זוג — חבילה אחת" },
  ],
  "בית הכרם": [
    { id: "e-b-1", n: 1, first: "חנה", last: "שטרן",    phone: "050-1112222", address: "החלוץ 4",   receives: "כן", delivery: "נמסר",          notes: "" },
    { id: "e-b-2", n: 2, first: "משה", last: "פרידמן",  phone: "052-4445555", address: "הנרקיס 9",  receives: "כן", delivery: "ממתין למסירה", notes: "למסור בבוקר בלבד" },
  ],
};

/* Master list: all elderly that exist globally in the system, by neighborhood.
   Used when adding existing elderly residents to the current project. */
const ALL_ELDERLY_BY_NEIGHBORHOOD = {
  "גילה": [
    { id: "e-g-1", first: "יוסף",  last: "ברקוביץ", phone: "054-9876543", address: "הפלמ\"ח 8",  status: "פעיל", notes: "להתקשר לפני הגעה" },
    { id: "e-g-2", first: "אברהם", last: "כהן",     phone: "053-3334444", address: "מבוא 2",     status: "פעיל", notes: "" },
    { id: "e-g-3", first: "רחל",   last: "לוי",     phone: "052-1112233", address: "הזית 4",     status: "פעיל", notes: "" },
    { id: "e-g-4", first: "דוד",   last: "ביטון",   phone: "050-7778888", address: "האלון 11",   status: "פעיל", notes: "זוג — חבילה אחת" },
    { id: "e-g-5", first: "שרה",   last: "אברהמי",  phone: "052-9990011", address: "הדקל 3",     status: "פעיל", notes: "" },
    { id: "e-g-6", first: "מרדכי", last: "פרץ",     phone: "054-2223344", address: "האורן 17",   status: "פעיל", notes: "מתגורר עם בן" },
  ],
  "בית הכרם": [
    { id: "e-b-1", first: "חנה", last: "שטרן",   phone: "050-1112222", address: "החלוץ 4",   status: "פעיל", notes: "" },
    { id: "e-b-2", first: "משה", last: "פרידמן", phone: "052-4445555", address: "הנרקיס 9",  status: "פעיל", notes: "למסור בבוקר בלבד" },
    { id: "e-b-3", first: "לאה", last: "גולן",   phone: "053-6667777", address: "הצבר 12",   status: "פעיל", notes: "" },
  ],
};

/* All groups that exist globally in the system (master list). */
const ALL_GROUPS_IN_SYSTEM = [
  { id: "g1", name: "חברת חשמל",         type: "ארגון",    members: 12, contact: "נועם לב",   phone: "053-4444444", email: "noam@iec.co.il",      role: "רכז התנדבות", notes: "רכז התנדבות" },
  { id: "g2", name: "בית ספר גילה",      type: "בית ספר",  members: 18, contact: "מר לוי",    phone: "02-6789012",  email: "school@gilo.k12.il",  role: "מורה אחראי",  notes: "מורה אחראי" },
  { id: "g3", name: "כפר הסטודנטים",     type: "סטודנטים", members: 9,  contact: "תמר ברקת",  phone: "050-9988776", email: "tamar@students.org",  role: "רכזת",        notes: "" },
  { id: "g4", name: "מתנדבים עצמאיים",   type: "יחידים",   members: 7,  contact: "—",         phone: "—",           email: "—",                   role: "—",           notes: "ללא ארגון" },
  { id: "g5", name: "קהילת רחביה",       type: "קהילה",    members: 14, contact: "שירה אבני", phone: "052-7654321", email: "shira@rehavia.org",   role: "מתאמת",       notes: "" },
  { id: "g6", name: "תיכון בויאר",       type: "בית ספר",  members: 22, contact: "רונית שפר", phone: "02-5556677",  email: "ronit@boyar.k12.il",  role: "מורה אחראית", notes: "" },
];

/* All volunteers globally, grouped by their group assignment. */
const ALL_VOLUNTEERS_BY_GROUP = {
  g1: [
    { id: "v1", name: "נועם לב",         phone: "053-4444444", email: "noam@iec.co.il",      status: "פעיל", notes: "רכז" },
    { id: "v2", name: "מירב כהן",        phone: "052-1212121", email: "meirav@iec.co.il",    status: "פעיל", notes: "" },
    { id: "v3", name: "אורי דהן",        phone: "054-3232323", email: "uri@iec.co.il",       status: "פעיל", notes: "" },
  ],
  g2: [
    { id: "v4", name: "מר לוי",          phone: "02-6789012",  email: "school@gilo.k12.il",  status: "פעיל", notes: "מורה אחראי" },
    { id: "v5", name: "תלמיד כיתה י׳",   phone: "—",           email: "—",                   status: "פעיל", notes: "תלמיד" },
    { id: "v6", name: "תלמידה כיתה יא׳", phone: "—",           email: "—",                   status: "פעיל", notes: "תלמידה" },
  ],
  g3: [
    { id: "v7", name: "תמר ברקת",        phone: "050-9988776", email: "tamar@students.org",  status: "פעיל", notes: "רכזת" },
    { id: "v8", name: "יונתן שמש",       phone: "054-1239876", email: "yonatan@students.org",status: "פעיל", notes: "" },
  ],
  g4: [
    { id: "v9", name: "רונן אבידן",      phone: "050-5556677", email: "ronen@gmail.com",     status: "פעיל", notes: "" },
  ],
  g5: [
    { id: "v10", name: "שירה אבני",      phone: "052-7654321", email: "shira@rehavia.org",   status: "פעיל", notes: "מתאמת" },
  ],
  g6: [
    { id: "v11", name: "רונית שפר",      phone: "02-5556677",  email: "ronit@boyar.k12.il",  status: "פעיל", notes: "מורה אחראית" },
  ],
};

/* Initial project-scoped attachments (in real app: from project doc). */
const INITIAL_PROJECT_GROUP_IDS = ["g1", "g2"];
const INITIAL_PROJECT_VOLUNTEERS = { g1: ["v1", "v2"], g2: ["v4"] };

/* Manual (non group-derived) partners. */
const MANUAL_PARTNERS = [
  { id: "p1", org: "עיריית ירושלים", contact: "רינת בר", phone: "02-1234567", email: "rinat@jlm.muni.il", role: "מתאמת קהילה" },
];

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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState({ name: "list" });
  const [showAdd, setShowAdd] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ year: "", type: "", status: "", date: "" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getProjects();
        if (!cancelled) setProjects(list);
      } catch (err) {
        console.error("Failed to load projects", err);
        if (!cancelled) setLoadError("טעינת הפרויקטים נכשלה");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleCreateProject = async (data) => {
    const created = await createProject(data);
    setProjects((prev) => [created, ...prev]);
    return created;
  };

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (filters.year && String(p.year) !== filters.year) return false;
      if (filters.type && p.type !== filters.type) return false;
      if (filters.status && p.status !== filters.status) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!`${p.name} ${p.type} ${p.year}`.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [search, filters, projects]);

  if (view.name === "project") {
    return (
      <ProjectDetail
        project={view.project}
        onBack={() => setView({ name: "list" })}
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
    return <GroupsListView onBack={() => setView({ name: "list" })} />;
  }

  const upcoming = [...projects]
    .filter((p) => p.status !== "הסתיים" && p.status !== "בוטל")
    .sort((a, b) => a.year - b.year)[0];

  return (
    <AdminLayout
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
        <StatsCard icon="👵" title="אזרחים ותיקים בפרויקט" value="420" />
        <StatsCard icon="🎁" title="כמות חבילות" value="242" />
        <StatsCard icon="📦" title="נמסרו" value="95" />
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
            ]}
            data={filtered}
          />
        )}
      </SectionCard>

      {showAdd && <AddProjectModal onClose={() => setShowAdd(false)} onSave={handleCreateProject} />}
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
    </AdminLayout>
  );
}

/* ============================================================
   Groups list view (entry from main page button)
============================================================ */

function GroupsListView({ onBack }) {
  const [group, setGroup] = useState(null);
  return (
    <AdminLayout title="רשימות לפי קבוצות" subtitle="קבוצות מתנדבים במערכת">
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
            data={ALL_GROUPS_IN_SYSTEM}
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
              data={ALL_VOLUNTEERS_BY_GROUP[group.id] || []}
            />
          </SectionCard>
        </>
      )}
    </AdminLayout>
  );
}

/* ============================================================
   Project Detail
============================================================ */

function ProjectDetail({ project, onBack, onUpdate }) {
  const [tab, setTab] = useState("dist");
  const [neighborhood, setNeighborhood] = useState(null);
  const [group, setGroup] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [elderlyByNeighborhood, setElderlyByNeighborhood] = useState({});
  const [elderlyLoading, setElderlyLoading] = useState(true);

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
        // Assign sequential row numbers per neighborhood for display.
        Object.keys(grouped).forEach((k) => {
          grouped[k] = grouped[k].map((e, i) => ({ ...e, n: i + 1 }));
        });
        // Seed neighborhoods that exist in the project but have no participants yet,
        // so the neighborhood view still shows an empty list rather than nothing.
        NEIGHBORHOODS_IN_PROJECT.forEach((n) => {
          if (!grouped[n.name]) grouped[n.name] = [];
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

  const projectGroups = useMemo(
    () => ALL_GROUPS_IN_SYSTEM.filter((g) => projectGroupIds.includes(g.id))
      .map((g) => ({ ...g, members: (projectVolunteers[g.id] || []).length })),
    [projectGroupIds, projectVolunteers]
  );

  const addGroupsToProject = async (ids) => {
    const newIds = ids.filter((id) => !projectGroupIds.includes(id));
    if (newIds.length === 0) return;
    setProjectGroupIds((prev) => Array.from(new Set([...prev, ...newIds])));
    setProjectVolunteers((prev) => {
      const next = { ...prev };
      newIds.forEach((id) => { if (!next[id]) next[id] = []; });
      return next;
    });
    try { await addProjectGroups(project.id, newIds); }
    catch (err) { console.error("Failed to add project groups", err); }
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
    if (!confirm("להסיר את המתנדב מהפרויקט? (המתנדב לא יימחק מהמערכת ולא מהקבוצה)")) return;
    const next = (projectVolunteers[gid] || []).filter((v) => v !== vid);
    setProjectVolunteers((prev) => ({ ...prev, [gid]: next }));
    try { await setProjectGroupVolunteers(project.id, gid, next); }
    catch (err) { console.error("Failed to update volunteers", err); }
  };


  // Partners auto-derived from project groups (deduped by group id) + manual partners
  const partners = useMemo(() => {
    const fromGroups = projectGroups
      .filter((g) => g.contact && g.contact !== "—")
      .map((g) => ({
        id: `grp-${g.id}`,
        groupId: g.id,
        org: g.name,
        contact: g.contact,
        phone: g.phone,
        email: g.email,
        role: g.role || g.notes || "",
        source: "קבוצה",
      }));
    return [...fromGroups, ...MANUAL_PARTNERS.map((p) => ({ ...p, source: "ידני" }))];
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
    const master = ALL_ELDERLY_BY_NEIGHBORHOOD[neighName] || [];
    const existingIds = new Set(current.map((e) => e.id));
    const newOnes = master
      .filter((m) => ids.includes(m.id) && !existingIds.has(m.id))
      .map((m) => ({
        elderlyId: m.id,
        neighborhood: neighName,
        first: m.first,
        last: m.last,
        phone: m.phone,
        address: m.address,
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


  return (
    <AdminLayout
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
        <StatsCard icon="👵" title="אזרחים ותיקים" value={project.elderly} />
        <StatsCard icon="🎁" title="כמות חבילות"   value={project.packages} />
        <StatsCard icon="📦" title="נמסרו"          value={project.delivered} />
        <StatsCard icon="📝" title="הערות מיוחדות" value={project.notes} />
      </div>

      <div className="tabs">
        <button className={tab === "dist" ? "active" : ""}     onClick={() => { setTab("dist");     setNeighborhood(null); }}>ניהול חלוקה</button>
        <button className={tab === "groups" ? "active" : ""}   onClick={() => { setTab("groups");   setGroup(null); }}>רשימות לפי קבוצות</button>
        <button className={tab === "partners" ? "active" : ""} onClick={() => setTab("partners")}>שותפים ואנשי קשר</button>
      </div>

      {tab === "dist" && !neighborhood && (
        <SectionCard title="ניהול חלוקה לפי שכונות">
          <DataTable
            columns={[
              { key: "name", label: "שכונה", render: (r) => (
                <button className="cell-link" onClick={() => setNeighborhood(r)}>{r.name}</button>
              )},
              { key: "elderly",   label: "אזרחים ותיקים" },
              { key: "packages",  label: "כמות חבילות" },
              { key: "delivered", label: "נמסרו" },
              { key: "notes",     label: "הערות מיוחדות" },
            ]}
            data={NEIGHBORHOODS_IN_PROJECT}
          />
        </SectionCard>
      )}

      {tab === "dist" && neighborhood && (
        <>
          <button className="back-link" onClick={() => setNeighborhood(null)}>→ חזרה לרשימת השכונות</button>
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
                { key: "receives", label: "מקבל חבילה", render: (r) => (
                  <select
                    className="inline-select"
                    value={r.receives}
                    onChange={(e) => updateElderly(neighborhood.name, r.id, { receives: e.target.value })}
                  >
                    <option value="כן">כן</option>
                    <option value="לא">לא</option>
                  </select>
                )},
                { key: "delivery", label: "סטטוס מסירה", render: (r) => (
                  <select
                    className="inline-select"
                    value={r.delivery}
                    onChange={(e) => updateElderly(neighborhood.name, r.id, { delivery: e.target.value })}
                  >
                    <option value="נמסר">נמסר</option>
                    <option value="ממתין למסירה">ממתין למסירה</option>
                    <option value="לא נמסר">לא נמסר</option>
                  </select>
                )},
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
      )}

      {tab === "groups" && !group && (
        <SectionCard
          title="קבוצות מתנדבים בפרויקט"
          actions={<button className="btn btn-primary" onClick={() => setShowAddGroup(true)}>+ הוספת קבוצה לפרויקט</button>}
        >
          <DataTable
            columns={[
              { key: "name", label: "שם הקבוצה", render: (r) => (
                <button className="cell-link" onClick={() => setGroup(r)}>{r.name}</button>
              )},
              { key: "type",    label: "סוג קבוצה" },
              { key: "members", label: "מספר מתנדבים" },
              { key: "notes",   label: "הערות" },
              { key: "remove",  label: "", render: (r) => (
                <button className="btn-link btn-danger" onClick={() => removeGroupFromProject(r.id)}>הסר מהפרויקט</button>
              )},
            ]}
            data={projectGroups}
          />
        </SectionCard>
      )}

      {tab === "groups" && group && (() => {
        const selectedIds = projectVolunteers[group.id] || [];
        const rows = (ALL_VOLUNTEERS_BY_GROUP[group.id] || []).filter((v) => selectedIds.includes(v.id));
        return (
          <>
            <button className="back-link" onClick={() => setGroup(null)}>→ חזרה לרשימת הקבוצות</button>
            <SectionCard
              title={`מתנדבים בקבוצה: ${group.name}`}
              actions={<button className="btn btn-primary" onClick={() => setShowAddVolunteer(true)}>+ הוספת מתנדב לפרויקט</button>}
            >
              <DataTable
                columns={[
                  { key: "name",   label: "שם מתנדב" },
                  { key: "phone",  label: "טלפון" },
                  { key: "email",  label: "מייל" },
                  { key: "status", label: "סטטוס בפרויקט", render: (r) => <span className="badge badge-green">{r.status}</span> },
                  { key: "notes",  label: "הערות" },
                  { key: "remove", label: "", render: (r) => (
                    <button className="btn-link btn-danger" onClick={() => removeVolunteerFromGroup(group.id, r.id)}>הסרת מתנדב מהפרויקט</button>
                  )},
                ]}
                data={rows}
              />
            </SectionCard>
            {showAddVolunteer && (
              <SelectVolunteersModal
                group={group}
                excludeIds={selectedIds}
                onClose={() => setShowAddVolunteer(false)}
                onAdd={(ids) => { addVolunteersToGroup(group.id, ids); setShowAddVolunteer(false); }}
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
                  ? <button className="cell-link" onClick={() => setPartnerGroup(ALL_GROUPS_IN_SYSTEM.find((g) => g.id === r.groupId))}>{r.org}</button>
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
        <GroupProfileModal group={partnerGroup} onClose={() => setPartnerGroup(null)} />
      )}

      {elderlyProfile && (
        <ElderlyProfileModal elderly={elderlyProfile} onClose={() => setElderlyProfile(null)} />
      )}

      {showAddGroup && (
        <SelectGroupsModal
          excludeIds={projectGroupIds}
          onClose={() => setShowAddGroup(false)}
          onAdd={(ids) => { addGroupsToProject(ids); setShowAddGroup(false); }}
        />
      )}

      {showEdit && (
        <EditProjectModal
          project={project}
          onClose={() => setShowEdit(false)}
          onSave={(updated) => { onUpdate(updated); setShowEdit(false); }}
        />
      )}
    </AdminLayout>
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

function AddProjectModal({ onClose, onSave }) {
  const allNeighborhoods = NEIGHBORHOODS_IN_PROJECT.map((n) => n.name);
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

  const filteredGroups = ALL_GROUPS_IN_SYSTEM.filter((g) =>
    g.name.toLowerCase().includes(groupSearch.toLowerCase())
  );
  const selectedGroupObjs = ALL_GROUPS_IN_SYSTEM.filter((g) => selectedGroups.includes(g.id));

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
                        <span className="ms-sub">{g.type} • {g.members} מתנדבים</span>
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

function SelectGroupsModal({ excludeIds = [], onClose, onAdd }) {
  const available = ALL_GROUPS_IN_SYSTEM.filter((g) => !excludeIds.includes(g.id));
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
                      <td>{g.members}</td>
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

function SelectVolunteersModal({ group, excludeIds = [], onClose, onAdd }) {
  const available = (ALL_VOLUNTEERS_BY_GROUP[group.id] || []).filter(
    (v) => !excludeIds.includes(v.id)
  );
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
                      <td>{v.name}</td>
                      <td>{v.phone}</td>
                      <td>{v.email}</td>
                      <td><span className="badge badge-green">{v.status}</span></td>
                      <td>{v.notes}</td>
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

function SelectElderlyModal({ neighborhood, excludeIds = [], onClose, onAdd }) {
  const available = (ALL_ELDERLY_BY_NEIGHBORHOOD[neighborhood] || []).filter(
    (e) => !excludeIds.includes(e.id)
  );
  const [selected, setSelected] = useState([]);
  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

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
              כל האזרחים הוותיקים בשכונה זו כבר נכללים בפרויקט
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
                      <td>{e.first} {e.last}</td>
                      <td>{e.phone}</td>
                      <td>{e.address}</td>
                      <td>{neighborhood}</td>
                      <td><span className="badge badge-green">{e.status}</span></td>
                      <td>{e.notes}</td>
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

function GroupProfileModal({ group, onClose }) {
  const volunteers = ALL_VOLUNTEERS_BY_GROUP[group.id] || [];
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
            <div className="item"><label>איש קשר</label><div>{group.contact}</div></div>
            <div className="item"><label>טלפון</label><div>{group.phone}</div></div>
            <div className="item"><label>מייל</label><div>{group.email}</div></div>
            <div className="item"><label>תפקיד</label><div>{group.role}</div></div>
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
                    <td>{v.name}</td>
                    <td>{v.phone}</td>
                    <td>{v.email}</td>
                    <td><span className="badge badge-green">{v.status}</span></td>
                    <td>{v.notes}</td>
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
