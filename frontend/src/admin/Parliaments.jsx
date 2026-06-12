import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout.jsx";
import StatsCard from "@/components/admin/StatsCard.jsx";
import SearchFilters from "@/components/admin/SearchFilters.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import DataTable from "@/components/admin/DataTable.jsx";
import {
  getParliaments,
  createParliament,
  editParliament,
  deleteParliament,
  addParticipant,
} from "@/services/parliamentsService.js";
import { getElderly } from "@/services/elderlyService.js";

/* ===== Options ===== */
const AREA_OPTIONS = ["מרכז", "צפון", "דרום", "מערב", "מזרח"];
const STATUS_OPTIONS = ["פעיל", "בהכנה", "הסתיים"];
const LOCATION_OPTIONS = [
  "מרכז קהילתי רחביה",
  "מתנ\"ס גילה",
  "בית הכנסת המרכזי",
  "מועדון קטמון",
  "מתנ\"ס פסגת זאב",
  "מרכז יום לקשיש",
  "בית הספר היסודי",
];
const PLACEMENT_OPTIONS = ["קבוע", "זמני", "אורח"];

const SEED_PARLIAMENTS = [
  { id: 1, name: "פרלמנט רחביה", location: "מרכז קהילתי רחביה", area: "מרכז", coordinators: ["פנינה לוי"], members: 18, nextDate: "2026-06-05", nextTime: "17:00", status: "פעיל", notes: "" },
  { id: 2, name: "פרלמנט גילה", location: "מתנ\"ס גילה", area: "דרום", coordinators: ["שירה אברהם"], members: 22, nextDate: "2026-06-08", nextTime: "18:00", status: "פעיל", notes: "" },
  { id: 3, name: "פרלמנט בית הכרם", location: "בית הכנסת המרכזי", area: "מערב", coordinators: ["פנינה לוי"], members: 16, nextDate: "2026-06-12", nextTime: "16:30", status: "פעיל", notes: "" },
  { id: 4, name: "פרלמנט קטמון", location: "מועדון קטמון", area: "מרכז", coordinators: ["שרה כהן"], members: 14, nextDate: "", nextTime: "", status: "בהכנה", notes: "" },
  { id: 5, name: "פרלמנט פסגת זאב", location: "מתנ\"ס פסגת זאב", area: "צפון", coordinators: ["שירה אברהם"], members: 16, nextDate: "2026-06-20", nextTime: "17:30", status: "פעיל", notes: "" },
];

const SEED_PARTICIPANTS = [
  { n: 1, lastName: "לוי", firstName: "מרים", phone: "052-1234567", address: "הרצוג 12", neigh: "רחביה", area: "מרכז", type: "פרטי", marital: "אלמן/ה", called: "כן", confirmed: "כן", arrived: "—", notes: "" },
  { n: 2, lastName: "ברקוביץ", firstName: "יוסף", phone: "054-9876543", address: "הפלמ\"ח 8", neigh: "רחביה", area: "מרכז", type: "פרטי", marital: "נשוי/אה", called: "כן", confirmed: "ממתין", arrived: "—", notes: "לא ענה" },
  { n: 3, lastName: "שטרן", firstName: "חנה", phone: "050-1112222", address: "החלוץ 4", neigh: "רחביה", area: "מרכז", type: "פרטי", marital: "אלמן/ה", called: "כן", confirmed: "כן", arrived: "—", notes: "צריכה הסעה" },
];

const statusBadge = (s) => (s === "פעיל" ? "badge-green" : s === "בהכנה" ? "badge-orange" : "badge-gray");

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

export default function Parliaments() {
  const [parliaments, setParliaments] = useState(SEED_PARLIAMENTS);
  const [participantsMap, setParticipantsMap] = useState({ 1: SEED_PARTICIPANTS });
  const [selectedId, setSelectedId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [loadError, setLoadError] = useState("");

  // Load from Firestore on mount; fall back to seed if it fails / is empty
  useEffect(() => {
    (async () => {
      try {
        const list = await getParliaments();
        if (list && list.length) setParliaments(list);
      } catch (err) {
        console.warn("Failed to load parliaments from Firestore:", err);
        setLoadError("טעינת הנתונים מהשרת נכשלה — מוצגים נתוני דוגמה.");
      }
    })();
  }, []);

  const sorted = useMemo(
    () => [...parliaments].sort((a, b) => (a.name || "").localeCompare(b.name || "", "he")),
    [parliaments],
  );

  const selected = sorted.find((p) => p.id === selectedId) || null;

  const setParticipantsFor = (pid, updater) => {
    setParticipantsMap((prev) => {
      const current = prev[pid] || [];
      const next = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, [pid]: next };
    });
  };

  /* ===== Handlers (Firebase + local state) ===== */
  const handleCreateParliament = async (data) => {
    const payload = { ...data, members: Number(data.members) || 0 };
    try {
      const saved = await createParliament(payload);
      setParliaments((prev) => [...prev, saved]);
    } catch (err) {
      console.warn("createParliament failed, using local state only:", err);
      setParliaments((prev) => [...prev, { ...payload, id: Date.now() }]);
    }
    setShowAdd(false);
  };

  const handleEditParliament = async (id, data) => {
    try {
      await editParliament(id, data);
    } catch (err) {
      console.warn("editParliament failed, updating local state only:", err);
    }
    setParliaments((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
  };

  const handleDeleteParliament = async (parl) => {
    if (!window.confirm(`למחוק את "${parl.name}"? לא ניתן לשחזר פעולה זו.`)) return;
    try {
      await deleteParliament(parl.id);
    } catch (err) {
      console.warn("deleteParliament failed, removing from local state only:", err);
    }
    setParliaments((prev) => prev.filter((p) => p.id !== parl.id));
    setSelectedId(null);
  };

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
      />
    );
  }

  const active = sorted.filter((p) => p.status === "פעיל").length;
  const thisWeek = sorted.filter((p) => isThisWeek(p.nextDate)).length;
  const totalParticipants = Object.values(participantsMap).reduce(
    (s, arr) => s + (arr ? arr.length : 0),
    0,
  );
  const existingNames = sorted.map((p) => p.name);

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
        <StatsCard title='סה"כ פרלמנטים' value={String(sorted.length)} />
      </div>

      <SectionCard title="רשימת פרלמנטים">
        <SearchFilters
          searchPlaceholder="חיפוש לפי שם פרלמנט, מיקום או מלווה..."
          filters={[
            { label: "אזור", options: AREA_OPTIONS },
            { label: "סטטוס", options: STATUS_OPTIONS },
            { label: "מלווה", options: ["פנינה לוי", "שירה אברהם", "שרה כהן"] },
            { label: "חודש מפגש", options: ["יוני", "יולי", "אוגוסט"] },
          ]}
        />
        <DataTable
          columns={[
            {
              key: "name",
              label: "שם פרלמנט",
              render: (r) => (
                <button className="link-btn" onClick={() => setSelectedId(r.id)}>
                  {r.name}
                </button>
              ),
            },
            { key: "location", label: "מיקום" },
            { key: "area", label: "אזור" },
            { key: "coordinator", label: "מלווה", render: (r) => (r.coordinators || []).join(", ") },
            { key: "members", label: "משתתפים" },
            { key: "nextDate", label: "מפגש הבא", render: (r) => r.nextDate || "—" },
            { key: "status", label: "סטטוס", render: (r) => <span className={`badge ${statusBadge(r.status)}`}>{r.status}</span> },
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
        />
      )}
      {showPrint && (
        <PrintReportModal parliaments={sorted} onClose={() => setShowPrint(false)} />
      )}
    </AdminLayout>
  );
}

/* =================== Parliament Detail =================== */
function ParliamentDetail({ parl, allParliaments, participants, setParticipants, onBack, onEdit, onDelete }) {
  const [tab, setTab] = useState("participants");
  const [showEdit, setShowEdit] = useState(false);
  const [openParticipant, setOpenParticipant] = useState(null);
  const [showAddParticipant, setShowAddParticipant] = useState(false);

  // Sorted strictly by sequential index column "מס׳"
  const sortedParticipants = useMemo(
    () => [...participants].sort((a, b) => (Number(a.n) || 0) - (Number(b.n) || 0)),
    [participants],
  );

  const confirmed = sortedParticipants.filter((p) => p.confirmed === "כן").length;
  const notComing = sortedParticipants.filter((p) => p.confirmed === "לא").length;
  const waiting = sortedParticipants.filter((p) => p.confirmed === "ממתין").length;

  const existingNames = allParliaments
    .filter((p) => p.id !== parl.id)
    .map((p) => p.name);

  const handleAddParticipant = async (data) => {
    const nextN = sortedParticipants.reduce((m, p) => Math.max(m, Number(p.n) || 0), 0) + 1;
    const parts = (data.fullName || "").trim().split(/\s+/);
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ");
    const payload = {
      n: nextN,
      firstName,
      lastName,
      phone: data.phone || "",
      address: data.address || "",
      neigh: data.neigh || "",
      area: data.area || "",
      type: data.type || "",
      called: "—",
      confirmed: "ממתין",
      arrived: "—",
      notes: "",
    };
    try {
      const saved = await addParticipant(parl.id, payload);
      setParticipants((prev) => [...prev, { ...payload, id: saved.id }]);
    } catch (err) {
      console.warn("addParticipant failed, using local state only:", err);
      setParticipants((prev) => [...prev, { ...payload, id: Date.now() }]);
    }
    setShowAddParticipant(false);
  };

  const handleUpdateAttendance = (updated) => {
    setParticipants((prev) => prev.map((p) => (p.n === updated.n ? updated : p)));
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
        <StatsCard title="נדרש טיפול" value="2" />
      </div>

      <div className="tabs">
        <button className={tab === "participants" ? "active" : ""} onClick={() => setTab("participants")}>רשימת משתתפים</button>
        <button className={tab === "attendance" ? "active" : ""} onClick={() => setTab("attendance")}>מעקב נוכחות</button>
      </div>

      {tab === "participants" && (
        <SectionCard>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button className="btn btn-primary" onClick={() => setShowAddParticipant(true)}>
              + הוספת משתתפים
            </button>
          </div>
          <DataTable
            columns={[
              { key: "n", label: "מס׳" },
              { key: "name", label: "שם", render: (r) => `${r.firstName} ${r.lastName}` },
              { key: "phone", label: "טלפון" },
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
              { key: "called", label: "ניסינו להתקשר" },
              { key: "confirmed", label: "אישר הגעה" },
              { key: "arrived", label: "הגיע בפועל" },
              { key: "notes", label: "הערות" },
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
          onSave={async (data) => {
            await onEdit(data);
            setShowEdit(false);
          }}
          onDelete={async () => {
            await onDelete();
            setShowEdit(false);
          }}
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
  members: "מספר משתתפים",
};

function ParliamentFormModal({ title, initial, existingNames = [], onClose, onSave, onDelete }) {
  const [f, setF] = useState(
    initial || {
      name: "",
      location: "",
      area: AREA_OPTIONS[0],
      coordinators: [""],
      members: "",
      nextDate: "",
      nextTime: "",
      status: "פעיל",
      notes: "",
    },
  );
  const [errors, setErrors] = useState([]);
  const [intWarn, setIntWarn] = useState("");

  const setCoord = (i, val) => {
    const arr = [...(f.coordinators || [])];
    arr[i] = val;
    setF({ ...f, coordinators: arr });
  };
  const addCoord = () => setF({ ...f, coordinators: [...(f.coordinators || []), ""] });
  const removeCoord = (i) =>
    setF({ ...f, coordinators: (f.coordinators || []).filter((_, idx) => idx !== i) });

  // Integer-only handler for numeric inputs
  const handleIntChange = (key, raw) => {
    const cleaned = String(raw).replace(/\D/g, "");
    if (cleaned !== String(raw)) {
      setIntWarn("ניתן להזין מספרים שלמים בלבד");
    } else {
      setIntWarn("");
    }
    setF({ ...f, [key]: cleaned });
  };

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
    if (f.members === "" || f.members === null || f.members === undefined) {
      missing.push(REQUIRED_LABELS.members);
    }

    const errs = [];
    if (missing.length) {
      errs.push(`יש למלא את כל השדות החובה: ${missing.join(", ")}`);
    }

    // Unique name
    const nameTrim = (f.name || "").trim();
    if (
      nameTrim &&
      existingNames.some((n) => (n || "").trim() === nameTrim)
    ) {
      errs.push("שם פרלמנט חייב להיות ייחודי — קיים כבר פרלמנט בשם זה.");
    }

    // Integer check
    if (f.members !== "" && !/^\d+$/.test(String(f.members))) {
      errs.push("שדה מספר משתתפים חייב להיות מספר שלם.");
    }

    setErrors(errs);
    return errs.length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const payload = {
      ...f,
      coordinators: (f.coordinators || []).map((c) => c.trim()).filter(Boolean),
      members: Number(f.members) || 0,
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
        {intWarn && <div className="form-warning">{intWarn}</div>}

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
              {AREA_OPTIONS.map((o) => <option key={o}>{o}</option>)}
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
          <div className="field">
            <label>מספר משתתפים *</label>
            <input
              className="input"
              inputMode="numeric"
              value={f.members ?? ""}
              onChange={(e) => handleIntChange("members", e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label>מלווה *</label>
          {(f.coordinators || []).map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <input className="input" value={c} onChange={(e) => setCoord(i, e.target.value)} placeholder={`מלווה ${i + 1}`} />
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

/* =================== Participant Profile Modal (with inline edit) =================== */
function ParticipantProfileModal({ participant, onClose, onSave }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState(participant);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div
          className="modal-header"
          style={{ display: "flex", flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}
        >
          <h2 style={{ margin: 0 }}>פרופיל אזרח ותיק — {participant.firstName} {participant.lastName}</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {!editing && (
              <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>עריכת פרטים</button>
            )}
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>

        {!editing ? (
          <>
            <div className="row row-2">
              <div className="field"><label>שם</label><div>{participant.firstName} {participant.lastName}</div></div>
              <div className="field"><label>ניסינו להתקשר</label><div>{participant.called}</div></div>
              <div className="field"><label>אישר הגעה</label><div>{participant.confirmed}</div></div>
              <div className="field"><label>הגיע בפועל</label><div>{participant.arrived}</div></div>
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
                <label>ניסינו להתקשר</label>
                <select className="select" value={f.called} onChange={(e) => setF({ ...f, called: e.target.value })}>
                  <option>כן</option><option>לא</option><option>—</option>
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
      try {
        const list = await getElderly();
        setElderly(list || []);
      } catch (e) {
        console.warn("Failed to load elderly:", e);
      } finally {
        setLoadingElderly(false);
      }
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
      chosen.name ||
      "";
    onSave({
      fullName,
      phone: chosen.phone || "",
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
            <select
              className="select"
              value={f.elderlyId}
              onChange={(e) => setF({ ...f, elderlyId: e.target.value })}
              disabled={loadingElderly}
            >
              <option value="">{loadingElderly ? "טוען..." : "בחר אזרח ותיק"}</option>
              {elderly.map((e) => {
                const name =
                  e.fullName ||
                  [e.firstName, e.lastName].filter(Boolean).join(" ") ||
                  e.name ||
                  "ללא שם";
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
function PrintReportModal({ parliaments, onClose }) {
  const [filters, setFilters] = useState({
    area: "",
    locations: [], // multi-select
    status: "",
    dateFrom: "",
    dateTo: "",
  });
  const [preview, setPreview] = useState(false);

  const toggleLocation = (loc) => {
    setFilters((prev) => {
      const exists = prev.locations.includes(loc);
      return {
        ...prev,
        locations: exists ? prev.locations.filter((l) => l !== loc) : [...prev.locations, loc],
      };
    });
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
    a.href = url;
    a.download = "parliaments-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    setPreview(true);
    // wait a tick so the print-area is in the DOM
    setTimeout(() => window.print(), 50);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header no-print">
          <h2>הדפסת רשימה — פרלמנטים</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="row row-3 no-print">
          <div className="field">
            <label>אזור</label>
            <select className="select" value={filters.area} onChange={(e) => setFilters({ ...filters, area: e.target.value })}>
              <option value="">הכל</option>
              {AREA_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="field" style={{ gridColumn: "span 2" }}>
            <label>מיקום (ניתן לבחור מספר אפשרויות)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "8px 10px", border: "1px solid var(--color-border, #e5e0d8)", borderRadius: 8, background: "#fff" }}>
              {LOCATION_OPTIONS.map((loc) => (
                <label key={loc} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", background: filters.locations.includes(loc) ? "var(--color-accent-soft, #f3ece1)" : "transparent", borderRadius: 6, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={filters.locations.includes(loc)}
                    onChange={() => toggleLocation(loc)}
                  />
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
            <input type="date" className="input" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
          </div>
          <div className="field">
            <label>עד תאריך</label>
            <input type="date" className="input" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
          </div>
        </div>

        {preview && (
          <div className="print-area">
            <h3 style={{ marginBottom: 12 }}>תצוגה מקדימה ({filtered.length})</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>שם פרלמנט</th>
                  <th>מיקום</th>
                  <th>אזור</th>
                  <th>סטטוס</th>
                  <th>תאריך מפגש</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.location}</td>
                    <td>{p.area}</td>
                    <td>{p.status}</td>
                    <td>{p.nextDate || "—"}</td>
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
          <button className="btn btn-primary" onClick={() => setPreview((v) => !v)}>תצוגה מקדימה</button>
          <button className="btn" onClick={downloadCSV}>הורדת דוח</button>
          <button className="btn" onClick={handlePrint}>הדפסה</button>
          <button className="btn" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}