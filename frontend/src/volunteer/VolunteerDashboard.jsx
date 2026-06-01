import VolunteerLayout from "@/components/volunteer/VolunteerLayout.jsx";
import VolunteerInfoBar from "@/components/volunteer/VolunteerInfoBar.jsx";
import VolunteerNavCard from "@/components/volunteer/VolunteerNavCard.jsx";
import StatsCard from "@/components/admin/StatsCard.jsx";

export default function VolunteerDashboard() {
  return (
    <VolunteerLayout
      title="שלום דניאלה, ברוכה הבאה"
      subtitle="כאן תוכלי לדווח על מפגשים, לראות משימות ולעקוב אחרי הדוחות שלך"
    >
      <VolunteerInfoBar />

      <div className="vol-nav-cards">
        <VolunteerNavCard to="/volunteer/report/new" icon="📝" title="הגשת דוח מפגש" subtitle="דווחי על מפגש התנדבות שבוצע" />
        <VolunteerNavCard to="/volunteer/reports" icon="📋" title="הדוחות שלי" subtitle="צפייה בדוחות שכבר נשלחו" />
        <VolunteerNavCard to="/volunteer/tasks" icon="✅" title="המשימות שלי" subtitle="מפגשים ומשימות שהוקצו לך" />
        <VolunteerNavCard to="/volunteer/profile" icon="👤" title="עדכון פרטים אישיים" subtitle="עדכון פרטי קשר בסיסיים" />
      </div>

      <div style={{ height: 24 }} />
      <h3 style={{ marginBottom: 12, fontSize: 18 }}>סיכום חודשי</h3>
      <div className="stats-grid">
        <StatsCard icon="🤝" title="מפגשים שבוצעו" value="3" />
        <StatsCard icon="📨" title="דוחות שנשלחו" value="3" />
        <StatsCard icon="✅" title="משימות פתוחות" value="2" />
        <StatsCard icon="⭐" title="דירוג חודשי" value="★★★★★" />
      </div>
    </VolunteerLayout>
  );
}
