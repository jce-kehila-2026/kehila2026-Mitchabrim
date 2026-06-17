import React from "react";

export default function HeroSection() {
  return (
    <section className="hero">
      {/* Decorative background shapes */}
      <div className="hero-bg-shape hero-bg-shape-1" aria-hidden />
      <div className="hero-bg-shape hero-bg-shape-2" aria-hidden />

      <div className="container">
        <div className="hero-grid">
          {/* LEFT: image collage */}
          <div className="hero-collage" aria-hidden>
            {/* Large faint circle behind images */}
            <div className="hero-collage-ring" />

            {/* Decorative dots */}
            <svg className="hero-dot-cluster hero-dot-cluster-1" viewBox="0 0 120 80" fill="none" aria-hidden>
              <circle cx="10" cy="12" r="3" fill="#d9a86c" opacity="0.45" />
              <circle cx="28" cy="6" r="2.2" fill="#d9a86c" opacity="0.35" />
              <circle cx="22" cy="26" r="2" fill="#d9a86c" opacity="0.3" />
              <circle cx="6" cy="32" r="1.8" fill="#d9a86c" opacity="0.4" />
            </svg>
            <svg className="hero-dot-cluster hero-dot-cluster-2" viewBox="0 0 100 60" fill="none" aria-hidden>
              <circle cx="85" cy="10" r="3" fill="#d9a86c" opacity="0.4" />
              <circle cx="92" cy="24" r="2.2" fill="#d9a86c" opacity="0.35" />
              <circle cx="78" cy="30" r="1.8" fill="#d9a86c" opacity="0.3" />
            </svg>

            {/* Leaf decoration on far left */}
            <svg className="hero-leaf" viewBox="0 0 60 140" fill="none" aria-hidden>
              <path d="M30 130 Q 28 75 10 35" stroke="#c9a35a" strokeWidth="1.3" opacity="0.45" fill="none" />
              <path d="M22 95 Q 10 82 6 68" stroke="#c9a35a" strokeWidth="1.3" opacity="0.4" fill="none" />
              <path d="M26 72 Q 14 62 10 50" stroke="#c9a35a" strokeWidth="1.3" opacity="0.4" fill="none" />
              <path d="M24 110 Q 14 100 12 88" stroke="#c9a35a" strokeWidth="1.3" opacity="0.35" fill="none" />
            </svg>

            {/* Main large circle — woman */}
            <div className="circle-img circle-img-lg">
              <img
                src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=900&q=80"
                alt="מתנדבת מחייכת"
              />
            </div>

            {/* Top-left small circle — cooking / community */}
            <div className="circle-img circle-img-sm circle-img-sm-tl">
              <img
                src="https://images.unsplash.com/photo-1521146764736-56c929d59c83?auto=format&fit=crop&w=600&q=80"
                alt="פעילות קהילתית"
              />
            </div>

            {/* Bottom small circle — young woman */}
            <div className="circle-img circle-img-md circle-img-md-br">
              <img
                src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=500&q=80"
                alt="מתנדבת צעירה"
              />
            </div>
          </div>

          {/* RIGHT: text content */}
          <div className="hero-text">
            <div className="hero-eyebrow-row">
              <span className="hero-eyebrow">פרויקט קהילתי בירושלים</span>
              <svg
                className="hero-eyebrow-heart"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>

            <h1>
              מתחברים בין אזרחים ותיקים,
              <br />
              ותיקים ו
              <span className="hero-accent">
                קהילה
                <svg className="hero-accent-underline" viewBox="0 0 160 14" preserveAspectRatio="none" aria-hidden>
                  <path
                    d="M2 8 Q 40 2, 80 8 T 158 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>

            <p className="hero-lead">
              — חיבור אזרחים בודדים לקהילה בירושלים,
              <br />
              דרך קשר אישי, פעילות חברתית וליווי מתמשך.
            </p>

            <div className="hero-cta">
              <a href="#join" className="hero-btn">
                <span>אני רוצה להצטרף</span>
                <svg
                  className="hero-btn-arrow"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="hero-stats">
          <div className="hero-stat">
            <span className="hero-stat-number">1,200+</span>
            <span className="hero-stat-label">אזרחים ותיקים</span>
            <span className="hero-stat-sublabel">מחוברים לקהילה</span>
          </div>
          <div className="hero-stat-divider" aria-hidden />
          <div className="hero-stat">
            <span className="hero-stat-number">850+</span>
            <span className="hero-stat-label">מתנדבים ושותפים</span>
            <span className="hero-stat-sublabel">בדרך משותפת</span>
          </div>
          <div className="hero-stat-divider" aria-hidden />
          <div className="hero-stat hero-stat-wide">
            <span className="hero-stat-number">ירושלים</span>
            <span className="hero-stat-label">קהילה אחת,</span>
            <span className="hero-stat-sublabel">אינסוף חיבורים</span>
          </div>
        </div>
      </div>
    </section>
  );
}
