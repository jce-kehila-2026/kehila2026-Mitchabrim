import { Link } from "react-router-dom";

export default function VolunteerNavCard({ to, icon, title, subtitle }) {
  return (
    <Link to={to} className="vol-nav-card">
      <div className="icon">{icon}</div>
      <div>
        <h4>{title}</h4>
        <p>{subtitle}</p>
      </div>
    </Link>
  );
}
