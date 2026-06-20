import { useEffect, useMemo, useRef, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout.jsx";
import StatsCard from "@/components/admin/StatsCard.jsx";
import SearchFilters from "@/components/admin/SearchFilters.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import DataTable from "@/components/admin/DataTable.jsx";
import {
  getElderly,
  createElderly,
  editElderly,
  deleteElderly,
} from "@/services/elderlyService.js";
import { getVolunteers, editVolunteer } from "@/services/volunteersService.js";
import useAreasAndNeighborhoods from "@/hooks/useAreasAndNeighborhoods.js";

/* ===== Options (shared with volunteers page) =====
   Areas and neighborhoods are loaded from Firestore (settings/general) via the
   useAreasAndNeighborhoods hook — no hardcoded lists here. */
const VOLUNTEER_STATUS_OPTIONS = ["כן", "לא מתאים", "לא רוצה"];
const MARITAL_OPTIONS = ["רווק/ה", "נשוי/אה", "גרוש/ה", "אלמן/ה"];
const LANGUAGE_OPTIONS = ["עברית", "ערבית", "אנגלית", "ספרדית", "צרפתית", "רוסית", "סינית", "יפנית"];
const STATUS_OPTIONS = ["פעיל", "נפטר", "לא פעיל"];
const ASSISTANCE_OPTIONS = [
  "קשר חברתי",
  "ליווי לרופא",
  "קניות",
  "ניקיון",
  "סיוע טכני",
  "סיוע רגשי",
  "ליווי לפעילויות",
];

const COUNTRY_OPTIONS = [
  "ישראל","ארגנטינה","אוסטרליה","אוסטריה","בלגיה","ברזיל","בולגריה","קנדה","צ׳ילה","סין",
  "קולומביה","קרואטיה","קפריסין","צ׳כיה","דנמרק","מצרים","אסטוניה","אתיופיה","פינלנד","צרפת",
  "גאורגיה","גרמניה","יוון","הונגריה","הודו","אינדונזיה","אירן","עיראק","אירלנד","איטליה",
  "יפן","ירדן","קזחסטן","קניה","לטביה","לבנון","ליטא","לוקסמבורג","מקסיקו","מרוקו",
  "הולנד","ניו זילנד","ניגריה","נורבגיה","פקיסטן","פרו","פולין","פורטוגל","רומניה","רוסיה",
  "סעודיה","סרביה","סינגפור","סלובקיה","דרום אפריקה","דרום קוריאה","ספרד","שוודיה","שוויץ","סוריה",
  "טייוואן","תאילנד","תוניסיה","טורקיה","אוקראינה","איחוד האמירויות","בריטניה","ארצות הברית","אורוגוואי","ונצואלה","וייטנאם","תימן",
];

const SEED = [
  { id: 1, firstName: "מרים", lastName: "לוי", idNum: "012345678", birth: "1942-03-14", area: "מרכז", neighborhood: "רחביה", address: "הרצוג 12", mobile: "0521234567", homePhone: "025555555", contactName: "דוד לוי", contactPhone: "0549999999", lastContact: "2026-05-20", volStatus: "כן", volName: "דניאלה כץ", volId: 101, assistance: "קשר חברתי, ליווי לרופא", marital: "אלמן/ה", country: "פולין", language: "עברית", bio: "אישה חמה, אוהבת שיחות טלפון יומיות.", parliament: "פרלמנט רחביה", status: "פעיל", notes: "לתאם מראש לפני ביקור." },
  { id: 2, firstName: "יוסף", lastName: "ברקוביץ", idNum: "023456789", birth: "1938-11-02", area: "דרום", neighborhood: "גילה", address: "הפרחים 4", mobile: "0549876543", homePhone: "", contactName: "רחל ברקוביץ", contactPhone: "0521111111", lastContact: "2026-05-01", volStatus: "לא רוצה", volName: "", volId: null, assistance: "סיוע טכני", marital: "נשוי/אה", country: "רוסיה", language: "רוסית", bio: "", parliament: "פרלמנט גילה", status: "פעיל", notes: "ממתין לשיבוץ" },
  { id: 3, firstName: "חנה", lastName: "שטרן", idNum: "034567890", birth: "1945-06-21", area: "מערב", neighborhood: "בית הכרם", address: "החלוץ 7", mobile: "0501112222", homePhone: "026666666", contactName: "משה שטרן", contactPhone: "0523334444", lastContact: "2026-04-15", volStatus: "כן", volName: "מיכל אבני", volId: 102, assistance: "קשר חברתי", marital: "נשוי/אה", country: "ישראל", language: "עברית", bio: "", parliament: "פרלמנט בית הכרם", status: "פעיל", notes: "" },
  { id: 4, firstName: "אברהם", lastName: "כהן", idNum: "045678901", birth: "1940-01-10", area: "צפון", neighborhood: "פסגת זאב", address: "הרב פרנק 9", mobile: "0533334444", homePhone: "", contactName: "", contactPhone: "", lastContact: "", volStatus: "לא רוצה", volName: "", volId: null, assistance: "", marital: "אלמן/ה", country: "ישראל", language: "עברית", bio: "", parliament: "ללא פרלמנט", status: "פעיל", notes: "ביקש להישאר ללא קשר" },
  { id: 5, firstName: "רבקה", lastName: "אדרי", idNum: "056789012", birth: "1936-09-30", area: "מרכז", neighborhood: "קטמון", address: "פלמ״ח 22", mobile: "0525556666", homePhone: "027777777", contactName: "יעל אדרי", contactPhone: "0548887777", lastContact: "2026-03-22", volStatus: "לא מתאים", volName: "תמר גולן", volId: 103, assistance: "סיוע רגשי", marital: "אלמן/ה", country: "מרוקו", language: "עברית", bio: "מצב בריאותי מורכב.", parliament: "פרלמנט קטמון", status: "פעיל", notes: "" },
  { id: 6, firstName: "שלמה", lastName: "דהן", idNum: "067890123", birth: "1930-02-05", area: "צפון", neighborhood: "רוממה", address: "—", mobile: "", homePhone: "", contactName: "", contactPhone: "", lastContact: "", volStatus: "לא רוצה", volName: "", volId: null, assistance: "", marital: "אלמן/ה", country: "ישראל", language: "עברית", bio: "", parliament: "ללא פרלמנט", status: "נפטר", notes: "" },
];

const volBadge = (v) => (v === "כן" ? "badge-green" : v === "לא מתאים" || v === "לא רוצה" ? "badge-orange" : "");
const statusBadge = (s) => (s === "פעיל" ? "badge-green" : "badge-gray");
const fullName = (e) => `${e.firstName || ""} ${e.lastName || ""}`.trim();

export default function Elderly() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [openVolunteer, setOpenVolunteer] = useState(null);

  // Area/Neighborhood data — single source of truth from settings/general.
  const {
    areaNames,
    getNeighborhoods,
    loading: areasLoading,
    error: areasError,
    isEmpty: areasEmpty,
  } = useAreasAndNeighborhoods();

  // Filters (only area/neighborhood are wired to actual filtering).
  const [filterArea, setFilterArea] = useState("");
  const [filterNeighborhood, setFilterNeighborhood] = useState("");

  // If the area changes and the previously-selected neighborhood is no longer
  // valid for the new area, reset it.
  useEffect(() => {
    if (!filterNeighborhood) return;
    const valid = getNeighborhoods(filterArea).includes(filterNeighborhood);
    if (!valid) setFilterNeighborhood("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterArea]);

  // Load elderly from Firestore on mount. Fallback to SEED so the page still works
  // in environments where Firebase isn't configured.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const items = await getElderly();
        if (!mounted) return;
        setData(items.length ? items : SEED);
      } catch (err) {
        console.error("Failed to load elderly from Firestore:", err);
        if (!mounted) return;
        setLoadError("טעינה מ-Firebase נכשלה — מוצגים נתוני דוגמה.");
        setData(SEED);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const sorted = useMemo(
    () => [...data].sort((a, b) => fullName(a).localeCompare(fullName(b), "he")),
    [data],
  );

  const visible = useMemo(() => {
    return sorted.filter((e) => {
      if (filterArea && e.area !== filterArea) return false;
      if (filterNeighborhood && e.neighborhood !== filterNeighborhood) return false;
      return true;
    });
  }, [sorted, filterArea, filterNeighborhood]);

  const openElderly = sorted.find((e) => e.id === openId) || null;


  // Recompute a volunteer's status based on current elderly assignments.
  // If still assigned to at least one elderly → "משויך לאזרח ותיק".
  // Otherwise → "ממתין לשיבוץ". Only persists string volunteer ids (Firestore docs).
  const syncVolunteerStatus = async (volunteerId, elderlyList) => {
    if (!volunteerId || typeof volunteerId !== "string") return;
    const stillAssigned = elderlyList.some((e) => e.volId === volunteerId);
    const newStatus = stillAssigned ? "משויך לאזרח ותיק" : "ממתין לשיבוץ";
    try {
      await editVolunteer(volunteerId, { status: newStatus });
    } catch (err) {
      console.error("syncVolunteerStatus failed:", err);
    }
  };

  // Update an elderly citizen in Firestore + local state
  const handleEditElderly = async (id, updated) => {
    const prevVolId = data.find((e) => e.id === id)?.volId || null;
    try {
      // eslint-disable-next-line no-unused-vars
      const { id: _omit, ...payload } = updated;
      await editElderly(id, payload);
    } catch (err) {
      console.error("editElderly failed:", err);
      alert("שמירה ל-Firebase נכשלה. השינוי נשמר מקומית בלבד.");
    }
    const nextData = data.map((e) => (e.id === id ? { ...e, ...updated, id } : e));
    setData(nextData);
    setOpenId(null);

    const affected = new Set([prevVolId, updated.volId].filter(Boolean));
    for (const vid of affected) await syncVolunteerStatus(vid, nextData);
  };

  // Create a new elderly citizen in Firestore + local state
  const handleCreateElderly = async (entry) => {
    let saved = null;
    try {
      saved = await createElderly(entry);
    } catch (err) {
      console.error("createElderly failed:", err);
      alert("הוספה ל-Firebase נכשלה. הנתון נוסף מקומית בלבד.");
    }
    const newRecord = saved || {
      id: Math.max(0, ...data.map((d) => (typeof d.id === "number" ? d.id : 0))) + 1,
      ...entry,
    };
    const nextData = [newRecord, ...data];
    setData(nextData);
    setShowAdd(false);

    if (entry.volId) await syncVolunteerStatus(entry.volId, nextData);
  };

  // Delete an elderly citizen from Firestore + local state
  const handleDeleteElderly = async (elderly) => {
    if (!elderly) return;
    if (!window.confirm(`האם למחוק את ${fullName(elderly)}? פעולה זו אינה הפיכה.`)) return;
    try {
      // Only call Firestore if it looks like a real document id (string)
      if (typeof elderly.id === "string") {
        await deleteElderly(elderly.id);
      }
    } catch (err) {
      console.error("deleteElderly failed:", err);
      alert("מחיקה מ-Firebase נכשלה. הרשומה הוסרה מקומית בלבד.");
    }
    const nextData = data.filter((e) => e.id !== elderly.id);
    setData(nextData);
    setOpenId(null);

    if (elderly.volId) await syncVolunteerStatus(elderly.volId, nextData);
  };


  const connectedCount = data.filter((d) => d.volStatus === "כן" || d.volStatus === "לא מתאים").length;
  const withoutCount = data.length - connectedCount;

  return (
    <AdminLayout
      title="ניהול אזרחים ותיקים"
      subtitle="ניהול רשימת האזרחים הוותיקים, שיוך לאזורים ושכונות, סטטוס התנדבות ופרטים אישיים."
      actions={
        <>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ הוספת אזרח ותיק</button>
          <button className="btn" onClick={() => setShowPrint(true)}>הדפסת רשימה</button>
        </>
      }
    >
      {loadError && (
        <div style={{
          background: "#fef3c7", border: "1px solid #fde68a", color: "#92400e",
          borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 14,
        }}>{loadError}</div>
      )}
      {loading && (
        <div style={{ padding: "10px 0", color: "#6b7280", fontSize: 14 }}>טוען נתונים…</div>
      )}
      <div className="stats-grid">
        <StatsCard icon="👵" title="סה״כ אזרחים ותיקים" value={String(data.length)} />
        <StatsCard icon="🤝" title="מחוברים למתנדב" value={String(connectedCount)} />
        <StatsCard icon="🚫" title="ללא מתנדב" value={String(withoutCount)} />
      </div>

      <SectionCard>
        {areasError && (
          <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 8 }}>{areasError}</div>
        )}
        {areasLoading && (
          <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 8 }}>טוען אזורים ושכונות...</div>
        )}
        {areasEmpty && (
          <div style={{ color: "#92400e", fontSize: 13, marginBottom: 8 }}>לא נמצאו אזורים ושכונות</div>
        )}
        <SearchFilters
          searchPlaceholder="חיפוש לפי שם, טלפון, ת.ז, שכונה או הערות..."
          filters={[
            {
              label: "אזור",
              value: filterArea,
              onChange: (e) => setFilterArea(e.target.value),
              options: ["", ...areaNames],
            },
            {
              label: "שכונה",
              value: filterNeighborhood,
              onChange: (e) => setFilterNeighborhood(e.target.value),
              options: ["", ...getNeighborhoods(filterArea)],
            },
            { label: "סטטוס מתנדב", options: VOLUNTEER_STATUS_OPTIONS },
            { label: "מצב משפחתי", options: MARITAL_OPTIONS },
            { label: "סיוע", options: ASSISTANCE_OPTIONS },
            { label: "סטטוס", options: STATUS_OPTIONS },
          ]}
        />
        <DataTable
          columns={[
            {
              key: "name",
              label: "שם",
              render: (r) => (
                <button className="link-btn" onClick={() => setOpenId(r.id)}>{fullName(r)}</button>
              ),
            },
            { key: "neighborhood", label: "שכונה" },
            { key: "area", label: "אזור" },
            { key: "mobile", label: "טלפון", render: (r) => r.mobile || r.homePhone || "—" },
            {
              key: "volStatus",
              label: "סטטוס מתנדב",
              render: (r) => <span className={`badge ${volBadge(r.volStatus)}`}>{r.volStatus}</span>,
            },
            {
              key: "volName",
              label: "משויך ל",
              render: (r) =>
                r.volName ? (
                  <button className="link-btn" onClick={() => setOpenVolunteer(r)}>{r.volName}</button>
                ) : (
                  "—"
                ),
            },
            
            {
              key: "status",
              label: "מצב",
              render: (r) => <span className={`badge ${statusBadge(r.status)}`}>{r.status}</span>,
            },
            { key: "notes", label: "הערות" },
          ]}
          data={visible}
        />

      </SectionCard>

      {showAdd && (
        <ElderlyFormModal
          title="הוספת אזרח ותיק"
          initial={null}
          existingIds={data.map((d) => ({ id: d.id, idNum: d.idNum }))}
          onClose={() => setShowAdd(false)}
          onSave={handleCreateElderly}
        />
      )}
      {openElderly && (
        <ElderlyProfileModal
          entry={openElderly}
          existingIds={data.map((d) => ({ id: d.id, idNum: d.idNum }))}
          onClose={() => setOpenId(null)}
          onSave={(updated) => handleEditElderly(openElderly.id, updated)}
          onDelete={() => handleDeleteElderly(openElderly)}
        />
      )}
      {openVolunteer && (
        <VolunteerQuickModal entry={openVolunteer} onClose={() => setOpenVolunteer(null)} />
      )}
      {showPrint && <PrintReportModal items={sorted} onClose={() => setShowPrint(false)} />}
    </AdminLayout>
  );
}

/* ===== Profile modal (view + edit) ===== */
function ElderlyProfileModal({ entry, existingIds, onClose, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <ElderlyFormModal
        title="עריכת פרטי אזרח ותיק"
        initial={entry}
        existingIds={existingIds}
        onClose={() => setEditing(false)}
        onSave={(updated) => {
          onSave({ ...entry, ...updated });
          setEditing(false);
        }}
      />
    );
  }

  const D = ({ label, value }) => (
    <div className="item"><label>{label}</label><div>{value || "—"}</div></div>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 880 }}>
        <div className="modal-header" style={{ alignItems: "center" }}>
          <h2>פרופיל אזרח ותיק — {fullName(entry)}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginInlineStart: "auto" }}>
            <button className="btn btn-primary" onClick={() => setEditing(true)}>עריכת פרטים</button>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="form-section">
          <h4>פרטים אישיים</h4>
          <div className="detail-grid">
            <D label="שם פרטי" value={entry.firstName} />
            <D label="שם משפחה" value={entry.lastName} />
            <D label="ת.ז" value={entry.idNum} />
            <D label="תאריך לידה" value={entry.birth} />
            <D label="מצב משפחתי" value={entry.marital} />
          </div>
        </div>

        <div className="form-section">
          <h4>פרטי קשר</h4>
          <div className="detail-grid">
            <D label="אזור" value={entry.area} />
            <D label="שכונה" value={entry.neighborhood} />
            <D label="כתובת" value={entry.address} />
            <D label="טלפון נייד" value={entry.mobile} />
            <D label="טלפון בית" value={entry.homePhone} />
          </div>
        </div>

        <div className="form-section">
          <h4>איש קשר</h4>
          <div className="detail-grid">
            <D label="שם איש קשר" value={entry.contactName} />
            <D label="טלפון איש קשר" value={entry.contactPhone} />
            <D label="תאריך יצירת קשר אחרונה" value={entry.lastContact} />
          </div>
        </div>

        <div className="form-section">
          <h4>התנדבות</h4>
          <div className="detail-grid">
            <D label="סטטוס מתנדב" value={<span className={`badge ${volBadge(entry.volStatus)}`}>{entry.volStatus}</span>} />
            {(entry.volStatus === "כן" || entry.volStatus === "לא מתאים") && (
              <D label="שם מתנדב" value={entry.volName} />
            )}
            <D label="סיוע" value={entry.assistance} />
          </div>
        </div>

        <div className="form-section">
          <h4>רקע</h4>
          <div className="detail-grid">
            <D label="ארץ לידה" value={entry.country} />
            <D label="שפת דיבור" value={entry.language} />
            
            <D label="סטטוס" value={<span className={`badge ${statusBadge(entry.status)}`}>{entry.status}</span>} />
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label>פירוט חיים אישיים</label>
            <div>{entry.bio || "—"}</div>
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label>הערות</label>
            <div>{entry.notes || "—"}</div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>סגירה</button>
          {onDelete && (
            <button className="btn btn-danger" onClick={onDelete}>מחיקת אזרח ותיק</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===== Form modal (add / edit) ===== */
const NUMERIC_FIELDS = ["idNum", "mobile", "homePhone", "contactPhone"];
const REQUIRED_LABELS = {
  firstName: "שם פרטי", lastName: "שם משפחה", idNum: "ת.ז", birth: "תאריך לידה",
  marital: "מצב משפחתי", mobile: "טלפון נייד", homePhone: "טלפון בית",
  area: "אזור", neighborhood: "שכונה",
  contactName: "שם איש קשר", contactPhone: "טלפון איש קשר", lastContact: "תאריך יצירת קשר אחרונה",
  volStatus: "סטטוס מתנדב", volName: "שם מתנדב",
  country: "ארץ לידה", language: "שפת דיבור", status: "סטטוס",
};

function ElderlyFormModal({ title, initial, existingIds = [], onClose, onSave }) {
  const {
    areaNames,
    getNeighborhoods,
    loading: areasLoading,
    error: areasError,
    isEmpty: areasEmpty,
  } = useAreasAndNeighborhoods();

  const [f, setF] = useState(
    initial || {
      firstName: "", lastName: "", idNum: "", birth: "",
      mobile: "", homePhone: "",
      area: "", neighborhood: "", address: "",
      contactName: "", contactPhone: "", lastContact: "",
      volStatus: "לא רוצה", volName: "",
      assistance: "", marital: MARITAL_OPTIONS[0],
      country: "ישראל", language: "עברית",
      bio: "",
      status: "פעיל", notes: "",
    },
  );
  const [numericWarn, setNumericWarn] = useState({});
  const [missing, setMissing] = useState([]);
  const [idDup, setIdDup] = useState(false);

  // Load volunteers from Firestore for the volunteer-select dropdown.
  const [volunteers, setVolunteers] = useState([]);
  const [volLoading, setVolLoading] = useState(true);
  const [volError, setVolError] = useState("");
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await getVolunteers();
        if (!mounted) return;
        setVolunteers(list);
      } catch (err) {
        console.error("Failed to load volunteers:", err);
        if (mounted) setVolError("טעינת רשימת המתנדבים נכשלה");
      } finally {
        if (mounted) setVolLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  // Changing area resets neighborhood to avoid stale/invalid pairings.
  const setArea = (e) => setF({ ...f, area: e.target.value, neighborhood: "" });
  const setDigits = (k) => (e) => {
    const raw = e.target.value;
    const cleaned = raw.replace(/\D/g, "");
    setNumericWarn((w) => ({ ...w, [k]: raw !== cleaned }));
    setF({ ...f, [k]: cleaned });
  };


  const showVolName = f.volStatus === "כן" || f.volStatus === "לא מתאים";

  const handleSave = () => {
    const required = Object.keys(REQUIRED_LABELS).filter((k) => k !== "volName" || showVolName);
    const empty = required.filter((k) => !String(f[k] ?? "").trim());
    const dup = existingIds.some((x) => x.idNum === f.idNum && x.id !== (initial?.id));
    setMissing(empty);
    setIdDup(dup);
    if (empty.length || dup) return;
    onSave(f);
  };

  const NumericMsg = ({ k }) => numericWarn[k] ? (
    <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>ניתן להזין מספרים שלמים בלבד</div>
  ) : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 920 }}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {(missing.length > 0 || idDup) && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b",
            borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 14,
          }}>
            {missing.length > 0 && (
              <div>קיימים שדות חובה ריקים: {missing.map((k) => REQUIRED_LABELS[k]).join(", ")}</div>
            )}
            {idDup && <div>מספר ת.ז זה כבר קיים במערכת — אינו יכול לחזור על עצמו.</div>}
          </div>
        )}

        <div className="form-section">
          <h4>פרטים אישיים</h4>
          <div className="row row-2">
            <div className="field"><label>שם פרטי</label><input className="input" value={f.firstName} onChange={set("firstName")} /></div>
            <div className="field"><label>שם משפחה</label><input className="input" value={f.lastName} onChange={set("lastName")} /></div>
            <div className="field">
              <label>ת.ז</label>
              <input className="input" value={f.idNum} onChange={setDigits("idNum")} inputMode="numeric" />
              <NumericMsg k="idNum" />
            </div>
            <div className="field"><label>תאריך לידה</label><input className="input" type="text" value={f.birth} onChange={set("birth")} placeholder="DD/MM/YYYY" /></div>
            <div className="field">
              <label>מצב משפחתי</label>
              <select className="select" value={f.marital} onChange={set("marital")}>
                {MARITAL_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h4>פרטי קשר</h4>
          <div className="row row-2">
            <div className="field">
              <label>טלפון נייד</label>
              <input className="input" value={f.mobile} onChange={setDigits("mobile")} inputMode="numeric" />
              <NumericMsg k="mobile" />
            </div>
            <div className="field">
              <label>טלפון בית</label>
              <input className="input" value={f.homePhone} onChange={setDigits("homePhone")} inputMode="numeric" />
              <NumericMsg k="homePhone" />
            </div>
            <div className="field">
              <label>אזור</label>
              <select className="select" value={f.area || ""} onChange={setArea} disabled={areasLoading || areasEmpty}>
                <option value="">
                  {areasLoading ? "טוען אזורים..." : areasEmpty ? "לא נמצאו אזורים" : "בחר אזור"}
                </option>
                {areaNames.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              {areasError && <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>{areasError}</div>}
            </div>
            <div className="field">
              <label>שכונה</label>
              <select
                className="select"
                value={f.neighborhood || ""}
                onChange={set("neighborhood")}
                disabled={!f.area}
              >
                <option value="">{f.area ? "בחר שכונה" : "בחר אזור תחילה"}</option>
                {getNeighborhoods(f.area).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div className="field"><label>כתובת</label><input className="input" value={f.address} onChange={set("address")} /></div>
          </div>
        </div>

        <div className="form-section">
          <h4>איש קשר</h4>
          <div className="row row-2">
            <div className="field"><label>שם איש קשר</label><input className="input" value={f.contactName} onChange={set("contactName")} /></div>
            <div className="field">
              <label>טלפון איש קשר</label>
              <input className="input" value={f.contactPhone} onChange={setDigits("contactPhone")} inputMode="numeric" />
              <NumericMsg k="contactPhone" />
            </div>
            <div className="field"><label>תאריך יצירת קשר אחרונה</label><input className="input" type="date" value={f.lastContact} onChange={set("lastContact")} /></div>
          </div>
        </div>

        <div className="form-section">
          <h4>התנדבות</h4>
          <div className="row row-2">
            <div className="field">
              <label>סטטוס מתנדב</label>
              <select className="select" value={f.volStatus} onChange={set("volStatus")}>
                {VOLUNTEER_STATUS_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            {showVolName && (
              <div className="field">
                <label>שם מתנדב</label>
                <VolunteerSelect
                  volunteers={volunteers}
                  loading={volLoading}
                  error={volError}
                  valueId={f.volId}
                  valueName={f.volName}
                  onChange={(v) =>
                    setF({
                      ...f,
                      volId: v ? v.id : null,
                      volName: v ? `${v.firstName || ""} ${v.lastName || ""}`.trim() || v.name || "" : "",
                    })
                  }
                />
              </div>
            )}
            <div className="field"><label>סיוע</label><input className="input" value={f.assistance} onChange={set("assistance")} placeholder="לדוגמה: קשר חברתי, ליווי לרופא" /></div>
          </div>
        </div>

        <div className="form-section">
          <h4>רקע</h4>
          <div className="row row-2">
            <div className="field">
              <label>ארץ לידה</label>
              <select className="select" value={f.country} onChange={set("country")}>
                {COUNTRY_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="field">
              <label>שפת דיבור</label>
              <select className="select" value={f.language} onChange={set("language")}>
                {LANGUAGE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="field">
              <label>סטטוס</label>
              <select className="select" value={f.status} onChange={set("status")}>
                {STATUS_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label>פירוט חיים אישיים</label><textarea className="textarea" rows={2} value={f.bio} onChange={set("bio")} /></div>
          <div className="field"><label>הערות</label><textarea className="textarea" rows={2} value={f.notes} onChange={set("notes")} /></div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={handleSave}>שמירה</button>
          <button className="btn" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

/* ===== Volunteer quick info modal ===== */
function VolunteerQuickModal({ entry, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2>פרופיל מתנדב — {entry.volName}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="form-section">
          <div className="detail-grid">
            <div className="item"><label>שם מתנדב</label><div>{entry.volName}</div></div>
            <div className="item"><label>משויך ל</label><div>{fullName(entry)}</div></div>
            <div className="item"><label>אזור</label><div>{entry.area}</div></div>
            <div className="item"><label>שכונה</label><div>{entry.neighborhood}</div></div>
            <div className="item"><label>סטטוס שיוך</label><div>{entry.volStatus}</div></div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>סגירה</button>
        </div>
      </div>
    </div>
  );
}

/* ===== Print / report modal ===== */
function PrintReportModal({ items, onClose }) {
  const { areaNames, getNeighborhoods } = useAreasAndNeighborhoods();
  const [sel, setSel] = useState({ area: "", neighborhood: "", volStatus: "", marital: "", assistance: "" });
  const [showPreview, setShowPreview] = useState(false);

  const filtered = useMemo(
    () =>
      items.filter((e) => {
        if (sel.area && e.area !== sel.area) return false;
        if (sel.neighborhood && e.neighborhood !== sel.neighborhood) return false;
        if (sel.volStatus && e.volStatus !== sel.volStatus) return false;
        if (sel.marital && e.marital !== sel.marital) return false;
        if (sel.assistance && !(e.assistance || "").includes(sel.assistance)) return false;
        return true;
      }),
    [items, sel],
  );

  const setF = (k) => (e) => {
    const value = e.target.value;
    if (k === "area") {
      const validNb = getNeighborhoods(value).includes(sel.neighborhood);
      setSel({ ...sel, area: value, neighborhood: validNb ? sel.neighborhood : "" });
      return;
    }
    setSel({ ...sel, [k]: value });
  };


  const handleDownload = () => {
    const headers = ["שם", "ת.ז", "אזור", "שכונה", "טלפון", "סטטוס מתנדב", "מצב משפחתי", "סיוע", "סטטוס"];
    const rows = filtered.map((e) => [
      fullName(e), e.idNum, e.area, e.neighborhood,
      e.mobile || e.homePhone, e.volStatus, e.marital, e.assistance, e.status,
    ]);
    const csv =
      "\uFEFF" +
      [headers, ...rows]
        .map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(","))
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "elderly-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const filterDefs = [
    ["area", "אזור", areaNames],
    ["neighborhood", "שכונה", getNeighborhoods(sel.area)],
    ["volStatus", "סטטוס מתנדב", VOLUNTEER_STATUS_OPTIONS],
    ["marital", "מצב משפחתי", MARITAL_OPTIONS],
    ["assistance", "סיוע", ASSISTANCE_OPTIONS],
  ];


  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 980 }}>
        <div className="modal-header">
          <h2>הכנת דוח אזרחים ותיקים</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-section no-print">
          <h4>סינון לדוח</h4>
          <div className="filters-row">
            {filterDefs.map(([key, label, opts]) => (
              <select key={key} className="filter-pill" value={sel[key]} onChange={setF(key)}>
                <option value="">{label}</option>
                {opts.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ))}
          </div>
        </div>

        {showPreview && (
          <div className="form-section">
            <h4>תצוגה מקדימה ({filtered.length} אזרחים ותיקים)</h4>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>שם</th><th>אזור</th><th>שכונה</th><th>טלפון</th>
                    <th>סטטוס מתנדב</th><th>מצב משפחתי</th><th>סיוע</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={e.id}>
                      <td>{fullName(e)}</td>
                      <td>{e.area}</td>
                      <td>{e.neighborhood}</td>
                      <td>{e.mobile || e.homePhone || "—"}</td>
                      <td>{e.volStatus}</td>
                      <td>{e.marital}</td>
                      <td>{e.assistance || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="modal-actions no-print">
          <button className="btn btn-primary" onClick={() => setShowPreview(true)}>תצוגה מקדימה</button>
          <button className="btn" onClick={handleDownload}>הורדת דוח</button>
          <button className="btn" onClick={() => window.print()}>הדפסה</button>
          <button className="btn" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

/* ===== Searchable volunteer dropdown =====
   Loads from the volunteers collection (passed in via props). Lets the admin
   search by name/phone/neighborhood and pick "ללא מתנדב" to clear. */
function VolunteerSelect({ volunteers, loading, error, valueId, valueName, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const vName = (v) => `${v.firstName || ""} ${v.lastName || ""}`.trim() || v.name || "";
  const vPhone = (v) => v.mobile || v.phone || "";
  const vArea = (v) => v.neighborhood || v.area || "";
  const vStatus = (v) => v.status || "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return volunteers;
    return volunteers.filter((v) => {
      const hay = [vName(v), vPhone(v), vArea(v), vStatus(v)].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [volunteers, query]);

  const selected = valueId ? volunteers.find((v) => v.id === valueId) : null;
  const displayText = selected
    ? `${vName(selected)}${vPhone(selected) ? " — " + vPhone(selected) : ""}${vArea(selected) ? " — " + vArea(selected) : ""}`
    : valueName
      ? `${valueName} (לא ברשימה)`
      : "בחר/י מתנדב מהרשימה";

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="select"
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", textAlign: "start", cursor: "pointer", background: "#fff" }}
      >
        {loading ? "טוען מתנדבים…" : displayText}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            insetInlineStart: 0,
            insetInlineEnd: 0,
            zIndex: 50,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            boxShadow: "0 10px 30px rgba(0,0,0,.12)",
            maxHeight: 320,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
            <input
              className="input"
              autoFocus
              placeholder="חיפוש לפי שם, טלפון או שכונה…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div style={{ overflowY: "auto", maxHeight: 240 }}>
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); setQuery(""); }}
              style={optionStyle(!valueId)}
            >
              ללא מתנדב
            </button>

            {error && (
              <div style={{ padding: 12, color: "#b91c1c", fontSize: 13 }}>{error}</div>
            )}
            {!error && loading && (
              <div style={{ padding: 12, color: "#6b7280", fontSize: 13 }}>טוען מתנדבים…</div>
            )}
            {!error && !loading && filtered.length === 0 && (
              <div style={{ padding: 12, color: "#6b7280", fontSize: 13 }}>
                {volunteers.length === 0 ? "לא נמצאו מתנדבים במערכת" : "לא נמצאו תוצאות"}
              </div>
            )}
            {!loading && filtered.map((v) => {
              const isSel = v.id === valueId;
              const parts = [vName(v), vPhone(v), vArea(v), vStatus(v)].filter(Boolean);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => { onChange(v); setOpen(false); setQuery(""); }}
                  style={optionStyle(isSel)}
                >
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>{vName(v) || "—"}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {parts.slice(1).join(" — ") || "—"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function optionStyle(active) {
  return {
    display: "block",
    width: "100%",
    textAlign: "start",
    padding: "8px 12px",
    background: active ? "#eff6ff" : "transparent",
    border: "none",
    borderBottom: "1px solid #f8fafc",
    cursor: "pointer",
  };
}