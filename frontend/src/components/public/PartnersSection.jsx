import { useEffect, useMemo, useState } from "react";
import useSiteContent from "@/hooks/useSiteContent";
import jerusalemMunicipality from "@/assets/partners/jerusalem-municipality.svg";
import welfareElderly from "@/assets/partners/welfare-elderly.svg";
import thirdAgeDepartment from "@/assets/partners/third-age-department.svg";
import shefer from "@/assets/partners/shefer.svg";
import giloCommunityCenter from "@/assets/partners/gilo-community-center.svg";
import beitIsraelMechina from "@/assets/partners/beit-israel-mechina.svg";
import beitIsraelStudents from "@/assets/partners/beit-israel-students.svg";
import schools from "@/assets/partners/schools.svg";
import electricCompany from "@/assets/partners/electric-company.svg";

const PARTNERS = [
  { name: "עיריית ירושלים", logo: jerusalemMunicipality },
  { name: "אגף רווחה - המחלקה לתושבים ותיקים", logo: welfareElderly },
  { name: "אגף חברה - המחלקה לגיל השלישי", logo: thirdAgeDepartment },
  { name: "עמותת שפר", logo: shefer },
  { name: "מינהל קהילתי גילה", logo: giloCommunityCenter },
  { name: "קהילת בית ישראל - מכינות קדם צבאיות", logo: beitIsraelMechina },
  { name: "קהילת בית ישראל - כפרי הסטודנטים", logo: beitIsraelStudents },
  { name: "בתי ספר בשכונות", logo: schools },
  { name: "חברת חשמל", logo: electricCompany },
];

// Border tone cycles for the large circles.
const TONES = ["peach", "sage", "gold", "peach"];

// Visible large-circle layouts. `top` is % within the wave wrap;
// the wave SVG path is tuned to pass through these vertical centers.
const LARGE_DESKTOP = [
  { left: 14, top: 42 },
  { left: 38, top: 62 },
  { left: 62, top: 42 },
  { left: 86, top: 62 },
];
const LARGE_TABLET = [
  { left: 18, top: 42 },
  { left: 50, top: 62 },
  { left: 82, top: 42 },
];
const LARGE_MOBILE = [
  { left: 28, top: 45 },
  { left: 72, top: 60 },
];

// Small decorative wave dots — placed BETWEEN the large circles, ON the wave.
const DECOR_DESKTOP = [
  { left: 26, top: 56 },
  { left: 50, top: 50 },
  { left: 74, top: 56 },
];
const DECOR_TABLET = [
  { left: 34, top: 56 },
  { left: 66, top: 56 },
];
const DECOR_MOBILE = [{ left: 50, top: 54 }];

function useLayout() {
  const compute = () => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1280;
    if (w < 640) return { large: LARGE_MOBILE, decor: DECOR_MOBILE, mode: "mobile" };
    if (w < 1024) return { large: LARGE_TABLET, decor: DECOR_TABLET, mode: "tablet" };
    return { large: LARGE_DESKTOP, decor: DECOR_DESKTOP, mode: "desktop" };
  };
  const [layout, setLayout] = useState(compute);
  useEffect(() => {
    const onResize = () => setLayout(compute());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return layout;
}

export default function PartnersSection() {
  const { large, decor, mode } = useLayout();
  const { content } = useSiteContent();
  const p = content.partners;
  const total = PARTNERS.length;
  const [start, setStart] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setStart((s) => (s + 1) % total), 3500);
    return () => clearInterval(id);
  }, [paused, total]);

  const visiblePartners = useMemo(
    () => large.map((_, i) => PARTNERS[(start + i) % total]),
    [large, start, total]
  );

  return (
    <section id="partners" className={`pub-section partners-section partners-section--${mode}`}>
      <div className="container">
        <div className="partners-header">
          <span className="section-eyebrow">{p.eyebrow}</span>
          <h2 className="section-title">{p.title}</h2>
          <p className="section-sub">{p.subtitle}</p>
        </div>

        <div
          className="partners-wave-wrap"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Soft wave behind the circles. Path tuned so it weaves through
              the alternating circle centers (42% / 62%). */}
          <svg
            className="partners-wave-svg"
            viewBox="0 0 1000 220"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M0,110 C70,90 110,90 140,92 S240,140 380,138 S520,90 620,92 S760,140 860,138 S970,110 1000,110"
              fill="none"
              stroke="#d97a4a"
              strokeOpacity="0.45"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>

          {decor.map((d, i) => (
            <span
              key={`decor-${i}`}
              className="wave-decor"
              style={{ left: `${d.left}%`, top: `${d.top}%` }}
              aria-hidden="true"
            />
          ))}

          {large.map((pos, i) => {
            const p = visiblePartners[i];
            const tone = TONES[i % TONES.length];
            return (
              <div
                key={`slot-${i}`}
                className={`wave-slot wave-slot--${tone}`}
                style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
              >
                <article
                  key={`${p.name}-${start}-${i}`}
                  className="wave-partner"
                  title={p.name}
                >
                  <div className="wave-partner-logo">
                    <img src={p.logo} alt={p.name} loading="lazy" />
                  </div>
                  <h4 className="wave-partner-name">{p.name}</h4>
                </article>
              </div>
            );
          })}
        </div>

        <div className="partners-dots" role="tablist" aria-label="שותפים">
          {PARTNERS.map((_, i) => (
            <button
              key={i}
              className={`partners-dot ${i === start ? "active" : ""}`}
              onClick={() => setStart(i)}
              aria-label={`שותף ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
