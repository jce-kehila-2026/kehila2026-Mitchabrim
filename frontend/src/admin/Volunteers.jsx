import AdminLayout from '../components/admin/AdminLayout';
import StatsCard from '../components/admin/StatsCard';
import SearchFilters from '../components/admin/SearchFilters';
import DataTable from '../components/admin/DataTable';
import '../styles/admin.css';

function Volunteers() {
  const filters = [
    { label: 'אזור', options: [
      { value: 'ירושלים', label: 'ירושלים' },
      { value: 'תל אביב', label: 'תל אביב' }
    ]},
    { label: 'סטטוס', options: [
      { value: 'פעיל', label: 'פעיל' },
      { value: 'לא פעיל', label: 'לא פעיל' }
    ]},
    { label: 'זמינות', options: [
      { value: 'בוקר', label: 'בוקר' },
      { value: 'ערב', label: 'ערב' }
    ]},
    { label: 'ותק', options: [
      { value: 'חדש', label: 'חדש' },
      { value: 'ותיק', label: 'ותיק' }
    ]}
  ];

  const columns = ['שם', 'אזור', 'טלפון', 'חיבורים', 'מתנדב מאז', 'סטטוס', 'דירוג'];

  const data = [
    { שם: 'יעל כהן', אזור: 'רחביה', טלפון: '050-1234567', חיבורים: '5', 'מתנדב מאז': '2022', סטטוס: 'פעיל', דירוג: '★★★★★' },
    { שם: 'דניאל לוי', אזור: 'גבעת שאול', טלפון: '050-2345678', חיבורים: '3', 'מתנדב מאז': '2023', סטטוס: 'פעיל', דירוג: '★★★★☆' },
    { שם: 'נועה רוזן', אזור: 'רחביה', טלפון: '050-3456789', חיבורים: '7', 'מתנדב מאז': '2021', סטטוס: 'פעיל', דירוג: '★★★★★' },
    { שם: 'איתן גולד', אזור: 'תלפיות', טלפון: '050-4567890', חיבורים: '2', 'מתנדב מאז': '2024', סטטוס: 'פעיל', דירוג: '★★★☆☆' },
    { שם: 'מיכל פרידמן', אזור: 'גבעת שאול', טלפון: '050-5678901', חיבורים: '4', 'מתנדב מאז': '2023', סטטוס: 'פעיל', דירוג: '★★★★☆' }
  ];

  return (
    <AdminLayout>
      <div className="page-header">
        <h1 className="page-title">ניהול מתנדבים</h1>
        <p className="page-subtitle">קהילת המתנדבים של מתחברים</p>
      </div>

      <div className="stats-grid">
        <StatsCard
          title="מתנדבים פעילים"
          value="127"
          subtitle=""
          icon="🤝"
        />
        <StatsCard
          title="ממתינים לשיבוץ"
          value="14"
          subtitle=""
          icon="⏳"
        />
        <StatsCard
          title="חיבורים פעילים"
          value="203"
          subtitle=""
          icon="🔗"
        />
        <StatsCard
          title="מתנדבים חדשים החודש"
          value="8"
          subtitle=""
          icon="🆕"
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button className="btn btn-primary">הוספת מתנדב</button>
        <button className="btn btn-secondary">ייצוא</button>
      </div>

      <SearchFilters
        searchPlaceholder="חיפוש מתנדב..."
        filters={filters}
      />

      <DataTable columns={columns} data={data} />
    </AdminLayout>
  );
}

export default Volunteers;