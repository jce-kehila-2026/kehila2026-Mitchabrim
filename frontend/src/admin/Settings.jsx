import AdminLayout from "@/components/admin/AdminLayout.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";

export default function Settings() {
  return (
    <AdminLayout title="הגדרות" subtitle="ניהול הגדרות המערכת">
      <SectionCard title="פרטי הארגון">
        <div className="row row-2">
          <div className="field"><label>שם הארגון</label><input className="input" defaultValue="מתחברים" /></div>
          <div className="field"><label>כתובת</label><input className="input" defaultValue="ירושלים" /></div>
          <div className="field"><label>טלפון</label><input className="input" defaultValue="02-0000000" /></div>
          <div className="field"><label>אימייל</label><input className="input" defaultValue="info@mitchabrim.org" /></div>
        </div>
        <button className="btn btn-primary">שמירה</button>
      </SectionCard>

      <SectionCard title="משתמשי מערכת">
        {[
          { name: "שרה כהן", role: "רכזת ראשית" },
          { name: "פנינה לוי", role: "רכזת מתנדבים" },
          { name: "שירה אברהם", role: "רכזת פרויקטים" },
        ].map((u) => (
          <div key={u.name} className="list-item">
            <div><div className="list-item-title">{u.name}</div><div className="list-item-sub">{u.role}</div></div>
            <button className="btn">עריכה</button>
          </div>
        ))}
      </SectionCard>

      <SectionCard title="אזורים ושכונות">
        <div className="row row-3">
          {[
            { area: "מרכז", n: ["רחביה", "קטמון", "טלביה"] },
            { area: "צפון", n: ["פסגת זאב", "רמות", "נווה יעקב"] },
            { area: "דרום", n: ["גילה", "ארנונה", "תלפיות"] },
            { area: "מערב", n: ["בית הכרם", "קריית יובל"] },
            { area: "מזרח", n: ["מעלות דפנה"] },
            { area: "מערב חדש", n: ["הר נוף"] },
            { area: "פסגות", n: ["מצפה נפתוח"] },
          ].map((a) => (
            <div key={a.area} className="card">
              <h4 style={{ fontSize: 15 }}>{a.area}</h4>
              <ul style={{ paddingInlineStart: 18, color: "var(--color-text-muted)", marginTop: 8 }}>
                {a.n.map((nb) => <li key={nb}>{nb}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="קטגוריות">
        <div className="row row-2">
          <div>
            <h4 style={{ fontSize: 14, marginBottom: 8 }}>תמונות</h4>
            {["פרלמנטים", "מתנדבים", "חגים", "שיווק", "כרטיסי ברכה"].map((c) => <span key={c} className="badge" style={{ marginInlineEnd: 6 }}>{c}</span>)}
          </div>
          <div>
            <h4 style={{ fontSize: 14, marginBottom: 8 }}>קישורים</h4>
            {["מתנדבים", "ביטוח", "הדרכה", "מקורות"].map((c) => <span key={c} className="badge" style={{ marginInlineEnd: 6 }}>{c}</span>)}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="גיבוי נתונים">
        <p>גיבוי אחרון: 28.05.2026 • הצליח</p>
        <div style={{ marginTop: 12 }}><button className="btn btn-primary">הפעל גיבוי</button></div>
      </SectionCard>
    </AdminLayout>
  );
}
