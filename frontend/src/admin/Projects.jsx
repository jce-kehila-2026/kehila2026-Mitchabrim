import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout.jsx";
import StatsCard from "@/components/admin/StatsCard.jsx";
import SearchFilters from "@/components/admin/SearchFilters.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import DataTable from "@/components/admin/DataTable.jsx";

const PROJECTS = [
  { id: 1, name: "חלוקת חבילות חנוכה", holiday: "חנוכה", year: 2025, date: "12.12.2025", elderly: 120, assigned: 110, delivered: 95, issues: 8, status: "פעיל" },
  { id: 2, name: "שי לפסח", holiday: "פסח", year: 2026, date: "01.04.2026", elderly: 140, assigned: 130, delivered: 122, issues: 4, status: "בהכנה" },
  { id: 3, name: "ראש השנה בקהילה", holiday: "ראש השנה", year: 2026, date: "10.09.2026", elderly: 160, assigned: 150, delivered: 0, issues: 0, status: "מתוכנן" },
];

const DISTRIBUTION = [
  { n: 1, last: "לוי", first: "מרים", phone: "052-1234567", address: "הרצוג 12", neigh: "רחביה", area: "מרכז", eligible: "כן", vol: "דניאלה כץ", type: "פרטי", delivery: "נמסר", notes: "" },
  { n: 2, last: "ברקוביץ", first: "יוסף", phone: "054-9876543", address: "הפלמ\"ח 8", neigh: "גילה", area: "דרום", eligible: "כן", vol: "חברת חשמל", type: "קבוצה", delivery: "ממתין למסירה", notes: "להתקשר לפני הגעה" },
  { n: 3, last: "שטרן", first: "חנה", phone: "050-1112222", address: "החלוץ 4", neigh: "בית הכרם", area: "מערב", eligible: "כן", vol: "בית ספר גילה", type: "קבוצה", delivery: "נמסר", notes: "" },
  { n: 4, last: "כהן", first: "אברהם", phone: "053-3334444", address: "מבוא 2", neigh: "פסגת זאב", area: "צפון", eligible: "לא", vol: "ללא שיבוץ", type: "ללא שיבוץ", delivery: "ממתין למסירה", notes: "ביקש לא לקבל חבילה" },
  { n: 5, last: "אדרי", first: "רבקה", phone: "052-5556666", address: "התקווה 1", neigh: "קטמון", area: "מרכז", eligible: "כן", vol: "ללא שיבוץ", type: "ללא שיבוץ", delivery: "בעיה פתוחה", notes: "אין מתנדב משובץ" },
];

const projectStatus = (s) => s === "פעיל" ? "badge-green" : s === "בהכנה" ? "badge-orange" : s === "הסתיים" ? "badge-gray" : s === "בוטל" ? "badge-red" : "";
const typeBadge = (t) => t === "פרטי" ? "" : t === "קבוצה" ? "badge-orange" : "badge-gray";
const deliveryBadge = (d) => d === "נמסר" ? "badge-green" : d === "בעיה פתוחה" ? "badge-red" : "badge-orange";

export default function Projects() {
  const [view, setView] = useState("list");
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  const openProject = (p) => { setSelected(p); setView("detail"); };

  if (view === "detail" && selected) {
    return <ProjectDetail project={selected} onBack={() => setView("list")} />;
  }

  return (
    <AdminLayout
      title="ניהול פרויקטי חגים"
      subtitle="ניהול חלוקת חבילות ושי לחג, שיבוץ אזרחים ותיקים למתנדבים, מעקב מסירה והפקת רשימות לקבוצות."
      actions={
        <>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ הוספת פרויקט</button>
          <button className="btn">ייצוא</button>
          <button className="btn">הדפסת רשימה</button>
          <button className="btn">רשימות לפי קבוצות</button>
        </>
      }
    >
      <div className="stats-grid">
        <StatsCard icon="🎁" title="פרויקטים פעילים" value="3" />
        <StatsCard icon="👵" title="אזרחים ותיקים בפרויקט" value="420" />
        <StatsCard icon="🤝" title="שובצו" value="390" />
        <StatsCard icon="📦" title="נמסרו" value="217" />
      </div>

      <SectionCard>
        <SearchFilters
          searchPlaceholder="חיפוש לפי שם פרויקט, חג, שנה, אזרח ותיק, מתנדב או קבוצה..."
          filters={[
            { label: "חג", options: ["חנוכה", "פסח", "ראש השנה"] },
            { label: "שנה", options: ["2025", "2026"] },
            { label: "סטטוס פרויקט", options: ["מתוכנן", "בהכנה", "פעיל", "הסתיים"] },
            { label: "אזור", options: ["מרכז", "צפון", "דרום", "מערב"] },
            { label: "סטטוס מסירה", options: ["ממתין למסירה", "נמסר", "בעיה פתוחה"] },
          ]}
        />
        <DataTable
          columns={[
            { key: "name", label: "שם הפרויקט" },
            { key: "holiday", label: "חג" },
            { key: "year", label: "שנה" },
            { key: "date", label: "תאריך חלוקה" },
            { key: "elderly", label: "מספר א.ו." },
            { key: "assigned", label: "שובצו" },
            { key: "delivered", label: "נמסרו" },
            { key: "issues", label: "בעיות" },
            { key: "status", label: "סטטוס", render: (r) => <span className={`badge ${projectStatus(r.status)}`}>{r.status}</span> },
            { key: "actions", label: "פעולות", render: (r) => (
              <>
                <button onClick={() => openProject(r)}>צפייה</button>
                <button>עריכה</button>
                <button onClick={() => openProject(r)}>ניהול חלוקה</button>
              </>
            )},
          ]}
          data={PROJECTS}
        />
      </SectionCard>

      {showAdd && <AddProjectModal onClose={() => setShowAdd(false)} />}
    </AdminLayout>
  );
}

function ProjectDetail({ project, onBack }) {
  const [tab, setTab] = useState("dist");
  return (
    <AdminLayout title={project.name} subtitle={`${project.holiday} • ${project.year} • תאריך חלוקה: ${project.date}`}>
      <button className="back-link" onClick={onBack}>→ חזרה לפרויקטים</button>
      <div className="stats-grid">
        <StatsCard icon="👵" title="אזרחים ותיקים" value={project.elderly} />
        <StatsCard icon="🤝" title="שובצו" value={project.assigned} />
        <StatsCard icon="📦" title="נמסרו" value={project.delivered} />
        <StatsCard icon="⚠️" title="בעיות" value={project.issues} />
      </div>

      <div className="tabs">
        <button className={tab === "dist" ? "active" : ""} onClick={() => setTab("dist")}>ניהול חלוקה</button>
        <button className={tab === "groups" ? "active" : ""} onClick={() => setTab("groups")}>רשימות לפי קבוצות</button>
        <button className={tab === "partners" ? "active" : ""} onClick={() => setTab("partners")}>שותפים ואנשי קשר</button>
      </div>

      {tab === "dist" && (
        <SectionCard title="טבלת חלוקה">
          <DataTable
            columns={[
              { key: "n", label: "מס׳" },
              { key: "last", label: "שם משפחה" },
              { key: "first", label: "שם פרטי" },
              { key: "phone", label: "טלפון" },
              { key: "address", label: "כתובת" },
              { key: "neigh", label: "שכונה" },
              { key: "area", label: "אזור" },
              { key: "eligible", label: "יקבל חבילה", render: (r) => <span className={`badge ${r.eligible === "כן" ? "badge-green" : "badge-gray"}`}>{r.eligible}</span> },
              { key: "vol", label: "מתנדב / קבוצה" },
              { key: "type", label: "סוג שיבוץ", render: (r) => <span className={`badge ${typeBadge(r.type)}`}>{r.type}</span> },
              { key: "delivery", label: "סטטוס מסירה", render: (r) => <span className={`badge ${deliveryBadge(r.delivery)}`}>{r.delivery}</span> },
              { key: "notes", label: "בעיות / הערות" },
              { key: "actions", label: "פעולות", render: () => (<><button>עריכה</button></>) },
            ]}
            data={DISTRIBUTION}
          />
        </SectionCard>
      )}

      {tab === "groups" && (
        <>
          {["חברת חשמל", "בית ספר גילה", "כפר סטודנטים", "מתנדבים פרטיים"].map((g) => (
            <SectionCard key={g} title={g}
              actions={<><button className="btn">ייצוא לקבוצה</button><button className="btn">הדפסה לקבוצה</button></>}>
              <DataTable
                columns={[
                  { key: "n", label: "מס׳" },
                  { key: "name", label: "שם מלא" },
                  { key: "phone", label: "טלפון" },
                  { key: "address", label: "כתובת" },
                  { key: "neigh", label: "שכונה" },
                  { key: "notes", label: "הערות" },
                ]}
                data={DISTRIBUTION.filter((d) => d.vol === g || (g === "מתנדבים פרטיים" && d.type === "פרטי")).map((d, i) => ({
                  n: i + 1, name: `${d.first} ${d.last}`, phone: d.phone, address: d.address, neigh: d.neigh, notes: d.notes,
                }))}
              />
            </SectionCard>
          ))}
        </>
      )}

      {tab === "partners" && (
        <SectionCard title="שותפים ואנשי קשר">
          <DataTable
            columns={[
              { key: "org", label: "שם גוף ההתנדבות" },
              { key: "contact", label: "איש קשר" },
              { key: "phone", label: "טלפון" },
              { key: "email", label: "מייל" },
              { key: "role", label: "תפקיד / הערות" },
            ]}
            data={[
              { org: "חברת חשמל", contact: "נועם לב", phone: "053-4444444", email: "noam@iec.co.il", role: "רכז התנדבות" },
              { org: "בית ספר גילה", contact: "מר לוי", phone: "02-6789012", email: "school@gilo.k12.il", role: "מורה אחראי" },
            ]}
          />
        </SectionCard>
      )}
    </AdminLayout>
  );
}

function AddProjectModal({ onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>הוספת פרויקט</h2><button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="form-section">
          <h4>פרטי פרויקט</h4>
          <div className="field"><label>שם הפרויקט</label><input className="input" /></div>
          <div className="row row-2">
            <div className="field"><label>חג</label><select className="select"><option>חנוכה</option><option>פסח</option><option>ראש השנה</option><option>אחר</option></select></div>
            <div className="field"><label>שנה</label><input className="input" type="number" defaultValue="2026" /></div>
            <div className="field"><label>תאריך התחלה</label><input className="input" type="date" /></div>
            <div className="field"><label>תאריך חלוקה</label><input className="input" type="date" /></div>
            <div className="field"><label>סטטוס</label><select className="select"><option>מתוכנן</option><option>בהכנה</option><option>פעיל</option><option>הסתיים</option><option>בוטל</option></select></div>
          </div>
          <div className="field"><label>הערות</label><textarea className="textarea" rows={2} /></div>
        </div>
        <div className="form-section">
          <h4>אוכלוסיית יעד</h4>
          <div className="row row-2">
            <div className="field"><label>סינון לפי אזור</label><select className="select"><option>כל האזורים</option><option>מרכז</option><option>צפון</option></select></div>
            <div className="field"><label>סינון לפי שכונה</label><select className="select"><option>כל השכונות</option></select></div>
          </div>
          <div className="field"><label><input type="checkbox" /> בחירת כל האזרחים הוותיקים מהמערכת</label></div>
        </div>
        <div className="form-section">
          <h4>שותפים ומתנדבים</h4>
          <div className="field"><label>קבוצות מתנדבים</label>
            <select className="select" multiple><option>חברת חשמל</option><option>בית ספר גילה</option><option>כפר סטודנטים</option><option>אוניברסיטה</option><option>עמותה מקומית</option></select></div>
          <div className="field"><label>מתנדבים יחידים</label>
            <select className="select" multiple><option>דניאלה כץ</option><option>תמר גולן</option><option>מיכל בן־דוד</option></select></div>
          <div className="field"><label>הערות לשותפים</label><textarea className="textarea" rows={2} /></div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>שמירה</button>
          <button className="btn" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}
