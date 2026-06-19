import { NavLink, Link, useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";
import { useAuth } from "@/context/AuthContext";

const LINKS = [
  { to: "/volunteer", label: "אזור אישי", end: true },
  { to: "/volunteer/report/new", label: "הגשת דוח" },
  { to: "/volunteer/reports", label: "הדוחות שלי" },
  { to: "/volunteer/tasks", label: "המשימות שלי" },
  { to: "/volunteer/profile", label: "הפרטים שלי" },
];

export default function VolunteerHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const displayName = user?.displayName || user?.email || "מתנדב";
  const initial = (displayName || "מ").trim().charAt(0);

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

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
          <div className="vol-user-avatar">{initial}</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{displayName}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>מתנדבת</div>
          </div>
          <button onClick={handleLogout} className="btn" style={{ marginInlineStart: 10 }}>יציאה</button>
        </div>
      </div>
    </header>
  );
}
