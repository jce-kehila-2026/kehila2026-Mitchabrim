import AdminLayout from '../components/admin/AdminLayout';
import '../styles/admin.css';

function Settings() {
  return (
    <AdminLayout>
      <div className="page-header">
        <h1 className="page-title">הגדרות</h1>
        <p className="page-subtitle">ניהול הגדרות המערכת</p>
      </div>

      <div className="settings-sections">
        <div className="settings-section">
          <h3>פרטי הארגון</h3>
          <div className="settings-field">
            <label>שם הארגון</label>
            <input type="text" defaultValue="מתחברים" />
          </div>
          <div className="settings-field">
            <label>כתובת</label>
            <input type="text" defaultValue="ירושלים, ישראל" />
          </div>
          <div className="settings-field">
            <label>טלפון</label>
            <input type="tel" defaultValue="02-1234567" />
          </div>
          <div className="settings-field">
            <label>אימייל</label>
            <input type="email" defaultValue="info@mitchabrim.org" />
          </div>
        </div>

        <div className="settings-section">
          <h3>משתמשי מערכת</h3>
          <ul className="settings-list">
            <li>שרה כהן - רכזת ראשית</li>
            <li>דניאל לוי - מתאם מתנדבים</li>
            <li>נועה רוזן - מנהלת פרויקטים</li>
            <li>איתן גולד - רכז כספים</li>
          </ul>
        </div>

        <div className="settings-section">
          <h3>אזורים ושכונות</h3>
          <ul className="settings-list">
            <li>ירושלים - רחביה, גבעת שאול, תלפיות</li>
            <li>תל אביב - רמת אביב, פלורנטין</li>
            <li>חיפה - כרמל, הדר</li>
          </ul>
        </div>

        <div className="settings-section">
          <h3>קטגוריות</h3>
          <ul className="settings-list">
            <li>תמונות: פרלמנטים, מתנדבים, חגים, שיווק, כרטיסי ברכה</li>
            <li>קישורים: רווחה, בריאות, חינוך, תרבות</li>
          </ul>
        </div>

        <div className="settings-section">
          <h3>גיבוי נתונים</h3>
          <p>גיבוי אחרון: 15/04/2026</p>
          <p>סטטוס: תקין</p>
          <button className="btn btn-primary">הפעל גיבוי</button>
        </div>
      </div>
    </AdminLayout>
  );
}

export default Settings;