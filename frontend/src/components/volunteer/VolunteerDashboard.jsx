import VolunteerLayout from "@/components/volunteer/VolunteerLayout.jsx";
import VolunteerInfoBar from "@/components/volunteer/VolunteerInfoBar.jsx";
import VolunteerNavCard from "@/components/volunteer/VolunteerNavCard.jsx";
import StatsCard from "@/components/admin/StatsCard.jsx";
import { FileText, ClipboardList, CheckSquare, User, Handshake, Send, Star } from "lucide-react";

export default function VolunteerDashboard() {
  return (
    <VolunteerLayout
      title="שלום דניאלה, ברוכה הבאה"
      subtitle="כאן תוכלי לדווח על מפגשים, לראות משימות ולעקוב אחרי הדוחות שלך"
    >
      <VolunteerInfoBar />

      <div className="vol-nav-cards">
        <VolunteerNavCard to="/volunteer/report/new" icon={<FileText size={22} />} title="הגשת דוח מפגש" subtitle="דווחי על מפגש התנדבות שבוצע" />
        <VolunteerNavCard to="/volunteer/reports" icon={<ClipboardList size={22} />} title="הדוחות שלי" subtitle="צפייה בדוחות שכבר נשלחו" />
        <VolunteerNavCard to="/volunteer/tasks" icon={<CheckSquare size={22} />} title="המשימות שלי" subtitle="مפגשים ומשימות שהוקצו לך" />
        <VolunteerNavCard to="/volunteer/profile" icon={<User size={22} />} title="עדכון פרטים אישיים" subtitle="עדכון פרטי קשר בסיסיים" />
      </div>

      <div style={{ height: 24 }} />
      <h3 style={{ marginBottom: 12, fontSize: 18 }}>סיכום חודשי</h3>
      <div className="stats-grid">
        <StatsCard icon={<Handshake size={24} />} title="מפגשים שבוצעו" value="3" />
        <StatsCard icon={<Send size={24} />} title="דוחות שנשלחו" value="3" />
        <StatsCard icon={<CheckSquare size={24} />} title="משימות פתוחות" value="2" />
        <StatsCard icon={<Star size={24} />} title="דירוג חודשי" value="★★★★★" />
      </div>
    </VolunteerLayout>
  );
}
