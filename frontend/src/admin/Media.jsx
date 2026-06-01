import AdminLayout from "@/components/admin/AdminLayout.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";

const CATEGORIES = ["הכל", "פרלמנטים", "מתנדבים", "חגים", "שיווק", "כרטיסי ברכה"];
const IMAGES = [
  { title: "מפגש פרלמנט רחביה", cat: "פרלמנטים", date: "10.05.2026" },
  { title: "חלוקת חבילות חנוכה", cat: "חגים", date: "12.12.2025" },
  { title: "כנס מתנדבים שנתי", cat: "מתנדבים", date: "01.01.2026" },
  { title: "כרטיס ברכה לראש השנה", cat: "כרטיסי ברכה", date: "01.09.2025" },
  { title: "פוסט קמפיין הצטרפות", cat: "שיווק", date: "15.04.2026" },
  { title: "פרלמנט גילה - מפגש שנתי", cat: "פרלמנטים", date: "20.03.2026" },
];

export default function Media() {
  return (
    <AdminLayout
      title="מאגר תמונות"
      subtitle="ניהול תמונות לפי נושאים"
      actions={<button className="btn btn-primary">+ העלאת תמונה</button>}
    >
      <SectionCard>
        <div className="search-filters">
          {CATEGORIES.map((c) => (
            <button key={c} className="btn">{c}</button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
          {IMAGES.map((img) => (
            <div key={img.title} className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ aspectRatio: "4/3", background: "linear-gradient(135deg, #f6ecdc, #f4a259)", display: "grid", placeItems: "center", fontSize: 42 }}>🖼️</div>
              <div style={{ padding: 14 }}>
                <div style={{ fontWeight: 700 }}>{img.title}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>{img.cat} • {img.date}</div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </AdminLayout>
  );
}
