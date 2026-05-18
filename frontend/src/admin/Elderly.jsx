import AdminLayout from '../components/admin/AdminLayout';
import StatsCard from '../components/admin/StatsCard';
import SearchFilters from '../components/admin/SearchFilters';
import DataTable from '../components/admin/DataTable';
import '../styles/admin.css';

function Elderly() {
  const filters = [
    { label: 'שכונה', options: [
      { value: 'רחביה', label: 'רחביה' },
      { value: 'גבעת שאול', label: 'גבעת שאול' },
      { value: 'תלפיות', label: 'תלפיות' }
    ]},
    { label: 'סטטוס מתנדב', options: [
      { value: 'פעיל', label: 'פעיל' },
      { value: 'לא פעיל', label: 'לא פעיל' }
    ]},
    { label: 'פרלמנט', options: [
      { value: 'גבעת שאול', label: 'גבעת שאול' },
      { value: 'בית הכרם', label: 'בית הכרם' },
      { value: 'רחביה', label: 'רחביה' }
    ]}
  ];

  const columns = ['שם', 'שכונה', 'טלפון', 'סטטוס מתנדב', 'פרלמנט', 'הערות', 'פעולה'];

  const data = [
    { שם: 'אהרון כהן', שכונה: 'רחביה', טלפון: '050-1234567', 'סטטוס מתנדב': 'פעיל', פרלמנט: 'גבעת שאול', הערות: 'זקוק לתמיכה שבועית', פעולה: 'עריכה' },
    { שם: 'רחל לוי', שכונה: 'תלפיות', טלפון: '052-7654321', 'סטטוס מתנדב': 'לא פעיל', פרלמנט: 'בית הכרם', הערות: 'העדיף שיח טלפוני', פעולה: 'עריכה' },
    { שם: 'יצחק פרידמן', שכונה: 'גבעת שאול', טלפון: '050-2345678', 'סטטוס מתנדב': 'פעיל', פרלמנט: 'רחביה', הערות: 'חולה סוכרת', פעולה: 'עריכה' },
    { שם: 'נועה רוזן', שכונה: 'רחביה', טלפון: '050-3456789', 'סטטוס מתנדב': 'פעיל', פרלמנט: 'גבעת שאול', הערות: 'נדרש ביקור בית', פעולה: 'עריכה' }
  ];

  return (
    <AdminLayout>
      <div className="page-header">
        <h1 className="page-title">ניהול קשישים</h1>
        <p className="page-subtitle">ניהול פרטי קשישים וסטטוס המתנדבים במחלקה</p>
      </div>

      <div className="stats-grid">
        <StatsCard title=" קשישים" value="78" subtitle="" icon="👵" />
        <StatsCard title="קשישים פעילים" value="62" subtitle="" icon="✅" />
        <StatsCard title="זקוקים לתמיכה" value="18" subtitle="" icon="❤️" />
        <StatsCard title="קשישים חדשים החודש" value="6" subtitle="" icon="🆕" />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button className="btn btn-primary">הוסף קשיש</button>
        <button className="btn btn-secondary">ייצוא</button>
      </div>

      <SearchFilters searchPlaceholder="חיפוש קשיש..." filters={filters} />

      <DataTable columns={columns} data={data} />
    </AdminLayout>
  );
}

export default Elderly;
