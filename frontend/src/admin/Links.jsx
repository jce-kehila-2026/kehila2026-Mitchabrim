import AdminLayout from '../components/admin/AdminLayout';
import SearchFilters from '../components/admin/SearchFilters';
import DataTable from '../components/admin/DataTable';
import '../styles/admin.css';

function Links() {
  const filters = [
    { label: 'קטגוריה', options: [
      { value: 'רווחה', label: 'רווחה' },
      { value: 'בריאות', label: 'בריאות' },
      { value: 'חינוך', label: 'חינוך' }
    ]},
    { label: 'תאריך', options: [
      { value: 'השבוע', label: 'השבוע' },
      { value: 'החודש', label: 'החודש' },
      { value: 'השנה', label: 'השנה' }
    ]}
  ];

  const columns = ['כותרת', 'קטגוריה', 'קישור', 'תיאור', 'תאריך הוספה', 'פעולה'];

  const data = [
    { כותרת: 'שירותי רווחה ירושלים', קטגוריה: 'רווחה', קישור: 'https://welfare.jerusalem.muni.il', תיאור: 'מידע על שירותי רווחה בעיר', 'תאריך הוספה': '01/04/2026' },
    { כותרת: 'מרכז בריאות הנפש', קטגוריה: 'בריאות', קישור: 'https://mentalhealth.gov.il', תיאור: 'שירותי בריאות נפשית', 'תאריך הוספה': '15/03/2026' },
    { כותרת: 'חינוך מבוגרים', קטגוריה: 'חינוך', קישור: 'https://adulted.edu.gov.il', תיאור: 'קורסים לחינוך מבוגרים', 'תאריך הוספה': '20/02/2026' },
    { כותרת: 'ביטוח לאומי', קטגוריה: 'רווחה', קישור: 'https://bituachleumi.gov.il', תיאור: 'זכויות וקצבאות', 'תאריך הוספה': '10/01/2026' },
    { כותרת: 'מרכז לקשיש', קטגוריה: 'בריאות', קישור: 'https://elderlycenter.org.il', תיאור: 'שירותים לקשישים', 'תאריך הוספה': '05/12/2025' }
  ];

  return (
    <AdminLayout>
      <div className="page-header">
        <h1 className="page-title">מאגר קישורים</h1>
        <p className="page-subtitle">קישורים חשובים ונגישים לצוות</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button className="btn btn-primary">הוספת קישור</button>
      </div>

      <SearchFilters
        searchPlaceholder="חיפוש קישור..."
        filters={filters}
      />

      <DataTable columns={columns} data={data} />
    </AdminLayout>
  );
}

export default Links;