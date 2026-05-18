import AdminLayout from '../components/admin/AdminLayout';
import StatsCard from '../components/admin/StatsCard';
import DataTable from '../components/admin/DataTable';
import '../styles/admin.css';

function Parliaments() {
  const columns = ['שם פרלמנט', 'מיקום', 'מלווה', 'משתתפים', 'תאריך מפגש', 'סטטוס'];

  const data = [
    { 'שם פרלמנט': 'רחביה', מיקום: 'בית כנסת רחביה', מלווה: 'יעל כהן', משתתפים: '12', 'תאריך מפגש': '20/04/2026', סטטוס: 'פעיל' },
    { 'שם פרלמנט': 'גבעת שאול', מיקום: 'מרכז קהילתי', מלווה: 'דניאל לוי', משתתפים: '8', 'תאריך מפגש': '22/04/2026', סטטוס: 'פעיל' },
    { 'שם פרלמנט': 'תלפיות', מיקום: 'בית קשישים', מלווה: 'נועה רוזן', משתתפים: '15', 'תאריך מפגש': '25/04/2026', סטטוס: 'פעיל' },
    { 'שם פרלמנט': 'קטמון', מיקום: 'בית כנסת קטמון', מלווה: 'איתן גולד', משתתפים: '10', 'תאריך מפגש': '18/04/2026', סטטוס: 'פעיל' },
    { 'שם פרלמנט': 'בית הכרם', מיקום: 'מרכז קהילתי', מלווה: 'מיכל פרידמן', משתתפים: '9', 'תאריך מפגש': '27/04/2026', סטטוס: 'פעיל' }
  ];

  return (
    <AdminLayout>
      <div className="page-header">
        <h1 className="page-title">פרלמנטים</h1>
        <p className="page-subtitle">ניהול מפגשי פרלמנט ונוכחות</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button className="btn btn-primary">הוספת פרלמנט</button>
      </div>

      <div className="stats-grid">
        <StatsCard
          title="פרלמנטים פעילים"
          value="5"
          subtitle=""
          icon="🏛️"
        />
        <StatsCard
          title="משתתפים רשומים"
          value="86"
          subtitle=""
          icon="👥"
        />
        <StatsCard
          title="מפגשים החודש"
          value="12"
          subtitle=""
          icon="📅"
        />
        <StatsCard
          title="אישורי הגעה ממתינים"
          value="18"
          subtitle=""
          icon="✅"
        />
      </div>

      <h2>רשימת פרלמנטים</h2>
      <DataTable columns={columns} data={data} />
    </AdminLayout>
  );
}

export default Parliaments;