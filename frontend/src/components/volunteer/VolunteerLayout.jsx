import VolunteerHeader from "./VolunteerHeader.jsx";

export default function VolunteerLayout({ title, subtitle, children }) {
  return (
    <div className="vol-shell">
      <VolunteerHeader />
      <div className="vol-content">
        <div className="container">
          {title && <h1 style={{ fontSize: 28, marginBottom: 4 }}>{title}</h1>}
          {subtitle && <p style={{ color: "var(--color-text-muted)", marginBottom: 24 }}>{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
