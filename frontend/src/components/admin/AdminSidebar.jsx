import { NavLink } from "react-router-dom";
import logo from "@/assets/logo.jpeg";

const LINKS = [
  { to: "/admin", label: "לוח בקרה", icon: "📊", end: true },
  { to: "/admin/elderly", label: "ניהול אזרחים ותיקים", icon: "👵" },
  { to: "/admin/volunteers", label: "ניהול מתנדבים", icon: "🤝" },
  { to: "/admin/projects", label: "פרויקטי חגים", icon: "🎁" },
  { to: "/admin/parliaments", label: "פרלמנטים", icon: "🏛️" },
  { to: "/admin/site-content", label: "ניהול אתר ראשי", icon: "🌐" },
  { to: "/admin/media", label: "מאגר תמונות", icon: "🖼️" },
  { to: "/admin/links", label: "מאגר קישורים", icon: "🔗" },
  { to: "/admin/financial", label: "ניהול כספי", icon: "💰" },
  { to: "/admin/reports", label: "דוחות", icon: "📈" },
  { to: "/admin/volunteer-reports", label: "דוחות מתנדבים", icon: "📨" },
  { to: "/admin/settings", label: "הגדרות", icon: "⚙️" },
];

export default function AdminSidebar({ collapsed = false, onToggle }) {
  return (
    <aside className={`admin-sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="admin-sidebar-head">
        <div className="admin-sidebar-brand">
          <img src={logo} alt="מתחברים" />
          {!collapsed && (
            <div>
              <h3>מתחברים</h3>
              <span>מערכת ניהול</span>
            </div>
          )}
        </div>
        <button
          type="button"
          className="sidebar-toggle"
          onClick={onToggle}
          aria-label={collapsed ? "פתח תפריט" : "סגור תפריט"}
          title={collapsed ? "פתח תפריט" : "סגור תפריט"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {collapsed ? (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            ) : (
              <>
                <polyline points="13 17 18 12 13 7" />
                <polyline points="6 17 11 12 6 7" />
              </>
            )}
          </svg>
        </button>
      </div>
      <nav className="admin-nav">
        {LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            title={collapsed ? l.label : undefined}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <span className="admin-nav-icon">{l.icon}</span>
            {!collapsed && <span className="admin-nav-label">{l.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
