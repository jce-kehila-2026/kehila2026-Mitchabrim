import useSiteContent from "@/hooks/useSiteContent";

export default function TeamSection() {
  const { content } = useSiteContent();
  const t = content.team;
  return (
    <section id="team" className="pub-section team-section">
      <div className="container">
        <div className="team-header">
          <span className="section-eyebrow">{t.eyebrow}</span>
          <h2 className="section-title">{t.title}</h2>
        </div>

        <div className="team-grid">
          {(t.members || []).map((m, i) => (
            <article key={i} className="team-card">
              <div className="team-photo">
                {m.img && <img src={m.img} alt={m.name} loading="lazy" />}
              </div>
              <div className="team-info">
                <h4>{m.name}</h4>
                <div className="team-role">{m.role}</div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
