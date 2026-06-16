import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout.jsx";
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
} from "@/services/parliamentsService.js";
import { getElderly } from "@/services/elderlyService.js";
import { getVolunteers } from "@/services/volunteersService.js";
import { getAreaNames } from "@/services/settingsService.js";

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
    locations: [],
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
        // Load participants for every parliament so counts are live
        const entries = await Promise.all(
          (list || []).map(async (p) => {
            try {
              const parts = await getParticipants(p.id);
              return [p.id, parts];
            } catch {
              return [p.id, []];
            }
          }),
        );
        const map = {};
        entries.forEach(([id, arr]) => (map[id] = arr));
        setParticipantsMap(map);
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
    const payload = { ...data };
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
    }));
  }, [parliaments, participantsMap]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return decorated.filter((p) => {
      if (filters.area && p.area !== filters.area) return false;
      if (filters.locations.length && !filters.locations.includes(p.location)) return false;
      if (filters.status && p.status !== filters.status) return false;
      if (filters.dateFrom && p.nextDate && p.nextDate < filters.dateFrom) return false;
      if (filters.dateTo && p.nextDate && p.nextDate > filters.dateTo) return false;
      if (q) {
        const hay = [
          p.name, p.location, p.area, p.status, p.nextDate, p.nextTime, p.notes,
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

  const toggleLocation = (loc) => setFilters((prev) => ({
    ...prev,
    locations: prev.locations.includes(loc) ? prev.locations.filter((l) => l !== loc) : [...prev.locations, loc],
  }));

  return (
    <AdminLayout
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
        <StatsCard title="פרלמנטים פעילים" value={String(active)} />
        <StatsCard title="פרלמנטים השבוע" value={String(thisWeek)} />
        <StatsCard title="משתתפים רשומים" value={String(totalParticipants)} />
        <StatsCard title='סה"כ פרלמנטים' value={String(decorated.length)} />
      </div>

      <SectionCard title="רשימת פרלמנטים">
        {/* Custom search + filter row (mirrors print modal filters) */}
        <div className="search-filter-panel">
          <div className="search-input-wrapper">
            <input
              className="search-input"
              placeholder="חיפוש לפי שם פרלמנט, מיקום, מלווה..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="filters-row" style={{ flexWrap: "wrap" }}>
            <select className="filter-pill" value={filters.area} onChange={(e) => setFilters({ ...filters, area: e.target.value })}>
              <option value="">אזור</option>
              {areaOptions.map((o) => <option key={o}>{o}</option>)}
            </select>
            <select className="filter-pill" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">סטטוס</option>
              {STATUS_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
            <select
              className="filter-pill"
              value=""
              onChange={(e) => { if (e.target.value) toggleLocation(e.target.value); }}
            >
              <option value="">מיקום (בחר/הסר)</option>
              {LOCATION_OPTIONS.map((o) => (
                <option key={o} value={o}>{filters.locations.includes(o) ? "✓ " : ""}{o}</option>
              ))}
            </select>
            <input type="date" className="filter-pill" value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
            <input type="date" className="filter-pill" value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
            {(search || filters.area || filters.status || filters.locations.length || filters.dateFrom || filters.dateTo) && (
              <button className="filter-pill" onClick={() => { setSearch(""); setFilters({ area: "", locations: [], status: "", dateFrom: "", dateTo: "" }); }}>נקה</button>
            )}
          </div>
          {filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo && (
            <div className="form-warning">תאריך "מתאריך" חייב להיות מוקדם או שווה ל"עד תאריך".</div>
          )}
          {filters.locations.length > 0 && (
            <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 6 }}>
              מיקומים נבחרים: {filters.locations.join(", ")}
            </div>
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
            { key: "location", label: sortableHeader("location", "מיקום") },
            { key: "area", label: sortableHeader("area", "אזור") },
            { key: "coordinator", label: sortableHeader("coordinator", "מלווה"), render: (r) => (r.coordinators || []).join(", ") },
            { key: "members", label: sortableHeader("members", "משתתפים") },
            { key: "nextDate", label: sortableHeader("nextDate", "מפגש הבא"), render: (r) => r.nextDate || "—" },
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
    </AdminLayout>
  );
}

/* =================== Parliament Detail =================== */
function ParliamentDetail({ parl, allParliaments, participants, setParticipants, onBack, onEdit, onDelete, areaOptions, volunteerOptions }) {
  const [tab, setTab] = useState("participants");
  const [showEdit, setShowEdit] = useState(false);
  const [openParticipant, setOpenParticipant] = useState(null);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [elderlyList, setElderlyList] = useState([]);

  // Load participants on mount (persistence fix)
  useEffect(() => {
    (async () => {
      try {
        const parts = await getParticipants(parl.id);
        if (parts && parts.length) setParticipants(parts);
      } catch (e) {
        console.warn("Failed to load participants:", e);
      }
    })();
    (async () => {
      try { setElderlyList(await getElderly()); }
      catch (e) { console.warn("elderly load failed", e); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parl.id]);

  // Look up phone from elderly collection by participant.elderlyId or by name match
  const phoneFor = (p) => {
    let match = null;
    if (p.elderlyId) match = elderlyList.find((e) => String(e.id) === String(p.elderlyId));
    if (!match) {
      const fn = (p.firstName || "").trim();
      const ln = (p.lastName || "").trim();
      match = elderlyList.find((e) =>
        (e.firstName || "").trim() === fn && (e.lastName || "").trim() === ln,
      );
    }
    if (match) return match.mobile || match.homePhone || p.phone || "—";
    return p.phone || "—";
  };

  const sortedParticipants = useMemo(
    () => [...participants].sort((a, b) => (Number(a.n) || 0) - (Number(b.n) || 0)),
    [participants],
  );

  const confirmed = sortedParticipants.filter((p) => p.confirmed === "כן").length;
  const notComing = sortedParticipants.filter((p) => p.confirmed === "לא").length;
  const waiting = sortedParticipants.filter((p) => p.confirmed === "ממתין" || !p.confirmed).length;

  const existingNames = allParliaments.filter((p) => p.id !== parl.id).map((p) => p.name);

  const handleAddParticipant = async (data) => {
    const nextN = sortedParticipants.reduce((m, p) => Math.max(m, Number(p.n) || 0), 0) + 1;
    const parts = (data.fullName || "").trim().split(/\s+/);
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ");
    const payload = {
      n: nextN,
      firstName,
      lastName,
      elderlyId: data.elderlyId || "",
      phone: data.phone || "",
      address: data.address || "",
      neigh: data.neigh || "",
      area: data.area || "",
      type: data.type || "",
      called: "לא",
      confirmed: "ממתין",
      arrived: "—",
      notes: "",
    };
    try {
      const saved = await addParticipant(parl.id, payload);
      setParticipants((prev) => [...prev, { ...payload, id: saved.id }]);
    } catch (err) {
      console.warn("addParticipant failed:", err);
      setParticipants((prev) => [...prev, { ...payload, id: Date.now() }]);
    }
    setShowAddParticipant(false);
  };

  const handleUpdateAttendance = async (updated) => {
    setParticipants((prev) => prev.map((p) => (p.id === updated.id || p.n === updated.n ? updated : p)));
    if (updated.id) {
      try {
        const { id, ...rest } = updated;
        await updateParticipantAttendance(parl.id, id, rest);
      } catch (e) {
        console.warn("updateParticipantAttendance failed:", e);
      }
    }
  };

  return (
    <AdminLayout
      title={parl.name}
      subtitle={`${parl.location} • מפגש הבא: ${parl.nextDate || "—"}`}
      actions={<button className="btn btn-primary" onClick={() => setShowEdit(true)}>עריכת פרטים</button>}
    >
      <button className="back-link" onClick={onBack}>→ חזרה לפרלמנטים</button>

      <div className="stats-grid">
        <StatsCard title="משתתפים" value={String(sortedParticipants.length)} />
        <StatsCard title="אישרו הגעה" value={String(confirmed)} />
        <StatsCard title="לא יגיעו" value={String(notComing)} />
        <StatsCard title="ממתינים לאישור" value={String(waiting)} />
      </div>

      {/* Tabs + add-participant button aligned on the same row */}
      <div className="tabs" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={tab === "participants" ? "active" : ""} onClick={() => setTab("participants")}>רשימת משתתפים</button>
          <button className={tab === "attendance" ? "active" : ""} onClick={() => setTab("attendance")}>מעקב נוכחות</button>
        </div>
        {tab === "participants" && (
          <button className="btn btn-primary" onClick={() => setShowAddParticipant(true)}>
            + הוספת משתתפים
          </button>
        )}
      </div>

      {tab === "participants" && (
        <SectionCard>
          <DataTable
            columns={[
              { key: "n", label: "מס׳" },
              { key: "name", label: "שם", render: (r) => `${r.firstName} ${r.lastName}` },
              { key: "phone", label: "טלפון", render: (r) => phoneFor(r) },
              { key: "address", label: "כתובת" },
              { key: "neigh", label: "שכונה" },
              { key: "area", label: "אזור" },
              { key: "type", label: "סוג שיבוץ" },
            ]}
            data={sortedParticipants}
          />
        </SectionCard>
      )}

      {tab === "attendance" && (
        <SectionCard>
          <DataTable
            columns={[
              {
                key: "name",
                label: "שם אזרח ותיק",
                render: (r) => (
                  <button className="link-btn" onClick={() => setOpenParticipant(r)}>
                    {r.firstName} {r.lastName}
                  </button>
                ),
              },
              { key: "called", label: "ניסינו להתקשר", render: (r) => r.called || "לא" },
              { key: "confirmed", label: "אישר הגעה", render: (r) => r.confirmed || "ממתין" },
              { key: "arrived", label: "הגיע בפועל", render: (r) => r.arrived || "—" },
              { key: "notes", label: "הערות", render: (r) => r.notes || "" },
            ]}
            data={sortedParticipants}
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

      {openParticipant && (
        <ParticipantProfileModal
          participant={openParticipant}
          onClose={() => setOpenParticipant(null)}
          onSave={(updated) => {
            handleUpdateAttendance(updated);
            setOpenParticipant(updated);
          }}
        />
      )}

      {showAddParticipant && (
        <AddParticipantModal
          onClose={() => setShowAddParticipant(false)}
          onSave={handleAddParticipant}
        />
      )}
    </AdminLayout>
  );
}

/* =================== Parliament Form Modal =================== */
const REQUIRED_LABELS = {
  name: "שם פרלמנט",
  location: "מיקום",
  area: "אזור",
  status: "סטטוס",
  nextDate: "תאריך מפגש הבא",
  nextTime: "שעת מפגש",
  coordinators: "מלווה",
};

function ParliamentFormModal({ title, initial, existingNames = [], onClose, onSave, onDelete, areaOptions = [], volunteerOptions = [] }) {
  const [f, setF] = useState(
    initial || {
      name: "",
      location: "",
      area: "",
      coordinators: [""],
      nextDate: "",
      nextTime: "",
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
    if (!trimmed(f.nextDate)) missing.push(REQUIRED_LABELS.nextDate);
    if (!trimmed(f.nextTime)) missing.push(REQUIRED_LABELS.nextTime);
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
          <div className="field">
            <label>תאריך מפגש הבא *</label>
            <input type="date" className="input" value={f.nextDate} onChange={(e) => setF({ ...f, nextDate: e.target.value })} />
          </div>
          <div className="field">
            <label>שעת מפגש *</label>
            <input type="time" className="input" value={f.nextTime} onChange={(e) => setF({ ...f, nextTime: e.target.value })} />
          </div>
        </div>

        <div className="field">
          <label>מלווה *</label>
          {(f.coordinators || []).map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <select className="select" value={c || ""} onChange={(e) => setCoord(i, e.target.value)}>
                <option value="">בחר מלווה</option>
                {volunteerOptions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              {(f.coordinators || []).length > 1 && (
                <button type="button" className="btn" onClick={() => removeCoord(i)}>הסר</button>
              )}
            </div>
          ))}
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

/* =================== Add Participant Modal =================== */
function AddParticipantModal({ onClose, onSave }) {
  const [elderly, setElderly] = useState([]);
  const [loadingElderly, setLoadingElderly] = useState(true);
  const [f, setF] = useState({ elderlyId: "", type: PLACEMENT_OPTIONS[0] });
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try { setElderly(await getElderly() || []); }
      catch (e) { console.warn("Failed to load elderly:", e); }
      finally { setLoadingElderly(false); }
    })();
  }, []);

  const handleSave = () => {
    if (!f.elderlyId) { setErr("יש לבחור אזרח ותיק"); return; }
    if (!f.type) { setErr("יש לבחור סוג שיבוץ"); return; }
    const chosen = elderly.find((e) => String(e.id) === String(f.elderlyId));
    if (!chosen) { setErr("האזרח שנבחר אינו קיים"); return; }
    const fullName =
      chosen.fullName ||
      [chosen.firstName, chosen.lastName].filter(Boolean).join(" ") ||
      chosen.name || "";
    onSave({
      elderlyId: chosen.id,
      fullName,
      phone: chosen.mobile || chosen.homePhone || chosen.phone || "",
      address: chosen.address || "",
      neigh: chosen.neighborhood || chosen.neigh || "",
      area: chosen.area || "",
      type: f.type,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>הוספת משתתפים</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {err && <div className="form-warning">{err}</div>}

        <div className="row row-2">
          <div className="field">
            <label>שם *</label>
            <select className="select" value={f.elderlyId} disabled={loadingElderly}
              onChange={(e) => setF({ ...f, elderlyId: e.target.value })}>
              <option value="">{loadingElderly ? "טוען..." : "בחר אזרח ותיק"}</option>
              {elderly.map((e) => {
                const name =
                  e.fullName ||
                  [e.firstName, e.lastName].filter(Boolean).join(" ") ||
                  e.name || "ללא שם";
                return <option key={e.id} value={e.id}>{name}</option>;
              })}
            </select>
          </div>
          <div className="field">
            <label>סוג שיבוץ *</label>
            <select className="select" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              {PLACEMENT_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={handleSave}>שמירה</button>
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