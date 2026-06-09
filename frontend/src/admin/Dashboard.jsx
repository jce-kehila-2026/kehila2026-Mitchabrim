import { Link, useNavigate } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout.jsx";
import StatsCard from "@/components/admin/StatsCard.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import { logout } from "../services/authService";

const REQUESTS = [
  { name: "מרים לוי", note: "בקשה להתנדב" },
  { name: "יעקב אברהם", note: "רוצה לחבר אזרח ותיק" },
  { name: "רחל פרידמן", note: "בקשה לחיבור" },
  { name: "דוד שמש", note: "מתנדב חדש" },
];

const TASKS = [
  "להתקשר ל-12 אזרחים ותיקים שלא ענו השבוע",
  "להשלים שיבוץ מתנדבים בשכונת רחביה",
  "לאשר רשימת חלוקה לחג פסח",
  "לעדכן פרטי קשר של 3 אזרחים ותיקים",
];

export default function Dashboard() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <AdminLayout
      title="שלום שרה, בוקר טוב"
      subtitle="מבט מהיר על פעילות הקהילה היום"
      actions={
        <div style={{ display: "flex", gap: "12px" }}>
          <Link to="/admin/site-content" className="btn btn-primary">🌐 עריכת האתר הראשי</Link>
          <button 
            onClick={handleLogout}
            style={{
              backgroundColor: "#8B0000",
              color: "white",
              padding: "8px 16px",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500"
            }}
          >
            🚪 התנתק
          </button>
        </div>
      }
    >
      <div className="stats-grid">
        <StatsCard icon="👵" title="סה״כ אזרחים ותיקים" value="270" subtitle="ב-7 אזורים" />
        <StatsCard icon="🤝" title="מתנדבים פעילים" value="138" subtitle="+12 החודש" />
        <StatsCard icon="🎁" title="פרויקטים פעילים" value="3" subtitle="כולל חנוכה" />
        <StatsCard icon="✉️" title="בקשות חדשות" value="9" subtitle="ממתינות לטיפול" />
      </div>

      <div className="stats-grid">
        <StatsCard icon="🏛️" title="מפגשי פרלמנט השבוע" value="4" />
        <StatsCard icon="📞" title="שיחות מתוכננות" value="32" />
        <StatsCard icon="📦" title="חבילות שנמסרו" value="217" subtitle="החודש" />
        <StatsCard icon="⚠️" title="התראות פתוחות" value="6" />
      </div>

      <div className="two-col-grid">
        <SectionCard title="בקשות הצטרפות אחרונות">
          {REQUESTS.map((r) => (
            <div key={r.name} className="list-item">
              <div>
                <div className="list-item-title">{r.name}</div>
                <div className="list-item-sub">{r.note}</div>
              </div>
              <button className="btn">צפייה</button>
            </div>
          ))}
        </SectionCard>
        <SectionCard title="משימות והתראות">
          {TASKS.map((t) => (
            <div key={t} className="list-item">
              <div className="list-item-title" style={{ fontWeight: 500 }}>{t}</div>
              <span className="badge badge-orange">פתוח</span>
            </div>
          ))}
        </SectionCard>
      </div>
    </AdminLayout>
  );
}