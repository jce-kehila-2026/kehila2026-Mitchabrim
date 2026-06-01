import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout.jsx";
import StatsCard from "@/components/admin/StatsCard.jsx";
import SearchFilters from "@/components/admin/SearchFilters.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import DataTable from "@/components/admin/DataTable.jsx";

const PARLIAMENTS = [
  { id: 1, name: "פרלמנט רחביה", location: "מרכז קהילתי רחביה", area: "מרכז", coordinator: "פנינה לוי", members: 18, nextDate: "05.06.2026", status: "פעיל" },
  { id: 2, name: "פרלמנט גילה", location: "מתנ\"ס גילה", area: "דרום", coordinator: "שירה אברהם", members: 22, nextDate: "08.06.2026", status: "פעיל" },
  { id: 3, name: "פרלמנט בית הכרם", location: "בית הכנסת המרכזי", area: "מערב", coordinator: "פנינה לוי", members: 16, nextDate: "12.06.2026", status: "פעיל" },
  { id: 4, name: "פרלמנט קטמון", location: "מועדון קטמון", area: "מרכז", coordinator: "שרה כהן", members: 14, nextDate: "—", status: "בהכנה" },
  { id: 5, name: "פרלמנט פסגת זאב", location: "מתנ\"ס פסגת זאב", area: "צפון", coordinator: "שירה אברהם", members: 16, nextDate: "20.06.2026", status: "פעיל" },
];

const PARTICIPANTS = [
  { n: 1, last: "לוי", first: "מרים", phone: "052-1234567", address: "הרצוג 12", neigh: "רחביה", area: "מרכז", type: "פרטי", confirmed: "כן", attendance: "—", notes: "" },
  { n: 2, last: "ברקוביץ", first: "יוסף", phone: "054-9876543", address: "הפלמ\"ח 8", neigh: "רחביה", area: "מרכז", type: "פרטי", confirmed: "ממתין", attendance: "—", notes: "לא ענה" },
  { n: 3, last: "שטרן", first: "חנה", phone: "050-1112222", address: "החלוץ 4", neigh: "רחביה", area: "מרכז", type: "פרטי", confirmed: "כן", attendance: "—", notes: "צריכה הסעה" },
];

const statusBadge = (s) => s === "פעיל" ? "badge-green" : s === "בהכנה" ? "badge-orange" : "badge-gray";

export default function Parliaments() {
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  if (selected) return <ParliamentDetail parl={selected} onBack={() => setSelected(null)} />;

  return (
    <AdminLayout
      title="פרלמנטים"
      subtitle="ניהול מפגשי פרלמנט, משתתפים ונוכחות"
      actions={
        <>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ הוספת פרלמנט</button>
          <button className="btn">ייצוא</button>
          <button className="btn">הדפסת רשימה</button>
        </>
      }
    >
      <div className="stats-grid">
        <StatsCard icon="🏛️" title="סה״כ פרלמנטים" value="5" />
        <StatsCard icon="✅" title="פרלמנטים פעילים" value="4" />
        <StatsCard icon="👥" title="משתתפים רשומים" value="86" />
        <StatsCard icon="📅" title="מפגשים החודש" value="12" />
      </div>

      <SectionCard title="רשימת פרלמנטים">
        <SearchFilters
          searchPlaceholder="חיפוש לפי שם פרלמנט, מיקום או מלווה..."
          filters={[
            { label: "אזור", options: ["מרכז", "צפון", "דרום", "מערב"] },
            { label: "סטטוס", options: ["פעיל", "בהכנה", "הסתיים"] },
            { label: "מלווה", options: ["פנינה לוי", "שירה אברהם", "שרה כהן"] },
            { label: "חודש מפגש", options: ["יוני", "יולי", "אוגוסט"] },
          ]}
        />
        <DataTable
          columns={[
            { key: "name", label: "שם פרלמנט" },
            { key: "location", label: "מיקום" },
            { key: "area", label: "אזור" },
            { key: "coordinator", label: "מלווה" },
            { key: "members", label: "משתתפים" },
            { key: "nextDate", label: "מפגש הבא" },
            { key: "status", label: "סטטוס", render: (r) => <span className={`badge ${statusBadge(r.status)}`}>{r.status}</span> },
            { key: "actions", label: "פעולות", render: (r) => (
              <><button>צפייה</button><button>עריכה</button><button onClick={() => setSelected(r)}>ניהול פרלמנט</button></>
            )},
          ]}
          data={PARLIAMENTS}
        />
      </SectionCard>

      {showAdd && <AddParliamentModal onClose={() => setShowAdd(false)} />}
    </AdminLayout>
  );
}

function ParliamentDetail({ parl, onBack }) {
  const [tab, setTab] = useState("participants");
  return (
    <AdminLayout title={parl.name} subtitle={`${parl.location} • מפגש הבא: ${parl.nextDate}`}>
      <button className="back-link" onClick={onBack}>→ חזרה לפרלמנטים</button>
      <div className="stats-grid">
        <StatsCard icon="👥" title="משתתפים" value="18" />
        <StatsCard icon="✅" title="אישרו הגעה" value="12" />
        <StatsCard icon="⏳" title="ממתינים לאישור" value="4" />
        <StatsCard icon="⚠️" title="בעיות פתוחות" value="2" />
      </div>

      <div className="tabs">
        <button className={tab === "participants" ? "active" : ""} onClick={() => setTab("participants")}>רשימת משתתפים</button>
        <button className={tab === "attendance" ? "active" : ""} onClick={() => setTab("attendance")}>מעקב נוכחות</button>
      </div>

      {tab === "participants" && (
        <SectionCard>
          <DataTable
            columns={[
              { key: "n", label: "מס׳" },
              { key: "last", label: "שם משפחה" },
              { key: "first", label: "שם פרטי" },
              { key: "phone", label: "טלפון" },
              { key: "address", label: "כתובת" },
              { key: "neigh", label: "שכונה" },
              { key: "area", label: "אזור" },
              { key: "type", label: "סוג שיבוץ" },
              { key: "confirmed", label: "אישר הגעה" },
              { key: "attendance", label: "סטטוס נוכחות" },
              { key: "notes", label: "הערות" },
            ]}
            data={PARTICIPANTS}
          />
        </SectionCard>
      )}
      {tab === "attendance" && (
        <SectionCard>
          <DataTable
            columns={[
              { key: "name", label: "שם אזרח ותיק" },
              { key: "phone", label: "טלפון" },
              { key: "called", label: "ניסינו להתקשר" },
              { key: "confirmed", label: "אישר הגעה" },
              { key: "arrived", label: "הגיע בפועל" },
              { key: "notes", label: "הערות" },
            ]}
            data={PARTICIPANTS.map((p) => ({
              name: `${p.first} ${p.last}`, phone: p.phone, called: "כן", confirmed: p.confirmed, arrived: "—", notes: p.notes,
            }))}
          />
        </SectionCard>
      )}
    </AdminLayout>
  );
}

function AddParliamentModal({ onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h2>הוספת פרלמנט</h2><button className="modal-close" onClick={onClose}>×</button></div>
        <div className="row row-2">
          <div className="field"><label>שם פרלמנט</label><input className="input" /></div>
          <div className="field"><label>מיקום</label><input className="input" /></div>
          <div className="field"><label>אזור</label><input className="input" /></div>
          <div className="field"><label>מלווה / רכז אחראי</label><input className="input" /></div>
          <div className="field"><label>תאריך מפגש הבא</label><input className="input" type="date" /></div>
          <div className="field"><label>שעת מפגש</label><input className="input" type="time" /></div>
          <div className="field"><label>סטטוס</label><select className="select"><option>פעיל</option><option>בהכנה</option><option>הסתיים</option></select></div>
        </div>
        <div className="field"><label>הערות</label><textarea className="textarea" rows={3} /></div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>שמירה</button>
          <button className="btn" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}
