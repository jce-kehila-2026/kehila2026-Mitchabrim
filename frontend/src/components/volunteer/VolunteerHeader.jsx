import { NavLink, Link, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import logo from "@/assets/logo.jpeg";
import { useAuth } from "@/context/AuthContext";

const LINKS = [
  { to: "/volunteer", label: "דף הבית", end: true },
  { to: "/volunteer/report/new", label: "הגשת דוח" },
  { to: "/volunteer/reports", label: "הדוחות שלי" },
  { to: "/volunteer/tasks", label: "המשימות שלי" },
  { to: "/volunteer/profile", label: "פרטים אישיים" },
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
            <div className="vol-user-name">שלום, {displayName}</div>
            <div className="vol-user-role">מתנדב/ת</div>
          </div>
          <button onClick={handleLogout} className="vol-logout-btn" title="יציאה" aria-label="יציאה">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}