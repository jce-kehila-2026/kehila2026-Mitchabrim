

const HeartIcon = ({ size = 14, fill = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} aria-hidden="true">
    <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.1 3 4 6.8 4c2 0 3.6 1 5.2 3 1.6-2 3.2-3 5.2-3 3.8 0 5.9 4.1 4.4 7.8C19.5 16.4 12 21 12 21z"/>
  </svg>
);
const MailIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>
  </svg>
);
const LinkedinIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M4.98 3.5a2.5 2.5 0 11.02 5.001A2.5 2.5 0 014.98 3.5zM3 9h4v12H3V9zm7 0h3.8v1.7h.05c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.4c0-1.3-.03-2.95-1.8-2.95-1.8 0-2.08 1.4-2.08 2.85V21h-4V9z"/>
  </svg>
);
const PhoneIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 16.92V21a1 1 0 01-1.1 1 19.86 19.86 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.86 19.86 0 013.2 4.3 1 1 0 014.2 3.2h4.08a1 1 0 011 .75c.12.9.32 1.78.6 2.62a1 1 0 01-.23 1.05L8.1 9.18a16 16 0 006 6l1.56-1.56a1 1 0 011.05-.23c.84.28 1.72.48 2.62.6a1 1 0 01.75 1z"/>
  </svg>
);


const TEAM = [
  {
    name: "דניאל לוי",
    role: "רכז תוכן ופעילויות",
    desc: "מפתח תכנים, מוביל פעילויות ויוצר חוויות משמעותיות לקהילה שלנו.",
    img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=700&q=80",
    icons: [MailIcon, LinkedinIcon, PhoneIcon],
  },
  {
    name: "שרה כהן",
    role: "מנהלת הקהילה",
    desc: "מחברת בין אנשים, יוזמת תהליכים ומובילה את החזון והקשר עם הקהילה והשותפים.",
    img: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=700&q=80",
    icons: [MailIcon, LinkedinIcon, PhoneIcon],
  },
  {
    name: "מיכל רוזן",
    role: "מנהלת שותפויות",
    desc: "יוצרת שיתופי פעולה, מרחיבה חיבורים ומקדמת פרויקטים משותפים.",
    img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=700&q=80",
    icons: [MailIcon, LinkedinIcon, PhoneIcon],
  },
];

export default function TeamSection() {
  const getPosClass = (i) => {
    if (i === 1) return "fan-card is-front";
    return i === 0 ? "fan-card is-side-left" : "fan-card is-side-right";
  };

  return (
    <section id="team" className="pub-section team-section">
      <div className="container">
        <div className="team-header">
          <span className="section-eyebrow">הצוות</span>
          <h2 className="section-title">הצוות שמאחורי מתחברים</h2>
          <p className="section-sub">
            האנשים שפועלים מכל הלב כדי ליצור קהילה חמה, מחוברת ותומכת.
          </p>
        </div>

        <div className="fan-stage">
          {TEAM.map((t, i) => (
            <article key={t.name} className={getPosClass(i)}>
              <span className="fan-corner fan-corner-tl" aria-hidden>
                <HeartIcon size={14} fill="currentColor" />
              </span>
              <span className="fan-corner fan-corner-br" aria-hidden>
                <HeartIcon size={14} fill="currentColor" />
              </span>

              <div className="fan-photo">
                <img src={t.img} alt={t.name} />
              </div>

              <div className="fan-body">
                <h4>{t.name}</h4>
                <div className="fan-role">{t.role}</div>
                <div className="fan-divider"><HeartIcon size={10} fill="currentColor" /></div>
                <p>{t.desc}</p>
                <div className="fan-icons">
                  {t.icons.map((Icon, k) => (
                    <span key={k} className="fan-icon"><Icon size={15} /></span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
