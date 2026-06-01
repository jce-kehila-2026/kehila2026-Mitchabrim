import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout.jsx";
import StatsCard from "@/components/admin/StatsCard.jsx";
import SearchFilters from "@/components/admin/SearchFilters.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import DataTable from "@/components/admin/DataTable.jsx";

const VOLUNTEERS = [
  { name: "דניאלה כץ", phone: "052-1111111", area: "רחביה / מרכז", type: "סטודנט", group: "כפר סטודנטים", assigned: "מרים לוי", insurance: "כן", start: "01.06.2024", status: "פעיל", rating: "★★★★★" },
  { name: "אורי שפירא", phone: "054-2222222", area: "גילה / דרום", type: "תלמיד", group: "בית ספר גילה", assigned: "ממתין לשיבוץ", insurance: "כן", start: "10.10.2025", status: "ממתין לשיבוץ", rating: "—" },
  { name: "תמר גולן", phone: "050-3333333", area: "בית הכרם / מערב", type: "עצמאי", group: "ללא קבוצה", assigned: "יוסף ברקוביץ", insurance: "לא", start: "15.03.2025", status: "פעיל", rating: "★★★★" },
  { name: "נועם לב", phone: "053-4444444", area: "פסגת זאב / צפון", type: "ארגון", group: "חברת חשמל", assigned: "פרויקט חנוכה 2025", insurance: "כן", start: "01.12.2024", status: "פעיל", rating: "★★★★" },
  { name: "מיכל בן־דוד", phone: "058-5555555", area: "גילה / דרום", type: "תרבות", group: "עמותה מקומית", assigned: "פרלמנט גילה", insurance: "כן", start: "20.09.2025", status: "פעיל", rating: "★★★★★" },
];

const statusBadge = (s) => s === "פעיל" ? "badge-green" : s === "ממתין לשיבוץ" ? "badge-orange" : "badge-gray";
const insBadge = (i) => i === "כן" ? "badge-green" : "badge-orange";

export default function Volunteers() {
  const [showModal, setShowModal] = useState(false);
  return (
    <AdminLayout
      title="ניהול מתנדבים"
      subtitle="ניהול מתנדבים, קבוצות התנדבות, שיוך לאזרחים ותיקים, סטטוס פעילות וביטוח."
      actions={
        <>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ הוספת מתנדב</button>
          <button className="btn">ייצוא</button>
          <button className="btn">הדפסת רשימה</button>
        </>
      }
    >
      <div className="stats-grid">
        <StatsCard icon="🤝" title="סה״כ מתנדבים" value="156" />
        <StatsCard icon="✅" title="פעילים" value="138" />
        <StatsCard icon="⏳" title="ממתינים לשיבוץ" value="12" />
        <StatsCard icon="⏸️" title="לא פעילים" value="6" />
      </div>

      <SectionCard>
        <SearchFilters
          searchPlaceholder="חיפוש לפי שם, טלפון, קבוצה, שכונה או אזרח ותיק משויך..."
          filters={[
            { label: "אזור", options: ["מרכז", "צפון", "דרום", "מערב"] },
            { label: "סטטוס", options: ["פעיל", "ממתין לשיבוץ", "לא פעיל"] },
            { label: "זמינות", options: ["בוקר", "צהריים", "ערב"] },
            { label: "סוג מתנדב", options: ["סטודנט", "תלמיד", "עצמאי", "ארגון", "תרבות"] },
            { label: "קבוצה", options: ["חברת חשמל", "בית ספר גילה", "כפר סטודנטים"] },
            { label: "ביטוח", options: ["כן", "לא"] },
          ]}
        />
        <DataTable
          columns={[
            { key: "name", label: "שם" },
            { key: "phone", label: "טלפון" },
            { key: "area", label: "שכונה / אזור" },
            { key: "type", label: "סוג מתנדב", render: (r) => <span className="badge">{r.type}</span> },
            { key: "group", label: "קבוצה" },
            { key: "assigned", label: "משויך ל" },
            { key: "insurance", label: "ביטוח", render: (r) => <span className={`badge ${insBadge(r.insurance)}`}>{r.insurance}</span> },
            { key: "start", label: "תאריך התחלה" },
            { key: "status", label: "סטטוס", render: (r) => <span className={`badge ${statusBadge(r.status)}`}>{r.status}</span> },
            { key: "rating", label: "דירוג" },
            { key: "actions", label: "פעולות", render: () => (<><button>צפייה</button><button>עריכה</button></>) },
          ]}
          data={VOLUNTEERS}
        />
      </SectionCard>

      {showModal && <AddVolunteerModal onClose={() => setShowModal(false)} />}
    </AdminLayout>
  );
}

function AddVolunteerModal({ onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>הוספת מתנדב</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="form-section">
          <h4>פרטים אישיים</h4>
          <div className="row row-2">
            {["שם פרטי", "שם משפחה", "ת.ז", "טלפון", "כתובת", "שכונה", "אזור"].map((f) => (
              <div key={f} className="field"><label>{f}</label><input className="input" /></div>
            ))}
          </div>
        </div>
        <div className="form-section">
          <h4>פרטי התנדבות</h4>
          <div className="row row-2">
            <div className="field"><label>סוג מתנדב</label>
              <select className="select"><option>סטודנט</option><option>תלמיד</option><option>עצמאי</option><option>ארגון</option><option>תרבות</option><option>אחר</option></select></div>
            <div className="field"><label>סטטוס</label>
              <select className="select"><option>פעיל</option><option>ממתין לשיבוץ</option><option>לא פעיל</option></select></div>
            <div className="field"><label>תאריך תחילת התנדבות</label><input className="input" type="date" /></div>
            <div className="field"><label>תאריך סיום (אם לא פעיל)</label><input className="input" type="date" /></div>
            <div className="field"><label>זמינות</label><input className="input" /></div>
          </div>
          <div className="field"><label>הערות</label><textarea className="textarea" rows={2} /></div>
        </div>
        <div className="form-section">
          <h4>שיוך</h4>
          <div className="row row-2">
            {["קבוצה / גוף התנדבות", "עם מי מתנדב", "אזרח ותיק משויך", "פרויקט משויך", "פרלמנט משויך"].map((f) => (
              <div key={f} className="field"><label>{f}</label><input className="input" /></div>
            ))}
          </div>
        </div>
        <div className="form-section">
          <h4>ביטוח</h4>
          <div className="row row-2">
            <div className="field"><label>ביטוח</label><select className="select"><option>כן</option><option>לא</option></select></div>
            <div className="field"><label>תאריך עדכון ביטוח</label><input className="input" type="date" /></div>
          </div>
          <div className="field"><label>הערות ביטוח</label><textarea className="textarea" rows={2} /></div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>שמירה</button>
          <button className="btn" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}
