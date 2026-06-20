/**
 * Tiny CSS sketches showing where text/images appear in each public section.
 * Pure decorative — helps the admin orient.
 */
export function HeroPreview() {
  return (
    <div className="lp-frame">
      <div className="lp-row">
        <div className="lp-col lp-text">
          <span className="lp-line w70" />
          <span className="lp-line w90" />
          <span className="lp-line w50" />
          <span className="lp-btn">CTA</span>
        </div>
        <div className="lp-col lp-images">
          <span className="lp-circle big" />
          <span className="lp-circle sm tl" />
          <span className="lp-circle md br" />
        </div>
      </div>
      <div className="lp-stats">
        <span className="lp-pill" />
        <span className="lp-pill" />
        <span className="lp-pill" />
      </div>
    </div>
  );
}

export function AboutPreview() {
  return (
    <div className="lp-frame">
      <div className="lp-row">
        <div className="lp-col lp-images">
          <span className="lp-rect" />
          <span className="lp-badge" />
        </div>
        <div className="lp-col lp-text">
          <span className="lp-line w70" />
          <span className="lp-line w90" />
          <span className="lp-line w80" />
          <span className="lp-btn">CTA</span>
        </div>
      </div>
    </div>
  );
}

export function ActivitiesPreview() {
  return (
    <div className="lp-frame">
      <div className="lp-row">
        <div className="lp-col lp-text">
          <span className="lp-line w60" />
          <span className="lp-line w80" />
        </div>
        <div className="lp-col lp-bubbles">
          <span className="lp-bubble top" />
          <span className="lp-bubble left" />
          <span className="lp-bubble center" />
          <span className="lp-bubble right" />
        </div>
      </div>
    </div>
  );
}

export function QuotePreview() {
  return (
    <div className="lp-frame">
      <div className="lp-row">
        <span className="lp-circle big" />
        <div className="lp-col lp-text">
          <span className="lp-line w90" />
          <span className="lp-line w80" />
          <span className="lp-line w50" />
        </div>
      </div>
    </div>
  );
}

export function GalleryPreview() {
  return (
    <div className="lp-frame">
      <div className="lp-gallery">
        <span className="lp-slide sm" />
        <span className="lp-slide md" />
        <span className="lp-slide lg" />
        <span className="lp-slide md" />
        <span className="lp-slide sm" />
      </div>
    </div>
  );
}

export function PartnersPreview() {
  return (
    <div className="lp-frame">
      <div className="lp-text center">
        <span className="lp-line w60 center" />
      </div>
      <div className="lp-wave">
        <span className="lp-circle md" />
        <span className="lp-circle md" />
        <span className="lp-circle md" />
        <span className="lp-circle md" />
      </div>
    </div>
  );
}

export function TeamPreview() {
  return (
    <div className="lp-frame">
      <div className="lp-text center">
        <span className="lp-line w40 center" />
      </div>
      <div className="lp-row centered">
        <span className="lp-card" />
        <span className="lp-card" />
        <span className="lp-card" />
      </div>
    </div>
  );
}

export function PressPreview() {
  return (
    <div className="lp-frame">
      <div className="lp-text center">
        <span className="lp-line w40 center" />
      </div>
      <div className="lp-row">
        <span className="lp-card small" />
        <span className="lp-card wide" />
      </div>
    </div>
  );
}

export function JoinPreview() {
  return (
    <div className="lp-frame">
      <div className="lp-row">
        <div className="lp-col lp-text">
          <span className="lp-line w70" />
          <span className="lp-line w90" />
          <span className="lp-line w60" />
        </div>
        <div className="lp-col lp-form">
          <span className="lp-input" />
          <span className="lp-input" />
          <span className="lp-input" />
          <span className="lp-btn block">שליחה</span>
        </div>
      </div>
    </div>
  );
}

export function FooterPreview() {
  return (
    <div className="lp-frame">
      <div className="lp-row centered">
        <span className="lp-card" />
        <span className="lp-card" />
        <span className="lp-card" />
        <span className="lp-card" />
      </div>
    </div>
  );
}
