import AdminLayout from "@/components/admin/AdminLayout.jsx";
import StatsCard from "@/components/admin/StatsCard.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import DataTable from "@/components/admin/DataTable.jsx";

const ROWS = [
  { type: "תרומה", amount: "₪5,000", source: "תורם אנונימי", project: "חנוכה 2025", date: "10.12.2025", receipt: "קבלה 1042", notes: "" },
  { type: "הוצאה", amount: "₪3,200", source: "ספק חבילות", project: "חנוכה 2025", date: "12.12.2025", receipt: "חשבונית 5512", notes: "" },
  { type: "תרומה", amount: "₪10,000", source: "קרן משפחתית", project: "פסח 2026", date: "01.03.2026", receipt: "קבלה 1078", notes: "תרומה ייעודית" },
  { type: "הוצאה", amount: "₪1,800", source: "תחבורה ולוגיסטיקה", project: "פרלמנטים", date: "15.04.2026", receipt: "—", notes: "" },
];

const typeBadge = (t) => t === "תרומה" ? "badge-green" : "badge-orange";

export default function Financial() {
  return (
    <AdminLayout
      title="ניהול כספי"
      subtitle="הכנסות, הוצאות, תרומות וקבלות"
      actions={
        <>
          <button className="btn btn-primary">+ הוספת פעולה כספית</button>
          <button className="btn">העלאת קבלה</button>
        </>
      }
    >
      <div className="stats-grid">
        <StatsCard icon="💰" title="סה״כ הכנסות" value="₪185,400" subtitle="השנה" />
        <StatsCard icon="💸" title="סה״כ הוצאות" value="₪142,800" subtitle="השנה" />
        <StatsCard icon="❤️" title="תרומות השנה" value="₪92,500" />
        <StatsCard icon="📊" title="יתרה נוכחית" value="₪42,600" />
      </div>

      <SectionCard title="פעולות כספיות">
        <DataTable
          columns={[
            { key: "type", label: "סוג", render: (r) => <span className={`badge ${typeBadge(r.type)}`}>{r.type}</span> },
            { key: "amount", label: "סכום" },
            { key: "source", label: "מקור" },
            { key: "project", label: "פרויקט" },
            { key: "date", label: "תאריך" },
            { key: "receipt", label: "קבלה" },
            { key: "notes", label: "הערות" },
          ]}
          data={ROWS}
        />
      </SectionCard>
    </AdminLayout>
  );
}
