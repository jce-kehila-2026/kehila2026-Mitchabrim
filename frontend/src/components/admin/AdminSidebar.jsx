import { Link } from 'react-router-dom';

function AdminSidebar() {
  const currentPath = window.location.pathname;

  const menuItems = [
    { path: '/admin', label: 'לוח בקרה' },
    { path: '/admin/elderly', label: 'ניהול קשישים' },
    { path: '/admin/volunteers', label: 'ניהול מתנדבים' },
    { path: '/admin/projects', label: 'פרויקטי חגים' },
    { path: '/admin/parliaments', label: 'פרלמנטים' },
    { path: '/admin/media', label: 'מאגר תמונות' },
    { path: '/admin/links', label: 'מאגר קישורים' },
    { path: '/admin/financial', label: 'ניהול כספי' },
    { path: '/admin/reports', label: 'דוחות' },
    { path: '/admin/settings', label: 'הגדרות' },
  ];

  return (
    <aside className="admin-sidebar">
      <div className="sidebar-header">
        <h2>מתחברים</h2>
      </div>
      <ul className="sidebar-menu">
        {menuItems.map((item) => (
          <li key={item.path}>
            <Link
              to={item.path}
              className={currentPath === item.path ? 'active' : ''}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export default AdminSidebar;