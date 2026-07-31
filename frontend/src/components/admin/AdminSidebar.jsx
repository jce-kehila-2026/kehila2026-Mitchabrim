import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  HeartHandshake, 
  Handshake, 
  Gift, 
  Landmark, 
  Coins, 
  TrendingUp, 
  Link2, 
  Image, 
  Building2, 
  Contact, 
  ClipboardCheck, 
  Globe, 
  Settings 
} from "lucide-react";

const LINKS = [
  { to: "/admin", label: "לוח בקרה", icon: <LayoutDashboard size={18} />, end: true },
  { to: "/admin/elderly", label: "אזרחים ותיקים", icon: <HeartHandshake size={18} /> },
  { to: "/admin/volunteers", label: "מתנדבים", icon: <Handshake size={18} /> },
  { to: "/admin/projects", label: "פרויקטים", icon: <Gift size={18} /> },
  { to: "/admin/parliaments", label: "פרלמנטים", icon: <Landmark size={18} /> },
  { to: "/admin/financial", label: "ניהול כספים", icon: <Coins size={18} /> },
  { to: "/admin/reports", label: "דוחות", icon: <TrendingUp size={18} /> },
  { to: "/admin/links", label: "מאגר קישורים", icon: <Link2 size={18} /> },
  { to: "/admin/media", label: "מאגר תמונות", icon: <Image size={18} /> },
  { to: "/admin/organizations-contacts", label: "ארגונים ואנשי קשר", icon: <Building2 size={18} /> },
  { to: "/admin/elderly-contacts", label: "אנשי קשר לאזרחים ותיקים", icon: <Contact size={18} /> },
  { to: "/admin/volunteer-reports", label: "דוחות ומשימות המתנדבים", icon: <ClipboardCheck size={18} /> },
  { to: "/admin/site-content", label: "ניהול אתר ראשי", icon: <Globe size={18} /> },
  { to: "/admin/settings", label: "הגדרות", icon: <Settings size={18} /> },
];

export default function AdminSidebar({ collapsed = false, onToggle }) {
  return (
    <aside className={`admin-sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="admin-sidebar-head">
        <div className="admin-sidebar-brand">
          <img src="/logo.webp" alt="מתחברים" width="840" height="507" decoding="async" />
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
