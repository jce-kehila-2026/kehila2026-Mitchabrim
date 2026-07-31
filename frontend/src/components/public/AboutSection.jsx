import useSiteContent from "@/hooks/useSiteContent";
import { resolveSiteImageUrl } from "@/utils/siteImageReferences";

export default function AboutSection() {
  const { content } = useSiteContent();
  const a = content.about;
  const imageUrl = resolveSiteImageUrl(a.image);
  return (
    <section id="about" className="pub-section about-section">
      <div className="container about-grid-clean">
        <div className="about-visual">
          <div className="about-main-img">
            {imageUrl && <img src={imageUrl} alt={a.headlineLine1 || "אודות"} loading="lazy" decoding="async" />}
          </div>
          <div className="about-img-badge">
            <span className="badge-num">{a.badgeNum}</span>
            <span className="badge-label">{a.badgeLabel}</span>
          </div>
        </div>

        <div className="about-content">
          <span className="section-eyebrow">{a.eyebrow}</span>
          <h2 className="about-headline">
            {a.headlineLine1}
            <br />
            {a.headlineLine2}<span className="hero-accent">{a.headlineAccent}</span>
          </h2>
          <div className="about-body">
            {(a.body || "").split(/\n\n+/).map((p, i) => (
              <p key={i}>{p.split("\n").map((line, j, arr) => (
                <span key={j}>{line}{j < arr.length - 1 && <br />}</span>
              ))}</p>
            ))}
          </div>
          <a href="#join" className="btn btn-primary btn-lg">{a.ctaText}</a>
        </div>
      </div>
    </section>
  );
}
