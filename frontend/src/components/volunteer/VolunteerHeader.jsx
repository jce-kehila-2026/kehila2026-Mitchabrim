import { NavLink, Link } from "react-router-dom";
import logo from "@/assets/logo.jpeg";

const LINKS = [
  { to: "/volunteer", label: "אזור אישי", end: true },
  { to: "/volunteer/report/new", label: "הגשת דוח" },
  { to: "/volunteer/reports", label: "הדוחות שלי" },
  { to: "/volunteer/tasks", label: "המשימות שלי" },
  { to: "/volunteer/profile", label: "הפרטים שלי" },
];

export default function VolunteerHeader() {
  return (
    <header className="vol-header">
      <div className="container vol-header-inner">
        <Link to="/volunteer" className="vol-brand">
          <img src={logo} alt="מתחברים" />
          <strong>מתחברים</strong>
        </Link>
        <nav className="vol-nav">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => isActive ? "active" : ""}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="vol-user">
          <div className="vol-user-avatar">ד</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>דניאלה כץ</div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>מתנדבת</div>
          </div>
          <Link to="/" className="btn" style={{ marginInlineStart: 10 }}>יציאה</Link>
        </div>
      </div>
    </header>
  );
}
