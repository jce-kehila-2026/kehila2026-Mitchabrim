import AdminLayout from '../components/admin/AdminLayout';
import ProjectCard from '../components/admin/ProjectCard';
import DataTable from '../components/admin/DataTable';
import '../styles/admin.css';

function Projects() {
  const columns = ['נמען', 'שכונה', 'מתנדב מחלק', 'סוג חבילה', 'סטטוס', 'תאריך'];

  const data = [
    { נמען: 'אהרון כהן', שכונה: 'רחביה', 'מתנדב מחלק': 'יעל כהן', 'סוג חבילה': 'בסיסית', סטטוס: 'נמסר', תאריך: '15/04/2026' },
    { נמען: 'רחל לוי', שכונה: 'גבעת שאול', 'מתנדב מחלק': 'דניאל לוי', 'סוג חבילה': 'מורחבת', סטטוס: 'בדרך', תאריך: '16/04/2026' },
    { נמען: 'משה רוזן', שכונה: 'רחביה', 'מתנדב מחלק': 'נועה רוזן', 'סוג חבילה': 'בסיסית', סטטוס: 'נארז', תאריך: '17/04/2026' },
    { נמען: 'שרה גולד', שכונה: 'תלפיות', 'מתנדב מחלק': 'איתן גולד', 'סוג חבילה': 'מורחבת', סטטוס: 'נמסר', תאריך: '14/04/2026' },
    { נמען: 'יצחק פרידמן', שכונה: 'גבעת שאול', 'מתנדב מחלק': 'מיכל פרידמן', 'סוג חבילה': 'בסיסית', סטטוס: 'בדרך', תאריך: '18/04/2026' }
  ];

  return (
    <AdminLayout>
      <div className="page-header">
        <h1 className="page-title">פרויקטי חגים</h1>
        <p className="page-subtitle">ניהול חבילות וחלוקה לקשישי הקהילה</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button className="btn btn-primary">פרויקט חדש</button>
      </div>

      <div className="projects-grid">
        <ProjectCard
          title="פסח 2026"
          date="מרץ-אפריל 2026"
          status="active"
          progress={75}
          delivered={245}
          onWay={45}
          packed={35}
        />
        <ProjectCard
          title="שבועות 2026"
          date="מאי 2026"
          status="planning"
          progress={20}
          delivered={0}
          onWay={0}
          packed={15}
        />
        <ProjectCard
          title="ראש השנה 2025"
          date="ספטמבר 2025"
          status="completed"
          progress={100}
          delivered={320}
          onWay={0}
          packed={0}
        />
      </div>

      <h2>חלוקות פסח 2026</h2>
      <DataTable columns={columns} data={data} />
    </AdminLayout>
  );
}

export default Projects;