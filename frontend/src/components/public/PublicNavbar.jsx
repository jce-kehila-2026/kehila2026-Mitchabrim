import { Link } from "react-router-dom";
import logo from "@/assets/logo.jpeg";

export default function PublicNavbar() {
  return (
    <header className="pub-navbar">
      <div className="container pub-nav-inner">
        <Link to="/" className="pub-brand">
          <img src={logo} alt="מתחברים" />
          <div>
            <div className="pub-brand-name">מתחברים</div>
            <div className="pub-brand-sub">חיבור אזרחים בודדים לקהילה</div>
          </div>
        </Link>
        <nav className="pub-nav-links">
          <a href="#about">אודות</a>
          <a href="#activities">העשייה שלנו</a>
          <a href="#team">הצוות</a>
          <a href="#join">הצטרפות</a>
        </nav>
        <div className="pub-nav-cta">
          <Link to="/login?role=admin" className="btn">כניסת מנהלים</Link>
          <Link to="/login?role=volunteer" className="btn btn-primary">כניסת מתנדבים</Link>
        </div>
      </div>
    </header>
  );
}
