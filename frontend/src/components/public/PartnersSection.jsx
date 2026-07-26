import { useEffect, useRef, useState } from "react";
import useSiteContent from "@/hooks/useSiteContent";
import jerusalemMunicipality from "@/assets/partners/jerusalem-municipality.svg";
import welfareElderly from "@/assets/partners/welfare-elderly.svg";
import thirdAgeDepartment from "@/assets/partners/third-age-department.svg";
import shefer from "@/assets/partners/shefer.svg";
import giloCommunityCenter from "@/assets/partners/gilo-community-center.svg";
import communityAdministrations from "@/assets/partners/community-administrations.svg";
import beitIsraelMechina from "@/assets/partners/beit-israel-mechina.svg";
import beitIsraelStudents from "@/assets/partners/beit-israel-students.svg";
import schools from "@/assets/partners/schools.svg";
import electricCompany from "@/assets/partners/electric-company.svg";

const DEFAULT_PARTNERS = [
  { name: "עיריית ירושלים", logo: jerusalemMunicipality },
  { name: "אגף רווחה - המחלקה לתושבים ותיקים", logo: welfareElderly },
  { name: "אגף חברה - המחלקה לגיל השלישי", logo: thirdAgeDepartment },
  { name: "עמותת שפר", logo: shefer },
  { name: "מינהל קהילתי גילה", logo: giloCommunityCenter },
  { name: "מינהלים קהילתיים", logo: communityAdministrations },
  { name: "קהילת בית ישראל - מכינות קדם צבאיות", logo: beitIsraelMechina },
  { name: "קהילת בית ישראל - כפרי הסטודנטים", logo: beitIsraelStudents },
  { name: "בתי ספר בשכונות", logo: schools },
  { name: "חברת חשמל", logo: electricCompany },
];

const TONES = ["peach", "sage", "gold"];

const isPortableImageUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  if (/^https?:\/\//i.test(url)) return true;
  return (
    /^\/(?!__)/.test(url) &&
    /\.(?:avif|webp|png|jpe?g|svg)(?:[?#].*)?$/i.test(url)
  );
};

function PartnerLogo({ partner, fallbackLogo }) {
  const dynamicImageUrl = partner.imageUrl || partner.logo;
  const logo = isPortableImageUrl(dynamicImageUrl) ? dynamicImageUrl : null;
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [logo]);

  return (
    <img
      src={!logo || failed ? fallbackLogo : logo}
      alt={partner.name}
      loading="lazy"
      decoding="async"
      width="200"
      height="200"
      onError={() => {
        if (logo && !failed) setFailed(true);
      }}
    />
  );
}

// Wave geometry – must stay in sync between the SVG path and the JS y-formula.
const SVG_VB_W = 1000;
const SVG_VB_H = 240;
const SVG_CY = 120;
const SVG_AMP = 42;
const WAVE_PERIODS = 2; // number of full sine periods across the viewBox width

// Per-mode tuning. Spacing must comfortably exceed the circle diameter so
// circles never overlap during the flow.
const MODES = {
  desktop: { spacing: 300, speed: 42, circle: 132 },
  tablet:  { spacing: 250, speed: 34, circle: 116 },
  mobile:  { spacing: 200, speed: 26, circle: 96  },
};

function getMode() {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w < 640) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

// Build a multi-period cubic-bezier sine path matching the JS y formula.
function buildWavePath() {
  const cy = SVG_CY;
  const a = SVG_AMP;
  const w = SVG_VB_W;
  const halves = WAVE_PERIODS * 2;
  const segW = w / halves;
  // Bezier control offset that closely approximates a sine half-wave.
  const k = a * 1.32;
  let d = `M 0 ${cy}`;
  for (let s = 0; s < halves; s++) {
    const dir = s % 2 === 0 ? -1 : 1; // first half rises (sin > 0 → y decreases)
    const x0 = s * segW;
    const x1 = (s + 1) * segW;
    const cp1x = x0 + segW * 0.36;
    const cp2x = x1 - segW * 0.36;
    d += ` C ${cp1x} ${cy + dir * k} ${cp2x} ${cy + dir * k} ${x1} ${cy}`;
  }
  return d;
}

export default function PartnersSection() {
  const { content } = useSiteContent();
  const p = content.partners;
  const PARTNERS = (p.items && p.items.length > 0) ? p.items : DEFAULT_PARTNERS;



  const wrapRef = useRef(null);
  const cardRefs = useRef([]);
  const offsetRef = useRef(0);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let mode = getMode();

    const onResize = () => { mode = getMode(); };
    window.addEventListener("resize", onResize);

    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const wrap = wrapRef.current;
      if (wrap) {
        const W = wrap.clientWidth;
        const H = wrap.clientHeight;
        const conf = MODES[mode];
        const spacing = conf.spacing;
        const speed = conf.speed;
        const circle = conf.circle;
        const N = PARTNERS.length;

        // Conveyor length: long enough that off-screen cards have room to
        // reset on the right before reappearing. Ensures only the leftmost
        // visible card ever leaves first → correct exit order.
        const total = Math.max(N * spacing, W + spacing * 2);
        const ampPx = (SVG_AMP / SVG_VB_H) * H;
        const cyPx = (SVG_CY / SVG_VB_H) * H;
        const fade = spacing * 0.45;

        offsetRef.current = (offsetRef.current + speed * dt) % total;

        for (let i = 0; i < cardRefs.current.length; i++) {
          const el = cardRefs.current[i];
          if (!el) continue;

          // Phase 0..total. Higher phase = further left along the flow.
          const phase = (((i * spacing + offsetRef.current) % total) + total) % total;
          // Cards start off-screen right (x = total - spacing) and travel to
          // x = -spacing where they wrap. Single, monotonic mapping ⇒ no
          // reordering / early disappearance.
          const x = total - spacing - phase;

          // Sine matches the SVG path exactly (same periods + amplitude).
          const y = cyPx - ampPx * Math.sin((x / W) * Math.PI * 2 * WAVE_PERIODS);

          let op = 1;
          if (x < fade) op = Math.max(0, x / fade);
          else if (x > W - fade) op = Math.max(0, (W - x) / fade);
          if (x < -spacing || x > W + spacing) op = 0;

          // Anchor: circle's CENTER sits on (x, y). The label flows below,
          // moving as one unit with the circle.
          el.style.transform =
            `translate3d(${x}px, ${y - circle / 2}px, 0) translateX(-50%)`;
          el.style.width = `${circle + 80}px`;
          el.style.opacity = String(op);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [PARTNERS.length]);

  const wavePath = buildWavePath();

  return (
    <section id="partners" className="pub-section partners-section">
      <div className="container">
        <div className="partners-header">
          <span className="section-eyebrow">{p.eyebrow}</span>
          <h2 className="section-title">{p.title}</h2>
          <p className="section-sub">{p.subtitle}</p>
        </div>

        <div
          className="partners-wave-wrap partners-wave-wrap--flow"
          ref={wrapRef}
          aria-label="שותפים"
        >
          <svg
            className="partners-wave-svg"
            viewBox={`0 0 ${SVG_VB_W} ${SVG_VB_H}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d={wavePath}
              fill="none"
              stroke="#d97a4a"
              strokeOpacity="0.45"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>

          {PARTNERS.map((partner, i) => {
            const tone = TONES[i % TONES.length];
            return (
              <div
                key={partner.name}
                ref={(el) => (cardRefs.current[i] = el)}
                className={`wave-slot wave-slot--flow wave-slot--${tone}`}
              >
                <article className="wave-partner" title={partner.name}>
                  <div className="wave-partner-circle">
                    <PartnerLogo
                      partner={partner}
                      fallbackLogo={DEFAULT_PARTNERS[i % DEFAULT_PARTNERS.length].logo}
                    />
                  </div>
                  <h4 className="wave-partner-name">{partner.name}</h4>
                </article>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
