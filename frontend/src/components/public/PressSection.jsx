import { Play, Heart } from "lucide-react";

function FacebookIcon({ size = 20, className }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.49-3.9 3.78-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.89h-2.33v6.99A10 10 0 0 0 22 12z" />
    </svg>
  );
}

const YNET_URL =
  "https://www.ynet.co.il/activism/article/yokra14798707?utm_source=ynet.app.android&utm_medium=social&utm_campaign=general_share&utm_term=yokra14798707&utm_content=Header";
const FB_URL = "https://www.facebook.com/share/r/1BKc1zU5Dc/?mibextid=wwXIfr";

const YNET_IMG =
  "https://images.unsplash.com/photo-1573497019418-b400bb3ab074?auto=format&fit=crop&w=900&q=80";
const FB_IMG =
  "https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=700&q=80";

export default function PressSection() {
  return (
    <section id="press" className="press-section" dir="rtl">
      {/* Soft decorative shapes (no hand-drawn) */}
      <div className="press-deco press-deco-blob" aria-hidden="true" />
      <div className="press-deco press-deco-circle-soft" aria-hidden="true" />
      <div className="press-deco press-deco-dots-tl" aria-hidden="true" />
      <div className="press-deco press-deco-dots-br" aria-hidden="true" />

      {/* Header */}
      <div className="press-header">
        <h2 className="press-title">כתבו עלינו</h2>
        <div className="press-divider" aria-hidden="true">
          <span className="press-divider-line" />
          <Heart className="press-divider-heart" size={18} fill="#9b1f24" />
          <span className="press-divider-line" />
        </div>
        <p className="press-subtitle">
          מהתקשורת ומהשטח — על העשייה שלנו יחד
        </p>
      </div>

      {/* Cards */}
      <div className="press-grid">
        {/* Small Facebook card (left) */}
        <article className="press-card press-card-small">
          <div className="press-thumb">
            <img src={FB_IMG} alt="רגעים מהקהילה" loading="lazy" />
            <a
              href={FB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="press-play"
              aria-label="צפייה בסרטון"
            >
              <Play size={28} fill="#fff" />
            </a>
          </div>
          <div className="press-card-body">
            <div className="press-source">
              <FacebookIcon size={20} className="press-source-icon-fb" />
              <span>Facebook</span>
            </div>
            <h3 className="press-card-title">רגעים מהקהילה</h3>
            <p className="press-card-text">
              צפו בסרטון קצר מהפעילות שלנו ומהרגעים שמחברים בינינו.
            </p>
            <a
              href={FB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="press-btn"
            >
              <span>לצפייה בסרטון</span>
              <span className="press-btn-arrow">←</span>
            </a>
          </div>
        </article>

        {/* Large featured Ynet card (right) */}
        <article className="press-card press-card-large">
          <div className="press-card-large-body">
            <div className="press-source">
              <span className="press-ynet-badge">y</span>
              <span className="press-ynet-text">Ynet</span>
            </div>
            <h3 className="press-feature-title">
              יחד ננצח<br />את הבדידות
            </h3>
            <p className="press-card-text">
              300 אזרחים ותיקים חגגו יום הולדת במסגרת פרויקט ירושלמי שנועד לתת
              תחושה של בית, גם למי שאין משפחה.
            </p>
            <a
              href={YNET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="press-btn"
            >
              <span>לקריאת הכתבה</span>
              <span className="press-btn-arrow">←</span>
            </a>
          </div>
          <div className="press-feature-image">
            <img src={YNET_IMG} alt="יחד ננצח את הבדידות" loading="lazy" />
          </div>
        </article>
      </div>
    </section>
  );
}