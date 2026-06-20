import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";

export default function PublicNavbar() {
  return (
    <header className="pub-navbar">
      <div className="container pub-nav-inner">
        <Link to="/" className="pub-brand" aria-label="מתחברים">
          <img src={logo} alt="מתחברים" />
        </Link>
        <nav className="pub-nav-links">
          <a href="#about">אודות</a>
          <a href="#activities">העשייה שלנו</a>
          <a href="#partners">שותפים</a>
          <a href="#team">הצוות</a>
          <a href="#join">הצטרפות</a>
        </nav>
        <div className="pub-nav-cta">
          <Link to="/login" className="btn btn-primary">התחברות</Link>
        </div>
      </div>
    </header>
  );
}
