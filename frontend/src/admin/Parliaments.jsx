import { useEffect, useMemo, useState } from "react";
import AdminPageLayout from "@/components/admin/AdminPageLayout.jsx";
import parliamentsHero from "@/assets/parliaments-hero.png";
import StatsCard from "@/components/admin/StatsCard.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import DataTable from "@/components/admin/DataTable.jsx";
import {
  getParliaments,
  createParliament,
  editParliament,
  deleteParliament,
  addParticipant,
  getParticipants,
  updateParticipantAttendance,
  removeParticipant,
  getMeetings,
  addMeeting,
  updateMeeting,
  deleteMeeting,
  getMeetingAttendance,
  upsertMeetingAttendance,
  getMeetingExpenses,
  addMeetingExpense,
  updateMeetingExpense,
  deleteMeetingExpense,
} from "@/services/parliamentsService.js";
import { getElderly } from "@/services/elderlyService.js";
import { getVolunteers } from "@/services/volunteersService.js";
import { getAreaNames } from "@/services/settingsService.js";
import { sanitizeFormData } from "@/utils/sanitize";


/* ===== Static options ===== */
const STATUS_OPTIONS = ["פעיל", "בהכנה", "הסתיים"];
const LOCATION_OPTIONS = [
  "מרכז קהילתי רחביה",
  'מתנ"ס גילה',
  "בית הכנסת המרכזי",
  "מועדון קטמון",
  'מתנ"ס פסגת זאב',
  "מרכז יום לקשיש",
  "בית הספר היסודי",
];
const PLACEMENT_OPTIONS = ["קבוע", "זמני", "אורח"];

const statusBadge = (s) =>
  s === "פעיל" ? "badge-green" : s === "בהכנה" ? "badge-orange" : "badge-gray";

function isThisWeek(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return d >= start && d < end;
}




/* =================== Main page =================== */
export default function Parliaments() {
  const [parliaments, setParliaments] = useState([]);
  const [participantsMap, setParticipantsMap] = useState({});
  const [nextMeetingMap, setNextMeetingMap] = useState({}); // pid -> "YYYY-MM-DD" of next upcoming meeting
  const [selectedId, setSelectedId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [loadError, setLoadError] = useState("");

  // Dynamic options sourced from other pages
  const [areaOptions, setAreaOptions] = useState([]);
  const [volunteerOptions, setVolunteerOptions] = useState([]);

  // Search + filters for the main table
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    area: "",
    status: "",
    dateFrom: "",
    dateTo: "",
  });

  // Sorting: default by שם פרלמנט asc
  const [sort, setSort] = useState({ key: "name", dir: "asc" });

  useEffect(() => {
    (async () => {
      try {
        const list = await getParliaments();
        setParliaments(list || []);
        // Load participants + meetings for every parliament so counts/nextDate are live
        const today = new Date().toISOString().slice(0, 10);
        const pMap = {};
        const nMap = {};
        await Promise.all(
          (list || []).map(async (p) => {
            try {
              const [parts, meets] = await Promise.all([
                getParticipants(p.id).catch(() => []),
                getMeetings(p.id).catch(() => []),
              ]);
              pMap[p.id] = parts;
              const upcoming = meets
                .filter((m) => m.date && m.date >= today)
                .sort((a, b) => String(a.date).localeCompare(String(b.date))
                  || String(a.startTime || "").localeCompare(String(b.startTime || "")));
              nMap[p.id] = upcoming.length ? upcoming[0].date : "";
            } catch { /* ignore */ }
          }),
        );
        setParticipantsMap(pMap);
        setNextMeetingMap(nMap);
      } catch (err) {
        console.warn("Failed to load parliaments:", err);
        setLoadError("טעינת הנתונים מהשרת נכשלה.");
      }
    })();

    (async () => {
      try {
        const names = await getAreaNames();
        setAreaOptions(names);
      } catch (e) { console.warn("areas load failed", e); }
    })();

    (async () => {
      try {
        const vols = await getVolunteers();
        const names = (vols || [])
          .map((v) => v.name || `${v.firstName || ""} ${v.lastName || ""}`.trim())
          .filter(Boolean);
        setVolunteerOptions(Array.from(new Set(names)));
      } catch (e) { console.warn("volunteers load failed", e); }
    })();
  }, []);

  const setParticipantsFor = (pid, updater) => {
    setParticipantsMap((prev) => {
      const current = prev[pid] || [];
      const next = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, [pid]: next };
    });
  };

  /* ===== Handlers ===== */
  const handleCreateParliament = async (data) => {
    const payload = sanitizeFormData(data);
    try {
      const saved = await createParliament(payload);
      setParliaments((prev) => [...prev, saved]);
    } catch (err) {
      console.warn("createParliament failed:", err);
      setParliaments((prev) => [...prev, { ...payload, id: Date.now() }]);
    }
    setShowAdd(false);
  };

  const handleEditParliament = async (id, data) => {
    try { await editParliament(id, data); }
    catch (err) { console.warn("editParliament failed:", err); }
    setParliaments((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
  };

  const handleDeleteParliament = async (parl) => {
    if (!window.confirm(`למחוק את "${parl.name}"? לא ניתן לשחזר פעולה זו.`)) return;
    try { await deleteParliament(parl.id); }
    catch (err) { console.warn("deleteParliament failed:", err); }
    setParliaments((prev) => prev.filter((p) => p.id !== parl.id));
    setSelectedId(null);
  };

  /* ===== Derived data ===== */
  const decorated = useMemo(() => {
    return parliaments.map((p) => ({
      ...p,
      members: (participantsMap[p.id] || []).length,
      nextDate: nextMeetingMap[p.id] || "",
    }));
  }, [parliaments, participantsMap, nextMeetingMap]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return decorated.filter((p) => {
      if (filters.area && p.area !== filters.area) return false;
      if (filters.status && p.status !== filters.status) return false;
      if (filters.dateFrom && p.nextDate && p.nextDate < filters.dateFrom) return false;
      if (filters.dateTo && p.nextDate && p.nextDate > filters.dateTo) return false;
      if (q) {
        const hay = [
          p.name, p.location, p.area, p.status, p.nextDate, p.notes,
          ...(p.coordinators || []),
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [decorated, filters, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const { key, dir } = sort;
    const mul = dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let av, bv;
      if (key === "coordinator") { av = (a.coordinators || []).join(", "); bv = (b.coordinators || []).join(", "); }
      else if (key === "members") { av = Number(a.members) || 0; bv = Number(b.members) || 0; }
      else { av = a[key] ?? ""; bv = b[key] ?? ""; }
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * mul;
      return String(av).localeCompare(String(bv), "he") * mul;
    });
    return arr;
  }, [filtered, sort]);

  const toggleSort = (key) => {
    setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  };
  const sortArrow = (key) => {
    if (sort.key !== key) return " ↕";
    return sort.dir === "asc" ? " ↑" : " ↓";
  };
  const sortableHeader = (key, label) => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      style={{ background: "none", border: "none", cursor: "pointer", font: "inherit", color: "inherit", padding: 0 }}
    >
      {label}{sortArrow(key)}
    </button>
  );

  const selected = parliaments.find((p) => p.id === selectedId) || null;

  if (selected) {
    return (
      <ParliamentDetail
        parl={selected}
        allParliaments={parliaments}
        participants={participantsMap[selected.id] || []}
        setParticipants={(updater) => setParticipantsFor(selected.id, updater)}
        onBack={() => setSelectedId(null)}
        onEdit={(data) => handleEditParliament(selected.id, data)}
        onDelete={() => handleDeleteParliament(selected)}
        areaOptions={areaOptions}
        volunteerOptions={volunteerOptions}
      />
    );
  }

  const active = decorated.filter((p) => p.status === "פעיל").length;
  const thisWeek = decorated.filter((p) => isThisWeek(p.nextDate)).length;
  const totalParticipants = decorated.reduce((s, p) => s + (p.members || 0), 0);
  const existingNames = decorated.map((p) => p.name);

  const filterLabelStyle = { fontSize: 12, color: "var(--color-text-muted, #6b7280)", marginBottom: 4, display: "block" };

  return (
    <AdminPageLayout heroImage={parliamentsHero}
      title="פרלמנטים"
      subtitle="ניהול מפגשי פרלמנט, משתתפים ונוכחות"
      actions={
        <>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ הוספת פרלמנט</button>
          <button className="btn" onClick={() => setShowPrint(true)}>הדפסת רשימה</button>
        </>
      }
    >
      {loadError && <div className="form-warning">{loadError}</div>}

      <div className="stats-grid">
        <StatsCard icon="🏛️" title="פרלמנטים פעילים" value={String(active)} />
        <StatsCard icon="📅" title="פרלמנטים השבוע" value={String(thisWeek)} />
        <StatsCard icon="👥" title="משתתפים רשומים" value={String(totalParticipants)} />
        <StatsCard icon="📊" title='סה"כ פרלמנטים' value={String(decorated.length)} />
      </div>

      <SectionCard title="רשימת פרלמנטים">
        <div className="search-filter-panel">
          <div className="search-input-wrapper">
            <input
              className="search-input"
              placeholder="חיפוש לפי שם פרלמנט, מיקום, מלווה..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="filters-row" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
            <label>
              <span style={filterLabelStyle}>אזור</span>
              <select className="filter-pill" value={filters.area} onChange={(e) => setFilters({ ...filters, area: e.target.value })}>
                <option value="">הכל</option>
                {areaOptions.map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
            <label>
              <span style={filterLabelStyle}>סטטוס</span>
              <select className="filter-pill" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                <option value="">הכל</option>
                {STATUS_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
            <label>
              <span style={filterLabelStyle}>מתאריך</span>
              <input type="date" className="filter-pill" value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
            </label>
            <label>
              <span style={filterLabelStyle}>עד תאריך</span>
              <input type="date" className="filter-pill" value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
            </label>
            {(search || filters.area || filters.status || filters.dateFrom || filters.dateTo) && (
              <button className="filter-pill" onClick={() => { setSearch(""); setFilters({ area: "", status: "", dateFrom: "", dateTo: "" }); }}>נקה</button>
            )}
          </div>
          {filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo && (
            <div className="form-warning">תאריך "מתאריך" חייב להיות מוקדם או שווה ל"עד תאריך".</div>
          )}
        </div>

        <DataTable
          columns={[
            {
              key: "name",
              label: sortableHeader("name", "שם פרלמנט"),
              render: (r) => (
                <button className="link-btn" onClick={() => setSelectedId(r.id)}>
                  {r.name}
                </button>
              ),
            },
            { key: "nextDate", label: sortableHeader("nextDate", "מפגש הבא"), render: (r) => r.nextDate || "—" },
            { key: "area", label: sortableHeader("area", "אזור") },
            { key: "location", label: sortableHeader("location", "מיקום") },
            { key: "coordinator", label: sortableHeader("coordinator", "מלווה"), render: (r) => (r.coordinators || []).join(", ") },
            { key: "members", label: sortableHeader("members", "משתתפים") },
            { key: "status", label: sortableHeader("status", "סטטוס"), render: (r) => <span className={`badge ${statusBadge(r.status)}`}>{r.status}</span> },
          ]}
          data={sorted}
        />
      </SectionCard>


      {showAdd && (
        <ParliamentFormModal
          title="הוספת פרלמנט"
          existingNames={existingNames}
          onClose={() => setShowAdd(false)}
          onSave={handleCreateParliament}
          areaOptions={areaOptions}
          volunteerOptions={volunteerOptions}
        />
      )}
      {showPrint && (
        <PrintReportModal
          parliaments={decorated}
          onClose={() => setShowPrint(false)}
          areaOptions={areaOptions}
        />
      )}
    </AdminPageLayout>
  );
}

/* =================== Parliament Detail =================== */
function ParliamentDetail({ parl, allParliaments, participants, setParticipants, onBack, onEdit, onDelete, areaOptions, volunteerOptions }) {
  const [tab, setTab] = useState("participants");
  const [showEdit, setShowEdit] = useState(false);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [openParticipantInfo, setOpenParticipantInfo] = useState(null);
  const [elderlyList, setElderlyList] = useState([]);

  // Meetings state
  const [meetings, setMeetings] = useState([]);
  const [showAddMeeting, setShowAddMeeting] = useState(false);
  const [editMeeting, setEditMeeting] = useState(null);
  const [openMeeting, setOpenMeeting] = useState(null);
  const [meetingArrived, setMeetingArrived] = useState({});
  const [meetingExpenseTotal, setMeetingExpenseTotal] = useState({});

  // Load participants + elderly on mount
  useEffect(() => {
    (async () => {
      try {
        const parts = await getParticipants(parl.id);
        if (parts && parts.length) setParticipants(parts);
      } catch (e) { console.warn("Failed to load participants:", e); }
    })();
    (async () => {
      try { setElderlyList(await getElderly()); }
      catch (e) { console.warn("elderly load failed", e); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parl.id]);

  // Load meetings + per-meeting aggregates from Firestore.
  const refreshMeetings = async () => {
    try {
      const list = await getMeetings(parl.id);
      setMeetings(list);
      const arrived = {};
      const expTotals = {};
      await Promise.all(list.map(async (m) => {
        try {
          const [att, exps] = await Promise.all([
            getMeetingAttendance(parl.id, m.id),
            getMeetingExpenses(parl.id, m.id),
          ]);
          arrived[m.id] = att.filter((a) => a.arrived === "כן").length;
          expTotals[m.id] = exps.reduce((s, e) => s + (Number(e.amount) || 0), 0);
        } catch (e) { console.warn("meeting agg failed", e); }
      }));
      setMeetingArrived(arrived);
      setMeetingExpenseTotal(expTotals);
    } catch (e) { console.warn("Failed to load meetings:", e); }
  };
  useEffect(() => { refreshMeetings(); /* eslint-disable-next-line */ }, [parl.id]);

  // Look up an elderly record for a participant (by id or by name).
  const matchElderly = (p) => {
    let match = null;
    if (p.elderlyId) match = elderlyList.find((e) => String(e.id) === String(p.elderlyId));
    if (!match) {
      const fn = (p.firstName || "").trim();
      const ln = (p.lastName || "").trim();
      match = elderlyList.find((e) =>
        (e.firstName || "").trim() === fn && (e.lastName || "").trim() === ln,
      );
    }
    return match;
  };
  const phoneFor = (p) => {
    const m = matchElderly(p);
    return (m && (m.mobile || m.homePhone)) || p.phone || "—";
  };
  const homePhoneFor = (p) => {
    const m = matchElderly(p);
    return (m && m.homePhone) || "—";
  };

  const sortedParticipants = useMemo(
    () => [...participants].sort((a, b) =>
      `${a.firstName || ""} ${a.lastName || ""}`.localeCompare(`${b.firstName || ""} ${b.lastName || ""}`, "he"),
    ),
    [participants],
  );

  const sortedMeetings = useMemo(
    () => [...meetings].sort((a, b) => {
      const d = String(a.date || "").localeCompare(String(b.date || ""));
      if (d !== 0) return d;
      return String(a.startTime || "").localeCompare(String(b.startTime || ""));
    }),
    [meetings],
  );

  const meetingsHeld = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return sortedMeetings.filter((m) => m.date && m.date <= today).length;
  }, [sortedMeetings]);

  const expensesTotalAll = useMemo(
    () => sortedMeetings.reduce((s, m) => s + (meetingExpenseTotal[m.id] || 0), 0),
    [sortedMeetings, meetingExpenseTotal],
  );

  const existingNames = allParliaments.filter((p) => p.id !== parl.id).map((p) => p.name);

  const handleAddParticipants = async (chosenIds) => {
    const saved = [];
    for (const id of chosenIds) {
      const chosen = elderlyList.find((e) => String(e.id) === String(id));
      if (!chosen) continue;
      const payload = {
        firstName: chosen.firstName || "",
        lastName: chosen.lastName || "",
        elderlyId: chosen.id,
        phone: chosen.mobile || chosen.homePhone || chosen.phone || "",
        address: chosen.address || "",
        neigh: chosen.neighborhood || "",
        area: chosen.area || "",
        type: "קבוע",
      };
      try {
        const s = await addParticipant(parl.id, payload);
        saved.push({ ...payload, id: s.id });
      } catch (err) {
        console.warn("addParticipant failed:", err);
        saved.push({ ...payload, id: `tmp-${Date.now()}-${Math.random()}` });
      }
    }
    setParticipants((prev) => [...prev, ...saved]);
    setShowAddParticipant(false);
  };

  const handleRemoveParticipant = async (p) => {
    if (!window.confirm(`להסיר את ${p.firstName} ${p.lastName} מהפרלמנט?`)) return;
    try { await removeParticipant(parl.id, p.id); }
    catch (e) { console.warn("removeParticipant failed:", e); }
    setParticipants((prev) => prev.filter((x) => x.id !== p.id));
  };

  const handleAddMeeting = async (data) => {
    try {
      const saved = await addMeeting(parl.id, data);
      setMeetings((prev) => [...prev, saved]);
      setMeetingArrived((prev) => ({ ...prev, [saved.id]: 0 }));
      setMeetingExpenseTotal((prev) => ({ ...prev, [saved.id]: 0 }));
    } catch (e) { console.warn("addMeeting failed:", e); }
    setShowAddMeeting(false);
  };
  const handleUpdateMeeting = async (id, data) => {
    try { await updateMeeting(parl.id, id, data); }
    catch (e) { console.warn("updateMeeting failed:", e); }
    setMeetings((prev) => prev.map((m) => (m.id === id ? { ...m, ...data } : m)));
    setEditMeeting(null);
  };
  const handleDeleteMeeting = async (m) => {
    if (!window.confirm(`למחוק את הפגישה בתאריך ${m.date || ""}?`)) return;
    try { await deleteMeeting(parl.id, m.id); }
    catch (e) { console.warn("deleteMeeting failed:", e); }
    setMeetings((prev) => prev.filter((x) => x.id !== m.id));
    setEditMeeting(null);
  };

  if (openMeeting) {
    return (
      <MeetingDetailView
        parl={parl}
        meeting={openMeeting}
        meetingNumber={sortedMeetings.findIndex((m) => m.id === openMeeting.id) + 1}
        participants={sortedParticipants}
        phoneFor={phoneFor}
        homePhoneFor={homePhoneFor}
        onBack={() => { refreshMeetings(); setOpenMeeting(null); }}
      />
    );
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingMeeting = sortedMeetings.find((m) => m.date && m.date >= todayStr);
  const nextDateLabel = upcomingMeeting ? upcomingMeeting.date : "—";

  return (
    <AdminPageLayout heroImage={parliamentsHero}
      title={parl.name}
      subtitle={`${parl.location} • מפגש הבא: ${nextDateLabel}`}
      actions={<button className="btn btn-primary" onClick={() => setShowEdit(true)}>עריכת פרטים</button>}
    >
      <button className="back-link" onClick={onBack}>→ חזרה לפרלמנטים</button>

      <div className="stats-grid">
        <StatsCard icon="👥" title="משתתפים" value={String(sortedParticipants.length)} />
        <StatsCard icon="📅" title="פגישות שהתקיימו" value={`${meetingsHeld} מתוך ${sortedMeetings.length}`} />
        <StatsCard icon="💰" title="סכום הוצאות" value={`${expensesTotalAll.toLocaleString()} ₪`} />
      </div>

      <div className="tabs">
        <button className={tab === "participants" ? "active" : ""} onClick={() => setTab("participants")}>רשימת משתתפים</button>
        <button className={tab === "meetings" ? "active" : ""} onClick={() => setTab("meetings")}>רשימת הפגישות</button>
      </div>

      {tab === "participants" && (
        <SectionCard
          title="רשימת משתתפים"
          actions={<button className="btn btn-primary" onClick={() => setShowAddParticipant(true)}>+ הוספת משתתפים</button>}
        >
          <DataTable
            columns={[
              { key: "name", label: "שם", render: (r) => (
                <button className="cell-link" onClick={() => setOpenParticipantInfo(r)}>
                  {r.firstName} {r.lastName}
                </button>
              )},
              { key: "phone", label: "טלפון", render: (r) => phoneFor(r) },
              { key: "address", label: "כתובת" },
              { key: "neigh", label: "שכונה" },
              { key: "area", label: "אזור" },
              { key: "type", label: "סוג שיבוץ" },
              { key: "remove", label: "", render: (r) => (
                <button className="btn-link btn-danger" onClick={() => handleRemoveParticipant(r)}>הסר מהפרלמנט</button>
              )},
            ]}
            data={sortedParticipants}
          />
        </SectionCard>
      )}

      {tab === "meetings" && (
        <SectionCard
          title="רשימת הפגישות"
          actions={<button className="btn btn-primary" onClick={() => setShowAddMeeting(true)}>+ הוספת פגישה</button>}
        >
          <DataTable
            columns={[
              { key: "num", label: "מס׳ הפגישה", render: (r) => (
                <button className="cell-link" onClick={() => setOpenMeeting(r)}>
                  פגישה {sortedMeetings.findIndex((m) => m.id === r.id) + 1}
                </button>
              )},
              { key: "date", label: "תאריך הפגישה", render: (r) => r.date || "—" },
              { key: "startTime", label: "זמן התחילה", render: (r) => r.startTime || "—" },
              { key: "location", label: "מיקום הפגישה", render: (r) => r.location || "—" },
              { key: "arrived", label: "הגיעו לפגישה", render: (r) => String(meetingArrived[r.id] ?? 0) },
              { key: "expenses", label: "סכום ההוצאות", render: (r) => `${(meetingExpenseTotal[r.id] ?? 0).toLocaleString()} ₪` },
              { key: "notes", label: "הערות", render: (r) => r.notes || "" },
              { key: "edit", label: "", render: (r) => (
                <button className="btn-link" onClick={() => setEditMeeting(r)}>עריכה</button>
              )},
            ]}
            data={sortedMeetings}
          />
        </SectionCard>
      )}

      {showEdit && (
        <ParliamentFormModal
          title="עריכת פרטי פרלמנט"
          initial={parl}
          existingNames={existingNames}
          onClose={() => setShowEdit(false)}
          onSave={async (data) => { await onEdit(data); setShowEdit(false); }}
          onDelete={async () => { await onDelete(); setShowEdit(false); }}
          areaOptions={areaOptions}
          volunteerOptions={volunteerOptions}
        />
      )}

      {openParticipantInfo && (
        <ParticipantInfoModal
          participant={openParticipantInfo}
          mobile={phoneFor(openParticipantInfo)}
          homePhone={homePhoneFor(openParticipantInfo)}
          onClose={() => setOpenParticipantInfo(null)}
        />
      )}

      {showAddParticipant && (
        <AddParticipantModal
          elderlyList={elderlyList}
          excludeIds={participants.map((p) => String(p.elderlyId))}
          onClose={() => setShowAddParticipant(false)}
          onSave={handleAddParticipants}
        />
      )}

      {showAddMeeting && (
        <MeetingFormModal
          title="הוספת פגישה"
          onClose={() => setShowAddMeeting(false)}
          onSave={handleAddMeeting}
        />
      )}

      {editMeeting && (
        <MeetingFormModal
          title="עריכת פגישה"
          initial={editMeeting}
          onClose={() => setEditMeeting(null)}
          onSave={(data) => handleUpdateMeeting(editMeeting.id, data)}
          onDelete={() => handleDeleteMeeting(editMeeting)}
        />
      )}
    </AdminPageLayout>
  );
}

/* =================== Meeting Detail View (drill-down) =================== */
function MeetingDetailView({ parl, meeting, meetingNumber, participants, phoneFor, homePhoneFor, onBack }) {
  const [subTab, setSubTab] = useState("attendance");
  const [attendance, setAttendance] = useState({}); // participantId -> { called, confirmed, arrived, notes }
  const [expenses, setExpenses] = useState([]);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [notesEditing, setNotesEditing] = useState(null); // participant for inline notes
  const [openName, setOpenName] = useState(null); // participant to show name+phone modal

  // Load attendance + expenses for THIS meeting
  useEffect(() => {
    (async () => {
      try {
        const list = await getMeetingAttendance(parl.id, meeting.id);
        const map = {};
        list.forEach((a) => { map[a.id] = a; });
        setAttendance(map);
      } catch (e) { console.warn("attendance load failed", e); }
    })();
    (async () => {
      try { setExpenses(await getMeetingExpenses(parl.id, meeting.id)); }
      catch (e) { console.warn("expenses load failed", e); }
    })();
  }, [parl.id, meeting.id]);

  const attFor = (pid) => attendance[pid] || { called: "לא", confirmed: "ממתין", arrived: "—", notes: "" };

  const setAttField = (pid, field, value) => {
    const current = attFor(pid);
    const next = { ...current, [field]: value };
    setAttendance((prev) => ({ ...prev, [pid]: next }));
    upsertMeetingAttendance(parl.id, meeting.id, pid, next).catch((e) =>
      console.warn("attendance save failed", e),
    );
  };

  const confirmed = participants.filter((p) => attFor(p.id).confirmed === "כן").length;
  const notComing = participants.filter((p) => attFor(p.id).confirmed === "לא").length;
  const waiting = participants.length - confirmed - notComing;
  const arrivedCount = participants.filter((p) => attFor(p.id).arrived === "כן").length;
  const expensesTotal = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const sortedExpenses = useMemo(
    () => [...expenses].sort((a, b) => String(a.date || "").localeCompare(String(b.date || ""))),
    [expenses],
  );

  const handleAddExpense = async (data) => {
    try {
      const saved = await addMeetingExpense(parl.id, meeting.id, data);
      setExpenses((prev) => [...prev, saved]);
    } catch (e) { console.warn("addExpense failed", e); }
    setShowAddExpense(false);
  };
  const handleUpdateExpense = async (id, data) => {
    try { await updateMeetingExpense(parl.id, meeting.id, id, data); }
    catch (e) { console.warn("updateExpense failed", e); }
    setExpenses((prev) => prev.map((x) => (x.id === id ? { ...x, ...data } : x)));
    setEditExpense(null);
  };
  const handleDeleteExpense = async (id) => {
    if (!window.confirm("למחוק את ההוצאה?")) return;
    try { await deleteMeetingExpense(parl.id, meeting.id, id); }
    catch (e) { console.warn("deleteExpense failed", e); }
    setExpenses((prev) => prev.filter((x) => x.id !== id));
    setEditExpense(null);
  };

  return (
    <AdminPageLayout heroImage={parliamentsHero}
      title={`${parl.name} — פגישה מס׳ ${meetingNumber}`}
      subtitle={`${meeting.date || ""} ${meeting.startTime ? "• " + meeting.startTime : ""} ${meeting.location ? "• " + meeting.location : ""}`}
    >
      <button className="back-link" onClick={onBack}>→ חזרה לרשימת הפגישות</button>

      <div className="stats-grid">
        <StatsCard icon="✅" title="אישרו הגעה" value={String(confirmed)} />
        <StatsCard icon="❌" title="לא יגיעו" value={String(notComing)} />
        <StatsCard icon="⏳" title="ממתינים לאישור" value={String(waiting)} />
        <StatsCard icon="🚶" title="הגיעו לפגישה" value={String(arrivedCount)} />
        <StatsCard icon="💰" title="הוצאות הפגישה" value={`${expensesTotal.toLocaleString()} ₪`} />
      </div>

      <div className="tabs">
        <button className={subTab === "attendance" ? "active" : ""} onClick={() => setSubTab("attendance")}>נוכחות</button>
        <button className={subTab === "expenses" ? "active" : ""} onClick={() => setSubTab("expenses")}>הוצאות</button>
      </div>

      {subTab === "attendance" && (
        <SectionCard title="נוכחות בפגישה">
          <DataTable
            columns={[
              { key: "name", label: "שם", render: (r) => (
                <button className="cell-link" onClick={() => setOpenName(r)}>{r.firstName} {r.lastName}</button>
              )},
              { key: "called", label: "ניסינו להתקשר", render: (r) => (
                <select className="inline-select" value={attFor(r.id).called}
                  onChange={(e) => setAttField(r.id, "called", e.target.value)}>
                  <option>כן</option><option>לא</option>
                </select>
              )},
              { key: "confirmed", label: "אישר הגעה", render: (r) => (
                <select className="inline-select" value={attFor(r.id).confirmed}
                  onChange={(e) => setAttField(r.id, "confirmed", e.target.value)}>
                  <option>כן</option><option>ממתין</option><option>לא</option>
                </select>
              )},
              { key: "arrived", label: "הגיע בפועל", render: (r) => (
                <select className="inline-select" value={attFor(r.id).arrived}
                  onChange={(e) => setAttField(r.id, "arrived", e.target.value)}>
                  <option>כן</option><option>לא</option><option>—</option>
                </select>
              )},
              { key: "notes", label: "הערות", render: (r) => {
                const note = attFor(r.id).notes || "";
                const has = !!note.trim();
                return (
                  <button
                    className="note-icon-btn"
                    title={has ? "צפייה / עריכת הערה" : "הוספת הערה"}
                    aria-label="הערות"
                    onClick={() => setNotesEditing(r)}
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
            ]}
            data={participants}
          />
        </SectionCard>
      )}

      {subTab === "expenses" && (
        <SectionCard
          title="הוצאות הפגישה"
          actions={<button className="btn btn-primary" onClick={() => setShowAddExpense(true)}>+ הוספת הוצאה</button>}
        >
          <DataTable
            columns={[
              { key: "n", label: "מס׳", render: (r) => r._n },
              { key: "details", label: "פרטי ההוצאה", render: (r) => (
                <button className="cell-link" onClick={() => setEditExpense(r)}>{r.details || "—"}</button>
              )},
              { key: "amount", label: "סכום", render: (r) => `${Number(r.amount || 0).toLocaleString()} ₪` },
              { key: "date", label: "תאריך", render: (r) => r.date || "—" },
            ]}
            data={sortedExpenses.map((e, i) => ({ ...e, _n: i + 1 }))}
          />
        </SectionCard>
      )}

      {notesEditing && (
        <AttendanceNotesModal
          participant={notesEditing}
          initialText={attFor(notesEditing.id).notes || ""}
          onClose={() => setNotesEditing(null)}
          onSave={(text) => { setAttField(notesEditing.id, "notes", text); setNotesEditing(null); }}
        />
      )}

      {openName && (
        <ParticipantPhonesModal
          participant={openName}
          mobile={phoneFor(openName)}
          homePhone={homePhoneFor(openName)}
          onClose={() => setOpenName(null)}
        />
      )}

      {showAddExpense && (
        <ExpenseFormModal
          title="הוספת הוצאה"
          onClose={() => setShowAddExpense(false)}
          onSave={handleAddExpense}
        />
      )}
      {editExpense && (
        <ExpenseFormModal
          title="עריכת הוצאה"
          initial={editExpense}
          onClose={() => setEditExpense(null)}
          onSave={(data) => handleUpdateExpense(editExpense.id, data)}
          onDelete={() => handleDeleteExpense(editExpense.id)}
        />
      )}
    </AdminPageLayout>
  );
}


/* =================== Parliament Form Modal =================== */
const REQUIRED_LABELS = {
  name: "שם פרלמנט",
  location: "מיקום",
  area: "אזור",
  status: "סטטוס",
  coordinators: "מלווה",
};

function ParliamentFormModal({ title, initial, existingNames = [], onClose, onSave, onDelete, areaOptions = [], volunteerOptions = [] }) {
  const [f, setF] = useState(
    initial || {
      name: "",
      location: "",
      area: "",
      coordinators: [""],
      status: "פעיל",
      notes: "",
    },
  );
  const [errors, setErrors] = useState([]);

  const setCoord = (i, val) => {
    const arr = [...(f.coordinators || [])];
    arr[i] = val;
    setF({ ...f, coordinators: arr });
  };
  const addCoord = () => setF({ ...f, coordinators: [...(f.coordinators || []), ""] });
  const removeCoord = (i) =>
    setF({ ...f, coordinators: (f.coordinators || []).filter((_, idx) => idx !== i) });

  const validate = () => {
    const missing = [];
    const trimmed = (v) => (typeof v === "string" ? v.trim() : v);

    if (!trimmed(f.name)) missing.push(REQUIRED_LABELS.name);
    if (!trimmed(f.location)) missing.push(REQUIRED_LABELS.location);
    if (!trimmed(f.area)) missing.push(REQUIRED_LABELS.area);
    if (!trimmed(f.status)) missing.push(REQUIRED_LABELS.status);
    const coords = (f.coordinators || []).map((c) => (c || "").trim()).filter(Boolean);
    if (coords.length === 0) missing.push(REQUIRED_LABELS.coordinators);

    const errs = [];
    if (missing.length) errs.push(`יש למלא את כל השדות החובה: ${missing.join(", ")}`);

    const nameTrim = (f.name || "").trim();
    if (nameTrim && existingNames.some((n) => (n || "").trim() === nameTrim)) {
      errs.push("שם פרלמנט חייב להיות ייחודי — קיים כבר פרלמנט בשם זה.");
    }

    setErrors(errs);
    return errs.length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const payload = {
      ...f,
      coordinators: (f.coordinators || []).map((c) => c.trim()).filter(Boolean),
    };
    onSave(payload);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {errors.length > 0 && (
          <div className="form-warning">
            {errors.map((e, i) => (<div key={i}>• {e}</div>))}
          </div>
        )}

        <div className="row row-2">
          <div className="field">
            <label>שם פרלמנט *</label>
            <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div className="field">
            <label>מיקום *</label>
            <input className="input" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
          </div>
          <div className="field">
            <label>אזור *</label>
            <select className="select" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })}>
              <option value="">בחר אזור</option>
              {areaOptions.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="field">
            <label>סטטוס *</label>
            <select className="select" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              {STATUS_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label>מלווה *</label>
          {(f.coordinators || []).map((c, i) => {
            const otherSelected = (f.coordinators || [])
              .filter((_, idx) => idx !== i)
              .map((x) => (x || "").trim())
              .filter(Boolean);
            const availableOptions = volunteerOptions.filter((v) => !otherSelected.includes(v));
            return (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <select className="select" value={c || ""} onChange={(e) => setCoord(i, e.target.value)}>
                  <option value="">בחר מלווה</option>
                  {availableOptions.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                {(f.coordinators || []).length > 1 && (
                  <button type="button" className="btn" onClick={() => removeCoord(i)}>הסר</button>
                )}
              </div>
            );
          })}
          <button type="button" className="btn" onClick={addCoord}>+ עוד מלווים</button>
        </div>

        <div className="field">
          <label>הערות</label>
          <textarea className="textarea" rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </div>

        <div className="modal-actions" style={{ justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={handleSave}>שמירה</button>
            <button className="btn" onClick={onClose}>ביטול</button>
          </div>
          {onDelete && (
            <button className="btn btn-danger" onClick={onDelete}>מחיקת פרלמנט</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* =================== Participant Profile Modal =================== */
function ParticipantProfileModal({ participant, onClose, onSave }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({
    ...participant,
    called: participant.called || "לא",
    confirmed: participant.confirmed || "ממתין",
    arrived: participant.arrived || "—",
    type: participant.type || PLACEMENT_OPTIONS[0],
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {/* Reversed header: edit button on the title's side, title on the button's side */}
        <div
          className="modal-header"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {!editing && (
              <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>עריכת פרטים</button>
            )}
          </div>
          <h2 style={{ margin: 0 }}>פרופיל אזרח ותיק — {participant.firstName} {participant.lastName}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {!editing ? (
          <>
            <div className="row row-2">
              <div className="field"><label>שם</label><div>{participant.firstName} {participant.lastName}</div></div>
              <div className="field"><label>סוג שיבוץ</label><div>{participant.type || "—"}</div></div>
              <div className="field"><label>ניסינו להתקשר</label><div>{participant.called || "לא"}</div></div>
              <div className="field"><label>אישר הגעה</label><div>{participant.confirmed || "ממתין"}</div></div>
              <div className="field"><label>הגיע בפועל</label><div>{participant.arrived || "—"}</div></div>
              <div className="field"><label>הערות</label><div>{participant.notes || "—"}</div></div>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={onClose}>סגירה</button>
            </div>
          </>
        ) : (
          <>
            <div className="row row-2">
              <div className="field">
                <label>סוג שיבוץ</label>
                <select className="select" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
                  {PLACEMENT_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="field">
                <label>ניסינו להתקשר</label>
                <select className="select" value={f.called} onChange={(e) => setF({ ...f, called: e.target.value })}>
                  <option>כן</option><option>לא</option>
                </select>
              </div>
              <div className="field">
                <label>אישר הגעה</label>
                <select className="select" value={f.confirmed} onChange={(e) => setF({ ...f, confirmed: e.target.value })}>
                  <option>כן</option><option>ממתין</option><option>לא</option>
                </select>
              </div>
              <div className="field">
                <label>הגיע בפועל</label>
                <select className="select" value={f.arrived} onChange={(e) => setF({ ...f, arrived: e.target.value })}>
                  <option>כן</option><option>לא</option><option>—</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>הערות</label>
              <textarea className="textarea" rows={3} value={f.notes || ""} onChange={(e) => setF({ ...f, notes: e.target.value })} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => { onSave(f); setEditing(false); }}>שמירה</button>
              <button className="btn" onClick={() => { setF(participant); setEditing(false); }}>ביטול</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* =================== Add Participant Modal (multi-select) =================== */
function AddParticipantModal({ elderlyList = [], excludeIds = [], onClose, onSave }) {
  const excludeSet = new Set(excludeIds.map(String));
  const available = elderlyList.filter(
    (e) => (e.status || "פעיל") === "פעיל" && !excludeSet.has(String(e.id)),
  );
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");
  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const displayName = (e) =>
    `${e.firstName || ""} ${e.lastName || ""}`.trim() || e.fullName || e.name || "ללא שם";
  const displayPhone = (e) => e.mobile || e.homePhone || e.phone || "—";

  const filtered = available.filter((e) => {
    if (!search.trim()) return true;
    const hay = `${displayName(e)} ${displayPhone(e)} ${e.neighborhood || ""} ${e.area || ""}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>הוספת משתתפים לפרלמנט</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-section">
          <div className="field">
            <input className="input" placeholder="חיפוש לפי שם, טלפון, שכונה..." value={search}
              onChange={(e) => setSearch(e.target.value)} />
          </div>
          {available.length === 0 ? (
            <div style={{ textAlign: "center", color: "#666", padding: "16px" }}>
              אין אזרחים ותיקים פעילים זמינים להוספה לפרלמנט
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", color: "#666", padding: "16px" }}>
              לא נמצאו אזרחים תואמים לחיפוש
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
                    <th>אזור</th>
                    <th>סטטוס</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <input type="checkbox" checked={selected.includes(e.id)}
                          onChange={() => toggle(e.id)} />
                      </td>
                      <td>{displayName(e)}</td>
                      <td>{displayPhone(e)}</td>
                      <td>{e.neighborhood || "—"}</td>
                      <td>{e.area || "—"}</td>
                      <td><span className="badge badge-green">{e.status || "פעיל"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" disabled={selected.length === 0}
            onClick={() => onSave(selected)}>הוספה לפרלמנט</button>
          <button className="btn" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

/* =================== Participant Info Modal (participants tab) =================== */
function ParticipantInfoModal({ participant, mobile, homePhone, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>פרטי משתתף — {participant.firstName} {participant.lastName}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="form-section">
          <div className="detail-grid">
            <div className="item"><label>שם מלא</label><div>{participant.firstName} {participant.lastName}</div></div>
            <div className="item"><label>טלפון נייד</label><div>{mobile || "—"}</div></div>
            <div className="item"><label>טלפון בית</label><div>{homePhone || "—"}</div></div>
            <div className="item"><label>כתובת</label><div>{participant.address || "—"}</div></div>
            <div className="item"><label>שכונה</label><div>{participant.neigh || "—"}</div></div>
            <div className="item"><label>אזור</label><div>{participant.area || "—"}</div></div>
            <div className="item"><label>סוג שיבוץ</label><div>{participant.type || "—"}</div></div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>סגירה</button>
        </div>
      </div>
    </div>
  );
}

/* =================== Participant Phones Modal (attendance sub-tab) =================== */
function ParticipantPhonesModal({ participant, mobile, homePhone, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>פרטי קשר — {participant.firstName} {participant.lastName}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="form-section">
          <div className="detail-grid">
            <div className="item"><label>שם מלא</label><div>{participant.firstName} {participant.lastName}</div></div>
            <div className="item"><label>טלפון נייד</label><div>{mobile || "—"}</div></div>
            <div className="item"><label>טלפון בית</label><div>{homePhone || "—"}</div></div>
            <div className="item"><label>סוג שיבוץ</label><div>{participant.type || "—"}</div></div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>סגירה</button>
        </div>
      </div>
    </div>
  );
}

/* =================== Meeting Form Modal =================== */
function MeetingFormModal({ title, initial, onClose, onSave, onDelete }) {
  const [f, setF] = useState(initial || { date: "", startTime: "", location: "", notes: "" });
  const [err, setErr] = useState("");
  const handleSave = () => {
    if (!f.date) { setErr("יש להזין תאריך"); return; }
    if (!f.startTime) { setErr("יש להזין שעת התחלה"); return; }
    if (!(f.location || "").trim()) { setErr("יש להזין מיקום"); return; }
    onSave({
      date: f.date,
      startTime: f.startTime,
      location: f.location.trim(),
      notes: (f.notes || "").trim(),
    });
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {err && <div className="form-warning">{err}</div>}
        <div className="row row-2">
          <div className="field"><label>תאריך הפגישה *</label>
            <input type="date" className="input" value={f.date}
              onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          <div className="field"><label>זמן התחלה *</label>
            <input type="time" className="input" value={f.startTime}
              onChange={(e) => setF({ ...f, startTime: e.target.value })} /></div>
          <div className="field" style={{ gridColumn: "span 2" }}>
            <label>מיקום הפגישה *</label>
            <input className="input" value={f.location}
              onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
        </div>
        <div className="field">
          <label>הערות</label>
          <textarea className="textarea" rows={3} value={f.notes || ""}
            onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </div>
        <div className="modal-actions" style={{ justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={handleSave}>שמירה</button>
            <button className="btn" onClick={onClose}>ביטול</button>
          </div>
          {onDelete && (
            <button className="btn btn-danger" onClick={onDelete}>מחיקת פגישה</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* =================== Expense Form Modal =================== */
function ExpenseFormModal({ title, initial, onClose, onSave, onDelete }) {
  const [f, setF] = useState(initial || { details: "", amount: "", date: "" });
  const [err, setErr] = useState("");
  const handleSave = () => {
    if (!(f.details || "").trim()) { setErr("יש להזין פרטי הוצאה"); return; }
    if (f.amount === "" || isNaN(Number(f.amount))) { setErr("יש להזין סכום תקין"); return; }
    if (!f.date) { setErr("יש להזין תאריך"); return; }
    onSave({ details: f.details.trim(), amount: Number(f.amount), date: f.date });
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {err && <div className="form-warning">{err}</div>}
        <div className="field"><label>פרטי ההוצאה *</label>
          <input className="input" value={f.details}
            onChange={(e) => setF({ ...f, details: e.target.value })} /></div>
        <div className="row row-2">
          <div className="field"><label>סכום (₪) *</label>
            <input type="number" className="input" value={f.amount}
              onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
          <div className="field"><label>תאריך *</label>
            <input type="date" className="input" value={f.date}
              onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        </div>
        <div className="modal-actions" style={{ justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={handleSave}>שמירה</button>
            <button className="btn" onClick={onClose}>ביטול</button>
          </div>
          {onDelete && (
            <button className="btn btn-danger" onClick={onDelete}>מחיקת הוצאה</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* =================== Attendance Notes Modal =================== */
function AttendanceNotesModal({ participant, initialText = "", onClose, onSave }) {
  const [text, setText] = useState(initialText);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>הערות נוכחות — {participant.firstName} {participant.lastName}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="form-section">
          <div className="field">
            <label>הערה</label>
            <textarea className="textarea" rows={5} value={text}
              onChange={(e) => setText(e.target.value)} placeholder="הוספת הערה..." />
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={() => onSave(text)}>שמירה</button>
          <button className="btn" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}



/* =================== Print / Report Modal =================== */
function PrintReportModal({ parliaments, onClose, areaOptions = [] }) {
  const [filters, setFilters] = useState({
    area: "",
    locations: [],
    status: "",
    dateFrom: "",
    dateTo: "",
  });
  const [preview, setPreview] = useState(false);
  const [dateErr, setDateErr] = useState("");

  const setDateFrom = (v) => {
    setFilters((p) => ({ ...p, dateFrom: v }));
    if (filters.dateTo && v && v > filters.dateTo) setDateErr('"מתאריך" חייב להיות מוקדם או שווה ל"עד תאריך".');
    else setDateErr("");
  };
  const setDateTo = (v) => {
    setFilters((p) => ({ ...p, dateTo: v }));
    if (filters.dateFrom && v && filters.dateFrom > v) setDateErr('"מתאריך" חייב להיות מוקדם או שווה ל"עד תאריך".');
    else setDateErr("");
  };

  const toggleLocation = (loc) => {
    setFilters((prev) => ({
      ...prev,
      locations: prev.locations.includes(loc) ? prev.locations.filter((l) => l !== loc) : [...prev.locations, loc],
    }));
  };

  const filtered = useMemo(() => {
    return parliaments.filter((p) => {
      if (filters.area && p.area !== filters.area) return false;
      if (filters.locations.length && !filters.locations.includes(p.location)) return false;
      if (filters.status && p.status !== filters.status) return false;
      if (filters.dateFrom && p.nextDate && p.nextDate < filters.dateFrom) return false;
      if (filters.dateTo && p.nextDate && p.nextDate > filters.dateTo) return false;
      return true;
    });
  }, [parliaments, filters]);

  const downloadCSV = () => {
    const headers = ["שם פרלמנט", "מיקום", "אזור", "סטטוס", "תאריך מפגש"];
    const rows = filtered.map((p) => [p.name, p.location, p.area, p.status, p.nextDate || ""]);
    const csv = "\uFEFF" + [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "parliaments-report.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => { setPreview(true); setTimeout(() => window.print(), 50); };
  const datesInvalid = !!dateErr;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header no-print">
          <h2>הדפסת רשימה — פרלמנטים</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {dateErr && <div className="form-warning no-print">{dateErr}</div>}

        <div className="row row-3 no-print">
          <div className="field">
            <label>אזור</label>
            <select className="select" value={filters.area} onChange={(e) => setFilters({ ...filters, area: e.target.value })}>
              <option value="">הכל</option>
              {areaOptions.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="field" style={{ gridColumn: "span 2" }}>
            <label>מיקום (ניתן לבחור מספר אפשרויות)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "8px 10px", border: "1px solid var(--color-border, #e5e0d8)", borderRadius: 8, background: "#fff" }}>
              {LOCATION_OPTIONS.map((loc) => (
                <label key={loc} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", background: filters.locations.includes(loc) ? "var(--color-accent-soft, #f3ece1)" : "transparent", borderRadius: 6, cursor: "pointer" }}>
                  <input type="checkbox" checked={filters.locations.includes(loc)} onChange={() => toggleLocation(loc)} />
                  <span>{loc}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label>סטטוס פרלמנט</label>
            <select className="select" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">הכל</option>
              {STATUS_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="field">
            <label>מתאריך</label>
            <input type="date" className="input" value={filters.dateFrom} max={filters.dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="field">
            <label>עד תאריך</label>
            <input type="date" className="input" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        {preview && (
          <div className="print-area">
            <h3 style={{ marginBottom: 12 }}>תצוגה מקדימה ({filtered.length})</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>שם פרלמנט</th><th>מיקום</th><th>אזור</th><th>סטטוס</th><th>תאריך מפגש</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td><td>{p.location}</td><td>{p.area}</td><td>{p.status}</td><td>{p.nextDate || "—"}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: 16 }}>אין נתונים להצגה</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="modal-actions no-print">
          <button className="btn btn-primary" disabled={datesInvalid} onClick={() => setPreview((v) => !v)}>תצוגה מקדימה</button>
          <button className="btn" disabled={datesInvalid} onClick={downloadCSV}>הורדת דוח</button>
          <button className="btn" disabled={datesInvalid} onClick={handlePrint}>הדפסה</button>
          <button className="btn" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}