import { useEffect, useState } from "react";
import AdminPageLayout from "@/components/admin/AdminPageLayout.jsx";
import SiteSectionCard from "@/components/admin/site-content/SiteSectionCard.jsx";
import { TextField, TextareaField, ImageField } from "@/components/admin/site-content/fields.jsx";
import {
  HeroPreview, AboutPreview, ActivitiesPreview, QuotePreview, GalleryPreview,
  PartnersPreview, TeamPreview, PressPreview, JoinPreview, FooterPreview,
} from "@/components/admin/site-content/LayoutPreview.jsx";
import {
  getSiteContent, saveSection, saveAll, ensureSeeded, DEFAULT_SITE_CONTENT,
} from "@/services/siteContentService";
import "@/styles/site-content-admin.css";

export default function SiteContent() {
  const [content, setContent] = useState(DEFAULT_SITE_CONTENT);
  const [loading, setLoading] = useState(true);
  const [global, setGlobal] = useState({ saving: false, msg: "", err: "" });

  useEffect(() => {
    (async () => {
      try {
        await ensureSeeded();
        const data = await getSiteContent();
        setContent(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  // ---- helpers ----
  const setSection = (key, updater) =>
    setContent((c) => ({ ...c, [key]: typeof updater === "function" ? updater(c[key]) : updater }));

  const onField = (sectionKey, fieldPath) => (val) => {
    setSection(sectionKey, (s) => {
      const next = structuredClone(s);
      let obj = next;
      for (let i = 0; i < fieldPath.length - 1; i++) obj = obj[fieldPath[i]];
      obj[fieldPath[fieldPath.length - 1]] = val;
      return next;
    });
  };

  const saveOne = (key) => async () => {
    await saveSection(key, content[key]);
  };

  const handleSaveAll = async () => {
    setGlobal({ saving: true, msg: "", err: "" });
    try {
      await saveAll(content);
      setGlobal({ saving: false, msg: "כל השינויים נשמרו בהצלחה", err: "" });
      setTimeout(() => setGlobal((g) => ({ ...g, msg: "" })), 3000);
    } catch (e) {
      setGlobal({ saving: false, msg: "", err: e.message || "שגיאה בשמירה" });
    }
  };

  const handleResetSection = (key) => () => {
    if (!confirm("לאפס את הסקציה לערכי ברירת המחדל?")) return;
    setSection(key, structuredClone(DEFAULT_SITE_CONTENT[key]));
  };

  const actions = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <a className="btn" href="/" target="_blank" rel="noreferrer">פתיחת האתר הציבורי</a>
      <button className="btn btn-primary" onClick={handleSaveAll} disabled={global.saving}>
        {global.saving ? "שומר..." : "שמירת הכל"}
      </button>
    </div>
  );

  if (loading) {
    return (
      <AdminPageLayout heroImage="/admin-heroes/site-content.png" title="ניהול האתר הראשי" subtitle="טוען..." actions={actions}>
        <div className="sc-loading">טוען תוכן...</div>
      </AdminPageLayout>
    );
  }

  const c = content;

  return (
    <AdminPageLayout heroImage="/admin-heroes/site-content.png"
      title="ניהול האתר הראשי"
      subtitle="עריכת כל הטקסטים והתמונות באתר הציבורי — בסדר המופיע בעמוד הבית"
      actions={actions}
    >
      <div className="sc-intro">
        כל סקציה כאן מסודרת באותו הסדר שבו היא מופיעה באתר הציבורי.
        ליד כל שדה רשום בדיוק היכן הוא מופיע בעמוד.
        ניתן לשמור כל סקציה בנפרד, או להשתמש בכפתור "שמירת הכל" למעלה.
      </div>

      {global.msg && <div className="sc-global-banner sc-status-ok">{global.msg}</div>}
      {global.err && <div className="sc-global-banner sc-status-err">{global.err}</div>}

      {/* 1. HERO */}
      <SiteSectionCard
        order={1}
        name="סקציית פתיחה (Hero)"
        publicName="ראש העמוד"
        description="האזור הראשון שהמבקר רואה — טקסטים בצד ימין, אוסף תמונות בצד שמאל, ושלוש סטטיסטיקות מתחת לכפתור."
        layoutPreview={<HeroPreview />}
        onSave={saveOne("hero")}
      >
        <TextField label="כיתוב עליון (Eyebrow)" helper="מופיע מעל הכותרת הראשית, בצמוד ללבבה"
          value={c.hero.eyebrow} onChange={onField("hero", ["eyebrow"])} />
        <TextField label="כותרת ראשית — שורה 1" helper="השורה הראשונה של הכותרת הגדולה בצד ימין"
          value={c.hero.titleLine1} onChange={onField("hero", ["titleLine1"])} />
        <TextField label="כותרת ראשית — שורה 2" helper="השורה השנייה של הכותרת, לפני המילה המודגשת"
          value={c.hero.titleLine2} onChange={onField("hero", ["titleLine2"])} />
        <TextField label="מילה מודגשת בכותרת" helper="המילה הצבועה עם הקו המסולסל מתחתיה (כיום: קהילה)"
          value={c.hero.titleAccent} onChange={onField("hero", ["titleAccent"])} />
        <TextareaField label="טקסט תיאור (Lead)" helper="טקסט קצר מתחת לכותרת, מסביר את המיזם"
          value={c.hero.lead} onChange={onField("hero", ["lead"])} />
        <TextField label="טקסט הכפתור הראשי" helper="הכפתור הכתום-אדום שמתחת לטקסט (קישור לטופס הצטרפות)"
          value={c.hero.ctaText} onChange={onField("hero", ["ctaText"])} />

        <div className="sc-subsection">📊 סטטיסטיקות — שלוש פיסקאות מתחת לכפתור</div>
        {c.hero.stats.map((s, i) => (
          <div key={i} className="sc-inline-group">
            <TextField label={`סטטיסטיקה ${i + 1} — מספר/ערך`} helper={`הערך הגדול בפיסקה ${i + 1}`}
              value={s.num} onChange={onField("hero", ["stats", i, "num"])} />
            <TextField label={`סטטיסטיקה ${i + 1} — תווית`} helper="הטקסט הקטן מתחת לערך"
              value={s.label} onChange={onField("hero", ["stats", i, "label"])} />
          </div>
        ))}

        <div className="sc-subsection">🖼️ תמונות — קולאז' בצד שמאל של הסקציה</div>
        <ImageField label="תמונה ראשית (העיגול הגדול)" helper="התמונה הגדולה במרכז הקולאז', בצד שמאל"
          value={c.hero.imageMain} onChange={onField("hero", ["imageMain"])} />
        <ImageField label="תמונה קטנה — שמאל למעלה" helper="העיגול הקטן בפינה השמאלית-עליונה של הקולאז'"
          value={c.hero.imageTopLeft} onChange={onField("hero", ["imageTopLeft"])} />
        <ImageField label="תמונה תחתונה" helper="העיגול הבינוני בתחתית הקולאז'"
          value={c.hero.imageBottom} onChange={onField("hero", ["imageBottom"])} />

        <button className="btn sc-btn-ghost" onClick={handleResetSection("hero")}>איפוס סקציה</button>
      </SiteSectionCard>

      {/* 2. ABOUT */}
      <SiteSectionCard
        order={2}
        name="מי אנחנו (About)"
        publicName="מי אנחנו"
        description="הסקציה השנייה בעמוד — תמונה גדולה בצד ימין עם תג מספרי, וטקסט אודות הארגון בצד שמאל."
        layoutPreview={<AboutPreview />}
        onSave={saveOne("about")}
      >
        <TextField label="כיתוב עליון" helper="טקסט קטן מעל הכותרת (כיום: הכירו את מתחברים)"
          value={c.about.eyebrow} onChange={onField("about", ["eyebrow"])} />
        <TextField label="כותרת — שורה 1" helper="השורה הראשונה של הכותרת הגדולה"
          value={c.about.headlineLine1} onChange={onField("about", ["headlineLine1"])} />
        <TextField label="כותרת — שורה 2" helper="השורה השנייה של הכותרת, לפני המילה המודגשת"
          value={c.about.headlineLine2} onChange={onField("about", ["headlineLine2"])} />
        <TextField label="מילה מודגשת בכותרת" helper="המילה הצבועה בסוף הכותרת (כיום: לבד)"
          value={c.about.headlineAccent} onChange={onField("about", ["headlineAccent"])} />
        <TextareaField label="טקסט התוכן" rows={8} helper="הפסקאות המלאות של 'מי אנחנו' (השאירו שורות ריקות בין פסקאות)"
          value={c.about.body} onChange={onField("about", ["body"])} />
        <TextField label="טקסט כפתור" helper="הכפתור בתחתית הטקסט (כיום: הצטרפו אלינו)"
          value={c.about.ctaText} onChange={onField("about", ["ctaText"])} />

        <div className="sc-subsection">🖼️ תמונה ותג מספרי — צד ימין של הסקציה</div>
        <ImageField label="תמונה ראשית של מי אנחנו" helper="התמונה הגדולה בצד ימין של הסקציה"
          value={c.about.image} onChange={onField("about", ["image"])} />
        <div className="sc-inline-group">
          <TextField label="תג — מספר" helper="המספר הגדול שעל גבי התג הצף (כיום: +150)"
            value={c.about.badgeNum} onChange={onField("about", ["badgeNum"])} />
          <TextField label="תג — תווית" helper="הטקסט הקטן בתג (כיום: מתנדבים פעילים)"
            value={c.about.badgeLabel} onChange={onField("about", ["badgeLabel"])} />
        </div>
      </SiteSectionCard>

      {/* 3. ACTIVITIES */}
      <SiteSectionCard
        order={3}
        name="העשייה שלנו (Activities)"
        publicName="העשייה שלנו"
        description="ארבע בועות סביב בועה מרכזית. הכותרת מימין, הבועות בצד שמאל."
        layoutPreview={<ActivitiesPreview />}
        onSave={saveOne("activities")}
      >
        <TextField label="כותרת הסקציה" helper="הכותרת הגדולה בצד ימין"
          value={c.activities.title} onChange={onField("activities", ["title"])} />
        <TextField label="תיאור קצר" helper="המשפט מתחת לכותרת"
          value={c.activities.subtitle} onChange={onField("activities", ["subtitle"])} />

        <div className="sc-subsection">🎯 בועה מרכזית (הגדולה והאדומה)</div>
        <TextField label="כותרת הבועה המרכזית" helper="הכותרת בתוך הבועה הראשית (כיום: התנדבות אישית)"
          value={c.activities.centerTitle} onChange={onField("activities", ["centerTitle"])} />
        <TextareaField label="תיאור הבועה המרכזית" rows={3} helper="הטקסט בתוך הבועה הראשית"
          value={c.activities.centerDesc} onChange={onField("activities", ["centerDesc"])} />

        <div className="sc-subsection">⚪ שלוש בועות מסביב</div>
        {c.activities.bubbles.map((b, i) => (
          <div key={i} className="sc-inline-group">
            <TextField label={`בועה ${i + 1} — כותרת`} helper={
              i === 0 ? "הבועה העליונה" : i === 1 ? "הבועה השמאלית" : "הבועה הימנית-תחתונה"
            } value={b.title} onChange={onField("activities", ["bubbles", i, "title"])} />
            <TextareaField label={`בועה ${i + 1} — תיאור`} rows={2} helper="הטקסט הקטן בתוך הבועה"
              value={b.desc} onChange={onField("activities", ["bubbles", i, "desc"])} />
          </div>
        ))}
      </SiteSectionCard>

      {/* 4. QUOTE */}
      <SiteSectionCard
        order={4}
        name="ציטוט המייסדת (Quote)"
        publicName="דבר המייסדת"
        description="כרטיס עם תמונת דיוקן בצד אחד וציטוט בצד השני."
        layoutPreview={<QuotePreview />}
        onSave={saveOne("quote")}
      >
        <TextField label="כיתוב עליון" helper="טקסט קטן מעל הציטוט (כיום: דבר המייסדת)"
          value={c.quote.eyebrow} onChange={onField("quote", ["eyebrow"])} />
        <TextareaField label="טקסט הציטוט" rows={5} helper="הציטוט המרכזי של הסקציה"
          value={c.quote.text} onChange={onField("quote", ["text"])} />
        <TextField label="חתימה" helper="שם המייסדת/בעל הציטוט, מופיע מתחת"
          value={c.quote.author} onChange={onField("quote", ["author"])} />
        <ImageField label="תמונת דיוקן" helper="תמונת המייסדת — מופיעה בצד הכרטיס"
          value={c.quote.image} onChange={onField("quote", ["image"])} />
      </SiteSectionCard>

      {/* 5. GALLERY */}
      <SiteSectionCard
        order={5}
        name="גלריה (Gallery)"
        publicName="רגעים מהקהילה"
        description="קרוסלת תמונות תלת-ממדית עם 6 שקופיות. כל שקופית: תמונה + כותרת."
        layoutPreview={<GalleryPreview />}
        onSave={saveOne("gallery")}
      >
        <TextField label="כיתוב עליון" helper="טקסט קטן מעל הכותרת (כיום: גלריה)"
          value={c.gallery.eyebrow} onChange={onField("gallery", ["eyebrow"])} />
        <TextField label="כותרת הסקציה" helper="הכותרת הראשית של הגלריה"
          value={c.gallery.title} onChange={onField("gallery", ["title"])} />
        <TextField label="תיאור קצר" helper="המשפט מתחת לכותרת"
          value={c.gallery.subtitle} onChange={onField("gallery", ["subtitle"])} />

        <div className="sc-subsection">🖼️ 6 שקופיות הגלריה (לפי הסדר בקרוסלה)</div>
        {c.gallery.slides.map((s, i) => (
          <div key={i} className="sc-slide-block">
            <div className="sc-slide-num">שקופית {i + 1}</div>
            <ImageField label={`תמונה ${i + 1}`} helper="התמונה שמופיעה בקרוסלה"
              value={s.img} onChange={onField("gallery", ["slides", i, "img"])} />
            <TextField label={`כיתוב לתמונה ${i + 1}`} helper="הטקסט שמופיע על השקופית הפעילה"
              value={s.title} onChange={onField("gallery", ["slides", i, "title"])} />
          </div>
        ))}
      </SiteSectionCard>

      {/* 6. PARTNERS */}
      <SiteSectionCard
        order={6}
        name="שותפים (Partners)"
        publicName="השותפים שלנו"
        description="כותרת מעל גל של עיגולי שותפים. הלוגואים עצמם קבועים בקוד (קבצי SVG) ולא נערכים מכאן."
        layoutPreview={<PartnersPreview />}
        onSave={saveOne("partners")}
      >
        <TextField label="כיתוב עליון" helper="טקסט קטן מעל הכותרת"
          value={c.partners.eyebrow} onChange={onField("partners", ["eyebrow"])} />
        <TextField label="כותרת הסקציה" helper="הכותרת הראשית של אזור השותפים"
          value={c.partners.title} onChange={onField("partners", ["title"])} />
        <TextField label="תיאור קצר" helper="המשפט מתחת לכותרת"
          value={c.partners.subtitle} onChange={onField("partners", ["subtitle"])} />
      </SiteSectionCard>

      {/* 7. TEAM */}
      <SiteSectionCard
        order={7}
        name="הצוות שלנו (Team)"
        publicName="הצוות שלנו"
        description="כותרת במרכז, ושלושה כרטיסי חברי צוות מתחתיה (תמונה + שם + תפקיד)."
        layoutPreview={<TeamPreview />}
        onSave={saveOne("team")}
      >
        <TextField label="כיתוב עליון" helper="טקסט קטן מעל הכותרת (כיום: הצוות)"
          value={c.team.eyebrow} onChange={onField("team", ["eyebrow"])} />
        <TextField label="כותרת הסקציה" helper="הכותרת הראשית של אזור הצוות"
          value={c.team.title} onChange={onField("team", ["title"])} />

        <div className="sc-subsection">👥 שלושת חברי הצוות (לפי סדר ההופעה משמאל לימין)</div>
        {c.team.members.map((m, i) => (
          <div key={i} className="sc-slide-block">
            <div className="sc-slide-num">חבר/ת צוות {i + 1}</div>
            <TextField label="שם מלא" helper="השם שמופיע מתחת לתמונה"
              value={m.name} onChange={onField("team", ["members", i, "name"])} />
            <TextField label="תפקיד" helper="התפקיד שמופיע מתחת לשם"
              value={m.role} onChange={onField("team", ["members", i, "role"])} />
            <ImageField label="תמונת פרופיל" helper="תמונת חבר/ת הצוות — בראש הכרטיס"
              value={m.img} onChange={onField("team", ["members", i, "img"])} />
          </div>
        ))}
      </SiteSectionCard>

      {/* 8. PRESS */}
      <SiteSectionCard
        order={8}
        name="כתבו עלינו (Press)"
        publicName="כתבו עלינו"
        description="כרטיס פייסבוק קטן בצד שמאל וכרטיס Ynet גדול מודגש בצד ימין."
        layoutPreview={<PressPreview />}
        onSave={saveOne("press")}
      >
        <TextField label="כותרת הסקציה" helper="הכותרת המרכזית של אזור הכתבות"
          value={c.press.title} onChange={onField("press", ["title"])} />
        <TextField label="תיאור קצר" helper="המשפט מתחת לכותרת"
          value={c.press.subtitle} onChange={onField("press", ["subtitle"])} />

        <div className="sc-subsection">📘 כרטיס פייסבוק (קטן, צד שמאל)</div>
        <TextField label="כותרת הכרטיס" value={c.press.facebook.title}
          helper="הכותרת הראשית של כרטיס הפייסבוק"
          onChange={onField("press", ["facebook", "title"])} />
        <TextareaField label="טקסט הכרטיס" rows={3} value={c.press.facebook.text}
          helper="התיאור הקצר בכרטיס" onChange={onField("press", ["facebook", "text"])} />
        <TextField label="טקסט הכפתור" value={c.press.facebook.buttonText}
          helper="הכיתוב על כפתור הצפייה" onChange={onField("press", ["facebook", "buttonText"])} />
        <TextField label="קישור (URL)" value={c.press.facebook.url}
          helper="הכתובת אליה הכפתור מוביל" onChange={onField("press", ["facebook", "url"])} />
        <ImageField label="תמונת רקע של כרטיס פייסבוק" value={c.press.facebook.image}
          helper="התמונה הגדולה בראש הכרטיס" onChange={onField("press", ["facebook", "image"])} />

        <div className="sc-subsection">📰 כרטיס Ynet (מודגש, צד ימין)</div>
        <TextField label="כותרת — שורה 1" value={c.press.ynet.titleLine1}
          helper="השורה הראשונה של הכותרת המודגשת" onChange={onField("press", ["ynet", "titleLine1"])} />
        <TextField label="כותרת — שורה 2" value={c.press.ynet.titleLine2}
          helper="השורה השנייה של הכותרת המודגשת" onChange={onField("press", ["ynet", "titleLine2"])} />
        <TextareaField label="טקסט הכרטיס" rows={3} value={c.press.ynet.text}
          helper="התיאור של הכתבה" onChange={onField("press", ["ynet", "text"])} />
        <TextField label="טקסט הכפתור" value={c.press.ynet.buttonText}
          helper="הכיתוב על כפתור הקריאה" onChange={onField("press", ["ynet", "buttonText"])} />
        <TextField label="קישור (URL)" value={c.press.ynet.url}
          helper="הכתובת אליה הכפתור מוביל" onChange={onField("press", ["ynet", "url"])} />
        <ImageField label="תמונת הכתבה של Ynet" value={c.press.ynet.image}
          helper="התמונה בצד הכרטיס" onChange={onField("press", ["ynet", "image"])} />
      </SiteSectionCard>

      {/* 9. JOIN */}
      <SiteSectionCard
        order={9}
        name="הצטרפות (Join)"
        publicName="הצטרפות / טופס יצירת קשר"
        description="טקסט הסבר בצד אחד וטופס יצירת קשר בצד השני. הטופס עצמו (השדות) קבוע."
        layoutPreview={<JoinPreview />}
        onSave={saveOne("join")}
      >
        <TextField label="כיתוב עליון" helper="טקסט קטן מעל הכותרת"
          value={c.join.eyebrow} onChange={onField("join", ["eyebrow"])} />
        <TextField label="כותרת הסקציה" helper="הכותרת המרכזית של אזור ההצטרפות"
          value={c.join.title} onChange={onField("join", ["title"])} />
        <TextField label="תיאור קצר" helper="המשפט מתחת לכותרת"
          value={c.join.subtitle} onChange={onField("join", ["subtitle"])} />
        <TextField label="טקסט הכפתור" helper="הכיתוב על כפתור שליחת הטופס"
          value={c.join.buttonText} onChange={onField("join", ["buttonText"])} />
        <TextField label="הודעת הצלחה" helper="ההודעה שמופיעה אחרי שליחה מוצלחת של הטופס"
          value={c.join.successText} onChange={onField("join", ["successText"])} />
        <TextField label="הערה תחת הכפתור" helper="הטקסט הקטן שמופיע מתחת לכפתור השליחה"
          value={c.join.note} onChange={onField("join", ["note"])} />
      </SiteSectionCard>

      {/* 10. FOOTER */}
      <SiteSectionCard
        order={10}
        name="פוטר (Footer)"
        publicName="תחתית האתר"
        description="ארבעה טורים: מותג ותיאור, ניווט, יצירת קשר, רשתות חברתיות. פרטי הקשר נערכים מכאן."
        layoutPreview={<FooterPreview />}
        onSave={saveOne("footer")}
      >
        <TextField label="שם הארגון" helper="השם בתחילת הפוטר, ליד הלוגו"
          value={c.footer.orgName} onChange={onField("footer", ["orgName"])} />
        <TextField label="טקסט משנה" helper="המשפט הקצר מתחת לשם הארגון"
          value={c.footer.tagline} onChange={onField("footer", ["tagline"])} />
        <TextareaField label="תיאור הארגון" rows={3} helper="הפסקה התחתונה בטור הראשון של הפוטר"
          value={c.footer.description} onChange={onField("footer", ["description"])} />
        <TextField label="טלפון" helper="מופיע בטור 'יצירת קשר'"
          value={c.footer.phone} onChange={onField("footer", ["phone"])} />
        <TextField label="אימייל" helper="מופיע בטור 'יצירת קשר'"
          value={c.footer.email} onChange={onField("footer", ["email"])} />
        <TextField label="כתובת" helper="מופיע בטור 'יצירת קשר'"
          value={c.footer.address} onChange={onField("footer", ["address"])} />
      </SiteSectionCard>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
        <button className="btn btn-primary btn-lg" onClick={handleSaveAll} disabled={global.saving}>
          {global.saving ? "שומר..." : "שמירת כל השינויים"}
        </button>
      </div>
    </AdminPageLayout>
  );
}
