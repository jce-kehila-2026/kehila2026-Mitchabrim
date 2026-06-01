const ACTIVITIES = [
  { icon: "👥", title: "התנדבות אישית", desc: "חיבור בין מתנדבים לאזרחים ותיקים למפגשים, שיחות וליווי אישי." },
  { icon: "🏛️", title: "פרלמנטים", desc: "מפגשים קהילתיים לאזרחים ותיקים הכוללים שיח, פעילות וחיבור חברתי." },
  { icon: "🎁", title: "פרויקטי חגים", desc: "חלוקת חבילות ומתנות בחגים באמצעות מתנדבים ושותפים." },
  { icon: "📞", title: "קשר רציף", desc: "מעקב, עדכון ושמירה על קשר עם האזרחים הוותיקים והמתנדבים." },
];

export default function ActivitiesSection() {
  return (
    <section id="activities" className="pub-section activities">
      <div className="container">
        <span className="section-eyebrow">העשייה</span>
        <h2 className="section-title">העשייה שלנו</h2>
        <p className="section-sub">ארבעה תחומי פעילות מרכזיים שהופכים את הקהילה לחמה יותר.</p>
        <div className="activities-grid">
          {ACTIVITIES.map((a) => (
            <div key={a.title} className="activity-card">
              <div className="activity-icon">{a.icon}</div>
              <h4>{a.title}</h4>
              <p>{a.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
