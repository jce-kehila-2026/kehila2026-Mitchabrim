import { useEffect, useState } from "react";

const SLIDES = [
  { img: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=1200&q=80", title: "ביקורי מתנדבים" },
  { img: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=80", title: "מפגשי פרלמנט" },
  { img: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1200&q=80", title: "פעילות קהילתית" },
  { img: "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=1200&q=80", title: "פרויקטים בחגים" },
  { img: "https://images.unsplash.com/photo-1521146764736-56c929d59c83?auto=format&fit=crop&w=1200&q=80", title: "קשר בין דורות" },
  { img: "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=1200&q=80", title: "רגעים חמים" },
];

export default function GallerySection() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = SLIDES.length;

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % total), 3000);
    return () => clearInterval(id);
  }, [paused, total]);

  const goTo = (i) => setIndex((i + total) % total);

  return (
    <section className="pub-section gallery3d-section">
      <div className="container">
        <div className="gallery-header">
          <span className="section-eyebrow">גלריה</span>
          <h2 className="section-title">רגעים מהקהילה</h2>
          <p className="section-sub">תמונות מפעילויות, מפגשים וחיבורים שנוצרים לאורך הדרך.</p>
        </div>

        <div
          className="g3d-stage"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {SLIDES.map((s, i) => {
            let pos = i - index;
            if (pos > total / 2) pos -= total;
            if (pos < -total / 2) pos += total;
            const abs = Math.abs(pos);
            if (abs > 2) return null;
            return (
              <div
                key={i}
                className={`g3d-card ${pos === 0 ? "is-active" : ""}`}
                style={{
                  "--pos": pos,
                  "--abs": abs,
                  zIndex: 10 - abs,
                }}
                onClick={() => goTo(i)}
              >
                <img src={s.img} alt={s.title} loading="lazy" />
                {pos === 0 && <div className="g3d-caption">{s.title}</div>}
              </div>
            );
          })}

          <button className="g3d-nav g3d-nav-right" onClick={() => goTo(index - 1)} aria-label="הקודם">›</button>
          <button className="g3d-nav g3d-nav-left" onClick={() => goTo(index + 1)} aria-label="הבא">‹</button>
        </div>

        <div className="g3d-dots">
          {SLIDES.map((_, i) => (
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
