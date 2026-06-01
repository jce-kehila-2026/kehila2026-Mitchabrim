import { useState } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout.jsx";
import StatsCard from "@/components/admin/StatsCard.jsx";
import SearchFilters from "@/components/admin/SearchFilters.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import DataTable from "@/components/admin/DataTable.jsx";

const ELDERLY = [
  { id: 1, name: "מרים לוי", neighborhood: "רחביה", area: "מרכז", phone: "052-1234567", vol: "מחובר", parl: "פרלמנט רחביה", status: "פעיל", notes: "קשר טוב, מתנדבת מבקרת שבועית" },
  { id: 2, name: "יוסף ברקוביץ", neighborhood: "גילה", area: "דרום", phone: "054-9876543", vol: "לא מחובר", parl: "—", status: "פעיל", notes: "ממתין לשיבוץ" },
  { id: 3, name: "חנה שטרן", neighborhood: "בית הכרם", area: "מערב", phone: "050-1112222", vol: "מחובר", parl: "פרלמנט בית הכרם", status: "פעיל", notes: "" },
  { id: 4, name: "אברהם כהן", neighborhood: "פסגת זאב", area: "צפון", phone: "053-3334444", vol: "לא רוצה", parl: "—", status: "פעיל", notes: "ביקש להישאר ללא קשר" },
  { id: 5, name: "רבקה אדרי", neighborhood: "קטמון", area: "מרכז", phone: "052-5556666", vol: "לא מתאים", parl: "פרלמנט קטמון", status: "פעיל", notes: "מצב בריאותי מורכב" },
  { id: 6, name: "שלמה דהן", neighborhood: "רמות", area: "צפון", phone: "—", vol: "לא מחובר", parl: "—", status: "נפטר", notes: "" },
];

const volBadge = (v) => v === "מחובר" ? "badge-green" : v === "לא מתאים" || v === "לא רוצה" ? "badge-orange" : "";
const statusBadge = (s) => s === "פעיל" ? "badge-green" : "badge-gray";

export default function Elderly() {
  const [showModal, setShowModal] = useState(false);
  return (
    <AdminLayout
      title="ניהול אזרחים ותיקים"
      subtitle="ניהול רשימת האזרחים הוותיקים, שיוך לאזורים ושכונות, סטטוס התנדבות, פרלמנטים ופרטים אישיים."
      actions={
        <>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ הוספת אזרח ותיק</button>
          <button className="btn">ייצוא</button>
          <button className="btn">הדפסת רשימה</button>
        </>
      }
    >
      <div className="stats-grid">
        <StatsCard icon="👵" title="סה״כ אזרחים ותיקים" value="270" />
        <StatsCard icon="🤝" title="מחוברים למתנדב" value="184" />
        <StatsCard icon="⏳" title="ללא מתנדב" value="62" />
        <StatsCard icon="🏛️" title="משתתפים בפרלמנט" value="98" />
      </div>

      <SectionCard>
        <SearchFilters
          searchPlaceholder="חיפוש לפי שם, טלפון, ת.ז, שכונה או הערות..."
          filters={[
            { label: "אזור", options: ["מרכז", "צפון", "דרום", "מערב", "מזרח", "מערב חדש", "פסגות"] },
            { label: "שכונה", options: ["רחביה", "גילה", "בית הכרם", "פסגת זאב", "קטמון", "רמות"] },
            { label: "סטטוס מתנדב", options: ["מחובר", "לא מחובר", "לא מתאים", "לא רוצה"] },
            { label: "קבוצת גיל", options: ["65-75", "75-85", "85+"] },
            { label: "סטטוס", options: ["פעיל", "נפטר", "לא פעיל"] },
            { label: "פרלמנט", options: ["פרלמנט רחביה", "פרלמנט גילה", "פרלמנט בית הכרם"] },
          ]}
        />
        <DataTable
          columns={[
            { key: "name", label: "שם" },
            { key: "neighborhood", label: "שכונה" },
            { key: "area", label: "אזור" },
            { key: "phone", label: "טלפון" },
            { key: "vol", label: "סטטוס מתנדב", render: (r) => <span className={`badge ${volBadge(r.vol)}`}>{r.vol}</span> },
            { key: "parl", label: "פרלמנט" },
            { key: "status", label: "מצב", render: (r) => <span className={`badge ${statusBadge(r.status)}`}>{r.status}</span> },
            { key: "notes", label: "הערות" },
            { key: "actions", label: "פעולות", render: (r) => (
              <>
                <Link to={`/admin/elderly/${r.id}`}>צפייה</Link>
                <button>עריכה</button>
              </>
            )},
          ]}
          data={ELDERLY}
        />
      </SectionCard>

      {showModal && <AddElderlyModal onClose={() => setShowModal(false)} />}
    </AdminLayout>
  );
}

function AddElderlyModal({ onClose }) {
  const sections = [
    { title: "שיוך גיאוגרפי", fields: ["אזור", "שכונה", "כתובת"] },
    { title: "פרטים מזהים", fields: ["שם פרטי", "שם משפחה", "ת.ז", "תאריך לידה"] },
    { title: "פרטי קשר", fields: ["טלפון בית", "טלפון נייד"] },
    { title: "איש קשר", fields: ["שם איש קשר", "טלפון איש קשר", "תאריך יצירת קשר"] },
  ];
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>הוספת אזרח ותיק</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {sections.map((s) => (
          <div key={s.title} className="form-section">
            <h4>{s.title}</h4>
            <div className="row row-2">
              {s.fields.map((f) => (
                <div key={f} className="field"><label>{f}</label><input className="input" /></div>
              ))}
            </div>
          </div>
        ))}
        <div className="form-section">
          <h4>התנדבות</h4>
          <div className="row row-2">
            <div className="field"><label>סטטוס מתנדב</label>
              <select className="select"><option>כן</option><option>לא</option><option>לא מתאים</option><option>לא רוצה</option></select>
            </div>
            <div className="field"><label>שם מתנדב</label><input className="input" placeholder="אם רלוונטי" /></div>
          </div>
        </div>
        <div className="form-section">
          <h4>רקע וצרכים</h4>
          <div className="row row-2">
            {["סיוע", "מצב משפחתי", "ארץ לידה", "שפת דיבור", "הגדרה דתית"].map((f) => (
              <div key={f} className="field"><label>{f}</label><input className="input" /></div>
            ))}
          </div>
          <div className="field"><label>פירוט חיים אישיים</label><textarea className="textarea" rows={2} /></div>
          <div className="field"><label>הערות</label><textarea className="textarea" rows={2} /></div>
        </div>
        <div className="form-section">
          <h4>פרלמנט וסטטוס</h4>
          <div className="row row-2">
            <div className="field"><label>פרלמנט</label><input className="input" /></div>
            <div className="field"><label>סטטוס</label>
              <select className="select"><option>פעיל</option><option>נפטר</option><option>לא פעיל</option></select>
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>שמירה</button>
          <button className="btn" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}
