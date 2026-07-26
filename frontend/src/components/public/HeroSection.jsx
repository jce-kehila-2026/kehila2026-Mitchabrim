import React, { useState } from "react";
import useSiteContent from "@/hooks/useSiteContent";

function HeroCircleImage({ src, alt, className, priority }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!src) {
    return <div className={`hero-circle-placeholder ${className || ""}`.trim()} aria-hidden />;
  }
  return (
    <>
      {!loaded && (
        <div className={`hero-circle-placeholder ${className || ""}`.trim()} aria-hidden />
      )}
      <img
        src={src}
        alt={alt || ""}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        loading={priority ? "eager" : "lazy"}
        fetchpriority={priority ? "high" : "low"}
        decoding="async"
        style={{
          display: failed ? "none" : undefined,
          opacity: loaded && !failed ? 1 : 0,
          transition: "opacity 400ms ease",
        }}
      />
    </>
  );
}

export default function HeroSection() {
  const { content } = useSiteContent();
  const h = content.hero;
  return (
    <section className="hero">
      <div className="hero-bg-shape hero-bg-shape-1" aria-hidden />
      <div className="hero-bg-shape hero-bg-shape-2" aria-hidden />

      <div className="container">
        <div className="hero-grid">
          <div className="hero-text">
            <div className="hero-logo-wrapper">
              <img
                src="/logo.webp"
                alt="מתחברים"
                className="hero-logo"
                width="840"
                height="507"
                fetchpriority="high"
                decoding="async"
              />
            </div>

            <p className="hero-lead">{h.lead}</p>
            <div className="hero-cta">
              <a href="#join" className="hero-btn">
                <span>{h.ctaText}</span>
                <svg className="hero-btn-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </a>
            </div>

            <div className="hero-stats-pills">
              {(h.stats || []).map((s, i) => (
                <div className="hero-stat-pill" key={i}>
                  <span className="hero-stat-pill-num">{s.num}</span>
                  <span className="hero-stat-pill-label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-collage" aria-hidden>
            <div className="hero-collage-ring" />
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
            <svg className="hero-leaf" viewBox="0 0 60 140" fill="none" aria-hidden>
              <path d="M30 130 Q 28 75 10 35" stroke="#c9a35a" strokeWidth="1.3" opacity="0.45" fill="none" />
              <path d="M22 95 Q 10 82 6 68" stroke="#c9a35a" strokeWidth="1.3" opacity="0.4" fill="none" />
              <path d="M26 72 Q 14 62 10 50" stroke="#c9a35a" strokeWidth="1.3" opacity="0.4" fill="none" />
              <path d="M24 110 Q 14 100 12 88" stroke="#c9a35a" strokeWidth="1.3" opacity="0.35" fill="none" />
            </svg>

            <div className="circle-img circle-img-lg">
              <HeroCircleImage src={h.imageMain} priority />
            </div>
            <div className="circle-img circle-img-sm circle-img-sm-tl">
              <HeroCircleImage src={h.imageTopLeft} />
            </div>
            <div className="circle-img circle-img-md circle-img-md-br">
              <HeroCircleImage src={h.imageBottom} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
