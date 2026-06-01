const TEAM = [
  { name: "שרה כהן", role: "רכזת ראשית", desc: "אחראית על ניהול הפעילות, המתנדבים והקשר עם הקהילה." },
  { name: "פנינה לוי", role: "רכזת מתנדבים", desc: "מלווה את המתנדבים ודואגת לשיבוץ ולמעקב אחר מפגשים." },
  { name: "שירה אברהם", role: "רכזת פרויקטים", desc: "אחראית על פרויקטי חגים, פרלמנטים ותיאום פעילויות." },
];

const initials = (name) => name.split(" ").map((s) => s[0]).join("");

export default function TeamSection() {
  return (
    <section id="team" className="pub-section">
      <div className="container">
        <span className="section-eyebrow">צוות</span>
        <h2 className="section-title">הצוות שלנו</h2>
        <p className="section-sub">האנשים שמובילים את הפעילות הקהילתית.</p>
        <div className="team-grid">
          {TEAM.map((t) => (
            <div key={t.name} className="team-card">
              <div className="team-avatar">{initials(t.name)}</div>
              <h4>{t.name}</h4>
              <div className="team-role">{t.role}</div>
              <p>{t.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
