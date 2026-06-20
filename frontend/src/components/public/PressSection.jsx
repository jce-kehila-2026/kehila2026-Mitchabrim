import { Play, Heart } from "lucide-react";
import useSiteContent from "@/hooks/useSiteContent";

function FacebookIcon({ size = 20, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.49-3.9 3.78-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.89h-2.33v6.99A10 10 0 0 0 22 12z" />
    </svg>
  );
}

export default function PressSection() {
  const { content } = useSiteContent();
  const p = content.press;
  const fb = p.facebook;
  const yn = p.ynet;

  return (
    <section id="press" className="press-section" dir="rtl">
      <div className="press-deco press-deco-blob" aria-hidden="true" />
      <div className="press-deco press-deco-circle-soft" aria-hidden="true" />
      <div className="press-deco press-deco-dots-tl" aria-hidden="true" />
      <div className="press-deco press-deco-dots-br" aria-hidden="true" />

      <div className="press-header">
        <h2 className="press-title">{p.title}</h2>
        <div className="press-divider" aria-hidden="true">
          <span className="press-divider-line" />
          <Heart className="press-divider-heart" size={18} fill="#9b1f24" />
          <span className="press-divider-line" />
        </div>
        <p className="press-subtitle">{p.subtitle}</p>
      </div>

      <div className="press-grid">
        <article className="press-card press-card-small">
          <div className="press-thumb">
            {fb.image && <img src={fb.image} alt={fb.title} loading="lazy" />}
            <a href={fb.url} target="_blank" rel="noopener noreferrer" className="press-play" aria-label="צפייה בסרטון">
              <Play size={28} fill="#fff" />
            </a>
          </div>
          <div className="press-card-body">
            <div className="press-source">
              <FacebookIcon size={20} className="press-source-icon-fb" />
              <span>Facebook</span>
            </div>
            <h3 className="press-card-title">{fb.title}</h3>
            <p className="press-card-text">{fb.text}</p>
            <a href={fb.url} target="_blank" rel="noopener noreferrer" className="press-btn">
              <span>{fb.buttonText}</span>
              <span className="press-btn-arrow">←</span>
            </a>
          </div>
        </article>

        <article className="press-card press-card-large">
          <div className="press-card-large-body">
            <div className="press-source">
              <span className="press-ynet-badge">y</span>
              <span className="press-ynet-text">Ynet</span>
            </div>
            <h3 className="press-feature-title">
              {yn.titleLine1}<br />{yn.titleLine2}
            </h3>
            <p className="press-card-text">{yn.text}</p>
            <a href={yn.url} target="_blank" rel="noopener noreferrer" className="press-btn">
              <span>{yn.buttonText}</span>
              <span className="press-btn-arrow">←</span>
            </a>
          </div>
          <div className="press-feature-image">
            {yn.image && <img src={yn.image} alt={yn.titleLine1} loading="lazy" />}
          </div>
        </article>
      </div>
    </section>
  );
}
