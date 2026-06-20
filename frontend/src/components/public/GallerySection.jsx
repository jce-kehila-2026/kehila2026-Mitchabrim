import { useEffect, useState } from "react";
import useSiteContent from "@/hooks/useSiteContent";

export default function GallerySection() {
  const { content } = useSiteContent();
  const g = content.gallery;
  const slides = g.slides || [];
  const total = slides.length;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || total === 0) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % total), 3000);
    return () => clearInterval(id);
  }, [paused, total]);

  if (total === 0) return null;
  const goTo = (i) => setIndex(((i % total) + total) % total);

  return (
    <section className="pub-section gallery3d-section">
      <div className="container">
        <div className="gallery-header">
          <span className="section-eyebrow">{g.eyebrow}</span>
          <h2 className="section-title">{g.title}</h2>
          <p className="section-sub">{g.subtitle}</p>
        </div>

        <div
          className="g3d-stage"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {slides.map((s, i) => {
            let pos = i - index;
            if (pos > total / 2) pos -= total;
            if (pos < -total / 2) pos += total;
            const abs = Math.abs(pos);
            if (abs > 2) return null;
            return (
              <div
                key={i}
                className={`g3d-card ${pos === 0 ? "is-active" : ""}`}
                style={{ "--pos": pos, "--abs": abs, zIndex: 10 - abs }}
                onClick={() => goTo(i)}
              >
                {s.img && <img src={s.img} alt={s.title} loading="lazy" />}
                {pos === 0 && <div className="g3d-caption">{s.title}</div>}
              </div>
            );
          })}

          <button className="g3d-nav g3d-nav-right" onClick={() => goTo(index - 1)} aria-label="הקודם">›</button>
          <button className="g3d-nav g3d-nav-left" onClick={() => goTo(index + 1)} aria-label="הבא">‹</button>
        </div>

        <div className="g3d-dots">
          {slides.map((_, i) => (
            <button
              key={i}
              className={`g3d-dot ${i === index ? "active" : ""}`}
              onClick={() => goTo(i)}
              aria-label={`תמונה ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
