import AdminLayout from '../components/admin/AdminLayout';
import '../styles/admin.css';

function Reports() {
  const reports = [
    { title: 'דוח קשישים', description: 'סטטיסטיקות מפורטות על הקשישים במערכת' },
    { title: 'דוח מתנדבים', description: 'נתונים על פעילות המתנדבים והחיבורים' },
    { title: 'דוח פרויקטים', description: 'מעקב אחר התקדמות הפרויקטים והחלוקות' },
    { title: 'דוח פרלמנטים', description: 'סיכום מפגשי הפרלמנט ונוכחות' },
    { title: 'דוח כספי', description: 'הכנסות, הוצאות ויתרות' },
    { title: 'דוח בקשות הצטרפות', description: 'ניתוח בקשות חדשות והמרות' }
  ];

  return (
    <AdminLayout>
      <div className="page-header">
        <h1 className="page-title">דוחות</h1>
        <p className="page-subtitle">נתונים וסטטיסטיקות מהמערכת</p>
      </div>

      <div className="reports-grid">
        {reports.map((report, index) => (
          <div key={index} className="report-card">
            <h3>{report.title}</h3>
            <p>{report.description}</p>
            <button className="btn btn-primary">פתיחת דוח</button>
          </div>
        ))}
      </div>

      <h2>סיכומים מהירים</h2>
      <div className="stats-grid">
        <div className="stats-card">
          <h3>קשישים לפי שכונה</h3>
          <p>רחביה: 45, גבעת שאול: 38, תלפיות: 52</p>
        </div>
        <div className="stats-card">
          <h3>מתנדבים לפי סטטוס</h3>
          <p>פעילים: 127, לא פעילים: 23, חדשים: 8</p>
        </div>
        <div className="stats-card">
          <h3>פרויקטים לפי התקדמות</h3>
          <p>הושלמו: 12, פעילים: 3, בתכנון: 2</p>
        </div>
      </div>
    </AdminLayout>
  );
}

export default Reports;