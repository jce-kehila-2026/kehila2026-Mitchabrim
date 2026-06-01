import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";

// In the future, these values can be saved to Firestore or another CMS.
const INITIAL_CONTENT = {
  hero: {
    title: "מתחברים בין אנשים לקהילה",
    subtitle:
      "פרויקט קהילתי המחבר בין אזרחים ותיקים, מתנדבים וגורמי קהילה בירושלים. יחד אנחנו דואגים לכל אחד ואחת שלא יישארו לבד.",
    ctaText: "אני רוצה להצטרף",
    image: "/logo.jpeg",
  },
  about: {
    title: "מי אנחנו",
    text: "ארגון קהילתי בירושלים המחבר בין אזרחים ותיקים למתנדבים ולגורמי קהילה.",
    points: {
      personal: "קשר אישי",
      community: "התנדבות קהילתית",
      management: "ניהול מסודר",
    },
  },
  activities: [
    { title: "התנדבות אישית", description: "מתנדב אישי לכל אזרח ותיק", icon: "🤝" },
    { title: "פרלמנטים", description: "מפגשי קהילה שבועיים", icon: "🏛️" },
    { title: "פרויקטי חגים", description: "חבילות ומפגשים בחגים", icon: "🎁" },
    { title: "קשר רציף", description: "ליווי לאורך כל השנה", icon: "📞" },
  ],
  team: [
    { name: "שרה כהן", role: "מנכ״לית", description: "מובילה את הארגון", image: "" },
    { name: "פנינה לוי", role: "רכזת מתנדבים", description: "אחראית על שיבוץ מתנדבים", image: "" },
    { name: "שירה אברהם", role: "רכזת פרויקטים", description: "מובילה פרויקטי חגים", image: "" },
  ],
  join: {
    title: "רוצים להצטרף אלינו?",
    subtitle: "מלאו את הטופס ונחזור אליכם",
    buttonText: "שליחת בקשה",
    successText: "תודה! פנייתכם התקבלה",
  },
  footer: {
    orgName: "מתחברים",
    tagline: "מחברים בין אנשים לקהילה",
    phone: "02-1234567",
    email: "info@mitchabrim.org.il",
    address: "ירושלים",
  },
};

export default function SiteContent() {
  const [content, setContent] = useState(INITIAL_CONTENT);
  const [savedMsg, setSavedMsg] = useState("");

  const update = (path, value) => {
    setContent((prev) => {
      const next = structuredClone(prev);
      let obj = next;
      for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
      obj[path[path.length - 1]] = value;
      return next;
    });
  };

  const handleSave = () => {
    // In the future, these values can be saved to Firestore or another CMS.
    setSavedMsg("השינויים נשמרו בהצלחה באופן מקומי");
    setTimeout(() => setSavedMsg(""), 3500);
  };

  const handleReset = () => {
    setContent(INITIAL_CONTENT);
    setSavedMsg("התוכן אופס לערכי ברירת המחדל");
    setTimeout(() => setSavedMsg(""), 3500);
  };

  const actions = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button className="btn" onClick={handleReset}>איפוס</button>
      <a className="btn" href="/" target="_blank" rel="noreferrer">תצוגה מקדימה</a>
      <button className="btn btn-primary" onClick={handleSave}>שמירת שינויים</button>
    </div>
  );

  return (
    <AdminLayout
      title="ניהול האתר הראשי"
      subtitle="עריכת טקסטים, תמונות ותוכן המופיע באתר הציבורי"
      actions={actions}
    >
      {savedMsg && (
        <div
          style={{
            background: "#e9f7ec",
            color: "#1f6b32",
            padding: "12px 16px",
            borderRadius: 12,
            marginBottom: 16,
            fontWeight: 600,
          }}
        >
          {savedMsg}
        </div>
      )}

      {/* Hero */}
      <SectionCard title="אזור פתיחה (Hero)">
        <div className="form-grid">
          <Field label="כותרת ראשית" value={content.hero.title}
            onChange={(v) => update(["hero", "title"], v)} />
          <Field label="טקסט כפתור ראשי" value={content.hero.ctaText}
            onChange={(v) => update(["hero", "ctaText"], v)} />
          <Field label="כותרת משנה" textarea value={content.hero.subtitle}
            onChange={(v) => update(["hero", "subtitle"], v)} full />
          <Field label="תמונת פתיחה (נתיב/URL)" value={content.hero.image}
            onChange={(v) => update(["hero", "image"], v)} full />
          <div className="image-placeholder">
            {content.hero.image ? <img src={content.hero.image} alt="hero" /> : "אזור תמונה"}
          </div>
        </div>
      </SectionCard>

      {/* About */}
      <SectionCard title="אזור אודות">
        <div className="form-grid">
          <Field label="כותרת" value={content.about.title}
            onChange={(v) => update(["about", "title"], v)} full />
          <Field label="טקסט אודות" textarea value={content.about.text}
            onChange={(v) => update(["about", "text"], v)} full />
          <Field label="קשר אישי" value={content.about.points.personal}
            onChange={(v) => update(["about", "points", "personal"], v)} />
          <Field label="התנדבות קהילתית" value={content.about.points.community}
            onChange={(v) => update(["about", "points", "community"], v)} />
          <Field label="ניהול מסודר" value={content.about.points.management}
            onChange={(v) => update(["about", "points", "management"], v)} />
        </div>
      </SectionCard>

      {/* Activities */}
      <SectionCard title="אזור פעילויות">
        <div className="two-col-grid">
          {content.activities.map((a, i) => (
            <div key={i} className="inner-card">
              <h4 style={{ marginTop: 0 }}>פעילות {i + 1}</h4>
              <Field label="כותרת" value={a.title}
                onChange={(v) => update(["activities", i, "title"], v)} />
              <Field label="תיאור" textarea value={a.description}
                onChange={(v) => update(["activities", i, "description"], v)} />
              <Field label="אייקון / תמונה" value={a.icon}
                onChange={(v) => update(["activities", i, "icon"], v)} />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Team */}
      <SectionCard title="חברי הצוות">
        <div className="two-col-grid">
          {content.team.map((m, i) => (
            <div key={i} className="inner-card">
              <h4 style={{ marginTop: 0 }}>חבר/ת צוות {i + 1}</h4>
              <Field label="שם מלא" value={m.name}
                onChange={(v) => update(["team", i, "name"], v)} />
              <Field label="תפקיד" value={m.role}
                onChange={(v) => update(["team", i, "role"], v)} />
              <Field label="תיאור קצר" textarea value={m.description}
                onChange={(v) => update(["team", i, "description"], v)} />
              <Field label="תמונה (URL)" value={m.image}
                onChange={(v) => update(["team", i, "image"], v)} />
              <div className="image-placeholder small">
                {m.image ? <img src={m.image} alt={m.name} /> : "תמונה / placeholder"}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Join */}
      <SectionCard title="אזור בקשת הצטרפות">
        <div className="form-grid">
          <Field label="כותרת" value={content.join.title}
            onChange={(v) => update(["join", "title"], v)} />
          <Field label="כותרת משנה" value={content.join.subtitle}
            onChange={(v) => update(["join", "subtitle"], v)} />
          <Field label="טקסט כפתור שליחה" value={content.join.buttonText}
            onChange={(v) => update(["join", "buttonText"], v)} />
          <Field label="הודעת הצלחה" value={content.join.successText}
            onChange={(v) => update(["join", "successText"], v)} />
        </div>
      </SectionCard>

      {/* Footer */}
      <SectionCard title="פוטר ופרטי קשר">
        <div className="form-grid">
          <Field label="שם הארגון" value={content.footer.orgName}
            onChange={(v) => update(["footer", "orgName"], v)} />
          <Field label="משפט קצר" value={content.footer.tagline}
            onChange={(v) => update(["footer", "tagline"], v)} />
          <Field label="טלפון" value={content.footer.phone}
            onChange={(v) => update(["footer", "phone"], v)} />
          <Field label="אימייל" value={content.footer.email}
            onChange={(v) => update(["footer", "email"], v)} />
          <Field label="כתובת" value={content.footer.address}
            onChange={(v) => update(["footer", "address"], v)} full />
        </div>
      </SectionCard>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <button className="btn" onClick={handleReset}>איפוס</button>
        <button className="btn btn-primary" onClick={handleSave}>שמירת שינויים</button>
      </div>
    </AdminLayout>
  );
}

function Field({ label, value, onChange, textarea, full }) {
  return (
    <label className={`form-field ${full ? "full" : ""}`}>
      <span>{label}</span>
      {textarea ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}
