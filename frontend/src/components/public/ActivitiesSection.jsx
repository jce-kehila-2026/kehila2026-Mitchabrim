import { Link } from "react-router-dom";
import useSiteContent from "@/hooks/useSiteContent";
import { ACTIVITIES } from "@/data/activities";

const SLUGS = {
  center: "personal-volunteering",
  bubble0: "parliaments",
  bubble1: "continuous-connection",
  bubble2: "holiday-projects",
};

function NL({ text }) {
  return (text || "").split("\n").map((line, i, arr) => (
    <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
  ));
}

export default function ActivitiesSection() {
  const { content } = useSiteContent();
  const a = content.activities;
  const b = a.bubbles || [];

  return (
    <section id="activities" className="pub-section activities-v2">
      <div className="container">
        <div className="act2-grid">
          {/* RIGHT: heading */}
          <div className="act2-heading">
            <div className="act2-title-row">
              <h2 className="act2-title">{a.title}</h2>
              <svg className="act2-heart" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
            <p className="act2-sub">{a.subtitle}</p>
            <svg className="act2-brush" viewBox="0 0 160 12" fill="none" aria-hidden="true">
              <path d="M2 8 C 40 2, 90 12, 158 4" stroke="#E89A4A" strokeWidth="3.5" strokeLinecap="round" />
            </svg>
          </div>

          {/* LEFT: circle cluster */}
          <div className="act2-stage" aria-label="תחומי פעילות">
            <svg className="act2-dots act2-dots-1" viewBox="0 0 200 200" aria-hidden="true">
              <path d="M10 100 Q 50 10, 190 60" stroke="#E89A4A" strokeWidth="2" strokeDasharray="2 8" strokeLinecap="round" fill="none" opacity=".55" />
            </svg>
            <svg className="act2-dots act2-dots-2" viewBox="0 0 220 120" aria-hidden="true">
              <path d="M10 20 Q 110 110, 210 30" stroke="#E89A4A" strokeWidth="2" strokeDasharray="2 8" strokeLinecap="round" fill="none" opacity=".55" />
            </svg>
            <svg className="act2-leaf" viewBox="0 0 80 120" fill="none" aria-hidden="true">
              <path d="M40 110 Q 38 60 20 30" stroke="#E89A4A" strokeWidth="1.4" opacity=".7" />
              <path d="M30 70 Q 18 60 12 48" stroke="#E89A4A" strokeWidth="1.4" opacity=".7" />
              <path d="M34 55 Q 22 48 16 38" stroke="#E89A4A" strokeWidth="1.4" opacity=".7" />
              <path d="M36 85 Q 26 78 22 68" stroke="#E89A4A" strokeWidth="1.4" opacity=".7" />
            </svg>

            {/* Bubble 1 — top */}
            <Link to={`/our-work/${SLUGS.bubble0}`} className="act2-bubble act2-bubble-top">
              <div className="act2-bubble-inner">
                <svg className="act2-ico" viewBox="0 0 48 48" fill="none" stroke="#E89A4A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="16" cy="18" r="3.2" />
                  <circle cx="32" cy="18" r="3.2" />
                  <circle cx="24" cy="13" r="3.2" />
                  <path d="M8 32c1.2-3.5 4.2-5.5 8-5.5s6.8 2 8 5.5" />
                  <path d="M24 32c1.2-3.5 4.2-5.5 8-5.5s6.8 2 8 5.5" />
                </svg>
                <h3 className="act2-bubble-title">{b[0]?.title}</h3>
                <p className="act2-bubble-desc"><NL text={b[0]?.desc} /></p>
              </div>
            </Link>

            {/* Bubble 2 — left */}
            <Link to={`/our-work/${SLUGS.bubble1}`} className="act2-bubble act2-bubble-bl">
              <div className="act2-bubble-inner">
                <svg className="act2-ico" viewBox="0 0 48 48" fill="none" stroke="#E89A4A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 24l6-6 5 1 4-3 6 6-3 3-3-2-6 6-3 0z" />
                  <path d="M45 24l-6-6-5 1-4-3-6 6 3 3 3-2 6 6 3 0z" />
                  <path d="M19 30l4 4 3-2" />
                  <path d="M26 32l3 3 3-2" />
                </svg>
                <h3 className="act2-bubble-title">{b[1]?.title}</h3>
                <p className="act2-bubble-desc"><NL text={b[1]?.desc} /></p>
              </div>
            </Link>

            {/* Bubble 3 — bottom-right */}
            <Link to={`/our-work/${SLUGS.bubble2}`} className="act2-bubble act2-bubble-br">
              <div className="act2-bubble-inner">
                <svg className="act2-ico" viewBox="0 0 48 48" fill="none" stroke="#E89A4A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="8" y="12" width="32" height="28" rx="3" />
                  <path d="M8 20h32" />
                  <path d="M16 8v8M32 8v8" />
                  <circle cx="16" cy="28" r="1.4" fill="#E89A4A" />
                  <circle cx="24" cy="28" r="1.4" fill="#E89A4A" />
                  <circle cx="32" cy="28" r="1.4" fill="#E89A4A" />
                </svg>
                <h3 className="act2-bubble-title">{b[2]?.title}</h3>
                <p className="act2-bubble-desc"><NL text={b[2]?.desc} /></p>
              </div>
            </Link>

            {/* Center bubble */}
            <Link to={`/our-work/${SLUGS.center}`} className="act2-center">
              <span className="act2-badge" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="9" r="3.2" />
                  <path d="M5 20c1.5-3.5 4.2-5 7-5s5.5 1.5 7 5" />
                </svg>
              </span>
              <div className="act2-center-inner">
                <svg className="act2-center-ico" viewBox="0 0 48 48" fill="none" stroke="#B23A2B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="17" cy="14" r="4" />
                  <circle cx="31" cy="14" r="4" />
                  <path d="M8 32c1.5-5 5-8 9-8s7.5 3 9 8" />
                  <path d="M22 32c1.5-5 5-8 9-8s7.5 3 9 8" />
                </svg>
                <h3 className="act2-center-title">{a.centerTitle}</h3>
                <div className="act2-divider" aria-hidden="true">
                  <span className="act2-divider-line"></span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#E89A4A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                  <span className="act2-divider-line"></span>
                </div>
                <p className="act2-center-desc"><NL text={a.centerDesc} /></p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
