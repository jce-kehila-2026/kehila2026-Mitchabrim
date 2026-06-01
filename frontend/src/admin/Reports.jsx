import AdminLayout from "@/components/admin/AdminLayout.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";

const REPORTS = [
  { title: "דוח אזרחים ותיקים", desc: "פילוח לפי שכונה, אזור וסטטוס", icon: "👵" },
  { title: "דוח מתנדבים", desc: "סטטוס, קבוצות, שיבוצים", icon: "🤝" },
  { title: "דוח פרויקטים", desc: "התקדמות, מסירות ובעיות", icon: "🎁" },
  { title: "דוח פרלמנטים", desc: "השתתפות ונוכחות", icon: "🏛️" },
  { title: "דוח כספי", desc: "הכנסות, הוצאות ותרומות", icon: "💰" },
  { title: "דוח בקשות הצטרפות", desc: "בקשות וטיפול", icon: "✉️" },
];

export default function Reports() {
  return (
    <AdminLayout title="דוחות" subtitle="נתונים וסטטיסטיקות מהמערכת">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {REPORTS.map((r) => (
          <div key={r.title} className="card">
            <div style={{ fontSize: 32, marginBottom: 10 }}>{r.icon}</div>
            <h4 style={{ fontSize: 17 }}>{r.title}</h4>
            <p style={{ color: "var(--color-text-muted)", fontSize: 14, margin: "6px 0 14px" }}>{r.desc}</p>
            <button className="btn btn-primary">פתיחת דוח</button>
          </div>
        ))}
      </div>

      <div style={{ height: 24 }} />
      <div className="row row-3">
        <SectionCard title="אזרחים ותיקים לפי שכונה">
          {["רחביה: 42", "גילה: 51", "בית הכרם: 28", "פסגת זאב: 36", "קטמון: 24"].map((l) => (
            <div key={l} className="list-item"><span>{l.split(":")[0]}</span><strong>{l.split(":")[1]}</strong></div>
          ))}
        </SectionCard>
        <SectionCard title="מתנדבים לפי סטטוס">
          {["פעילים: 138", "ממתינים לשיבוץ: 12", "לא פעילים: 6"].map((l) => (
            <div key={l} className="list-item"><span>{l.split(":")[0]}</span><strong>{l.split(":")[1]}</strong></div>
          ))}
        </SectionCard>
        <SectionCard title="פרויקטים לפי התקדמות">
          {["חנוכה 2025: 79%", "פסח 2026: 94%", "ראש השנה 2026: 0%"].map((l) => (
            <div key={l} className="list-item"><span>{l.split(":")[0]}</span><strong>{l.split(":")[1]}</strong></div>
          ))}
        </SectionCard>
      </div>
    </AdminLayout>
  );
}
