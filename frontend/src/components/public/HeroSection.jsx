import React, { useState } from "react";
import useSiteContent from "@/hooks/useSiteContent";
import { resolveSiteImageUrl } from "@/utils/siteImageReferences";

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

            <div className="circle-img circle-img-lg">
              <HeroCircleImage src={resolveSiteImageUrl(h.imageMain)} priority />
            </div>
            <div className="circle-img circle-img-sm circle-img-sm-tl">
              <HeroCircleImage src={resolveSiteImageUrl(h.imageTopLeft)} />
            </div>
            <div className="circle-img circle-img-md circle-img-md-br">
              <HeroCircleImage src={resolveSiteImageUrl(h.imageBottom)} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
