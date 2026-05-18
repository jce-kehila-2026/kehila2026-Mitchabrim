import AdminLayout from '../components/admin/AdminLayout';
import StatsCard from '../components/admin/StatsCard';
import SectionCard from '../components/admin/SectionCard';
import '../styles/admin.css';

function Dashboard() {
  return (
    <AdminLayout>
      <div className="page-header">
        <h1 className="page-title">שלום שרה, בוקר טוב</h1>
        <p className="page-subtitle">מבט מהיר על פעילות הקהילה היום</p>
      </div>

      <div className="stats-grid">
        <StatsCard
          title="סה״כ קשישים"
          value="342"
          subtitle="+12 החודש"
          icon="👴"
        />
        <StatsCard
          title="מתנדבים פעילים"
          value="127"
          subtitle="+5 השבוע"
          icon="🤝"
        />
        <StatsCard
          title="פרויקטים פעילים"
          value="3"
          subtitle="פסח, שבועות, ראש השנה"
          icon="📦"
        />
        <StatsCard
          title="בקשות חדשות"
          value="8"
          subtitle="ב-4 שכונות"
          icon="📋"
        />
      </div>

      <SectionCard title="בקשות הצטרפות אחרונות">
        <ul>
          <li>מרים לוי — בקשה להתנדב</li>
          <li>יעקב אברהם — רוצה לחבר קשיש</li>
          <li>רחל פרידמן — בקשה לחיבור</li>
          <li>דוד שמש — מתנדב חדש</li>
        </ul>
      </SectionCard>

      <SectionCard title="משימות והתראות">
        <ul>
          <li>להתקשר ל-12 קשישים שלא ענו השבוע</li>
          <li>להשלים שיבוץ מתנדבים בשכונת רחביה</li>
          <li>לאשר רשימת חלוקה לחג פסח</li>
          <li>לעדכן פרטי קשר של 3 קשישים</li>
        </ul>
      </SectionCard>
    </AdminLayout>
  );
}

export default Dashboard;