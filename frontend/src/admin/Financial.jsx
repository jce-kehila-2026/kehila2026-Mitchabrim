import AdminLayout from '../components/admin/AdminLayout';
import StatsCard from '../components/admin/StatsCard';
import DataTable from '../components/admin/DataTable';
import '../styles/admin.css';

function Financial() {
  const columns = ['סוג', 'סכום', 'מקור', 'פרויקט', 'תאריך', 'קבלה', 'הערות'];

  const data = [
    { סוג: 'תרומה', סכום: '₪5,000', מקור: 'קרן משפחתית', פרויקט: 'פסח 2026', תאריך: '01/04/2026', קבלה: 'כן', הערות: 'תרומה לחבילות מזון' },
    { סוג: 'הוצאה', סכום: '₪2,500', מקור: 'קניות', פרויקט: 'פסח 2026', תאריך: '05/04/2026', קבלה: 'כן', הערות: 'רכישת מצרכים' },
    { סוג: 'תרומה', סכום: '₪3,200', מקור: 'עמותה', פרויקט: 'כללי', תאריך: '10/03/2026', קבלה: 'כן', הערות: 'תרומה שנתית' },
    { סוג: 'הוצאה', סכום: '₪1,800', מקור: 'הובלה', פרויקט: 'שבועות 2026', תאריך: '15/03/2026', קבלה: 'כן', הערות: 'הובלת חבילות' },
    { סוג: 'תרומה', סכום: '₪4,500', מקור: 'חברה פרטית', פרויקט: 'ראש השנה 2025', תאריך: '20/02/2026', קבלה: 'כן', הערות: 'תרומה מיוחדת' }
  ];

  return (
    <AdminLayout>
      <div className="page-header">
        <h1 className="page-title">ניהול כספי</h1>
        <p className="page-subtitle">הכנסות, הוצאות, תרומות וקבלות</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button className="btn btn-primary">הוספת פעולה כספית</button>
        <button className="btn btn-secondary">העלאת קבלה</button>
      </div>

      <div className="stats-grid">
        <StatsCard
          title="סה״כ הכנסות"
          value="₪48,200"
          subtitle=""
          icon="💰"
        />
        <StatsCard
          title="סה״כ הוצאות"
          value="₪31,750"
          subtitle=""
          icon="💸"
        />
        <StatsCard
          title="תרומות השנה"
          value="₪22,400"
          subtitle=""
          icon="🎁"
        />
        <StatsCard
          title="יתרה נוכחית"
          value="₪16,450"
          subtitle=""
          icon="📊"
        />
      </div>

      <DataTable columns={columns} data={data} />
    </AdminLayout>
  );
}

export default Financial;