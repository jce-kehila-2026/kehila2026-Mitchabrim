import AdminLayout from "@/components/admin/AdminLayout.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import SearchFilters from "@/components/admin/SearchFilters.jsx";
import DataTable from "@/components/admin/DataTable.jsx";

const LINKS = [
  { title: "טופס הצטרפות מתנדבים", cat: "מתנדבים", url: "https://forms.mitchabrim.org/volunteer", desc: "טופס הרשמה רשמי", date: "01.03.2026" },
  { title: "נוהל ביטוח מתנדבים", cat: "ביטוח", url: "https://docs.mitchabrim.org/insurance", desc: "מסמך נוהל מעודכן", date: "12.04.2026" },
  { title: "מצגת פרלמנטים", cat: "הדרכה", url: "https://drive.mitchabrim.org/parl-deck", desc: "מצגת לרכזות", date: "20.04.2026" },
  { title: "סטטיסטיקות עירייה", cat: "מקורות", url: "https://jerusalem.muni.il/stats", desc: "נתוני אוכלוסייה", date: "10.05.2026" },
];

export default function Links() {
  return (
    <AdminLayout
      title="מאגר קישורים"
      subtitle="קישורים חשובים ונגישים לצוות"
      actions={<button className="btn btn-primary">+ הוספת קישור</button>}
    >
      <SectionCard>
        <SearchFilters
          searchPlaceholder="חיפוש קישור..."
          filters={[
            { label: "קטגוריה", options: ["מתנדבים", "ביטוח", "הדרכה", "מקורות"] },
            { label: "תאריך", options: ["החודש", "3 חודשים אחרונים", "השנה"] },
          ]}
        />
        <DataTable
          columns={[
            { key: "title", label: "כותרת" },
            { key: "cat", label: "קטגוריה", render: (r) => <span className="badge">{r.cat}</span> },
            { key: "url", label: "קישור", render: (r) => <a href={r.url} target="_blank" rel="noreferrer" style={{ color: "var(--color-burgundy)" }}>פתח קישור ↗</a> },
            { key: "desc", label: "תיאור" },
            { key: "date", label: "תאריך הוספה" },
            { key: "actions", label: "פעולה", render: () => (<><button>עריכה</button><button>מחיקה</button></>) },
          ]}
          data={LINKS}
        />
      </SectionCard>
    </AdminLayout>
  );
}
