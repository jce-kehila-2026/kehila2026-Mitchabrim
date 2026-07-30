import { useEffect, useMemo, useState } from "react";
import AdminPageLayout from "@/components/admin/AdminPageLayout.jsx";
import SiteSectionCard from "@/components/admin/site-content/SiteSectionCard.jsx";
import { TextField, TextareaField, ImageField } from "@/components/admin/site-content/fields.jsx";
import {
  HeroPreview, AboutPreview, ActivitiesPreview, QuotePreview, GalleryPreview,
  PartnersPreview, TeamPreview, PressPreview, JoinPreview, FooterPreview,
} from "@/components/admin/site-content/LayoutPreview.jsx";
import {
  getSiteContent, saveSection, ensureSeeded, DEFAULT_SITE_CONTENT,
} from "@/services/siteContentService";
import { ACTIVITIES } from "@/data/activities";
import "@/styles/site-content-admin.css";

/* Section cards shown on the overview dashboard — names match the public site. */
const SECTION_CARDS = [
  { id: "home",       icon: "🏠", title: "דף הבית",         description: "עריכת סקציית הפתיחה, מי אנחנו וציטוט המייסדת.", primary: true },
  { id: "activities", icon: "💫", title: "העשייה שלנו",     description: "עריכת סקציית ארבעת התחומים ועמודי הפירוט." },
  { id: "partners",   icon: "🤝", title: "השותפים שלנו",    description: "ניהול רשימת השותפים — שמות, לוגואים, הוספה ומחיקה." },
  { id: "gallery",    icon: "🖼️", title: "רגעים מהקהילה",   description: "כותרת סקציית הגלריה." },
  { id: "team",       icon: "👥", title: "הצוות שלנו",      description: "עריכת חברי הצוות והכותרת." },
  { id: "press",      icon: "📰", title: "כתבו עלינו",      description: "כרטיסי הכתבות והפרסומים." },
  { id: "join",       icon: "✉️", title: "יצירת קשר",       description: "טקסטים, נקודות מפתח וטופס ההצטרפות." },
  { id: "footer",     icon: "🔗", title: "פוטר",            description: "פרטי הפוטר וקישורי 'עקבו אחרינו'." },
];

const ACTIVITY_SLUGS = ACTIVITIES.map((a) => a.slug);
const ACTIVITY_LABEL = Object.fromEntries(ACTIVITIES.map((a) => [a.slug, a.title]));

export default function SiteContent() {
  const [content, setContent] = useState(DEFAULT_SITE_CONTENT);
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState(null);

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

  const setSection = (key, updater) =>
    setContent((c) => ({ ...c, [key]: typeof updater === "function" ? updater(c[key]) : updater }));

  const onField = (sectionKey, fieldPath) => (val) => {
    setSection(sectionKey, (s) => {
      const next = structuredClone(s);
      let obj = next;
      for (let i = 0; i < fieldPath.length - 1; i++) {
        if (obj[fieldPath[i]] == null) obj[fieldPath[i]] = typeof fieldPath[i + 1] === "number" ? [] : {};
        obj = obj[fieldPath[i]];
      }
      obj[fieldPath[fieldPath.length - 1]] = val;
      return next;
    });
  };

  const saveOne = (key) => async () => {
    const result = await saveSection(key, content[key]);
    if (result?.sectionData) {
      setSection(key, result.sectionData);
    }
  };

  const addItem = (sectionKey, listPath, item) => {
    setSection(sectionKey, (s) => {
      const next = structuredClone(s);
      let obj = next;
      for (const k of listPath) {
        if (obj[k] == null) obj[k] = [];
        obj = obj[k];
      }
      obj.push(item);
      return next;
    });
  };
  const removeItem = (sectionKey, listPath, idx) => {
    setSection(sectionKey, (s) => {
      const next = structuredClone(s);
      let obj = next;
      for (const k of listPath) obj = obj[k];
      obj.splice(idx, 1);
      return next;
    });
  };

  const activeMeta = useMemo(
    () => SECTION_CARDS.find((s) => s.id === activeCard) || null,
    [activeCard]
  );

  const overviewActions = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <a className="btn" href="/" target="_blank" rel="noreferrer">תצוגה באתר</a>
      <button className="btn btn-primary" onClick={() => setActiveCard("home")}>עריכת דף הבית</button>
    </div>
  );

  const editorActions = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <a className="btn" href="/" target="_blank" rel="noreferrer">תצוגה באתר</a>
      <button className="btn btn-primary" onClick={() => setActiveCard(null)}>← חזרה לניהול האתר הראשי</button>
    </div>
  );

  if (loading) {
    return (
      <AdminPageLayout heroImage="/admin-heroes/main_website_hero.webp" title="ניהול אתר ראשי" subtitle="טוען...">
        <div className="sc-loading">טוען תוכן...</div>
      </AdminPageLayout>
    );
  }

  /* ============================ OVERVIEW ============================ */
  if (!activeCard) {
    return (
      <AdminPageLayout
        heroImage="/admin-heroes/main_website_hero.webp"
        title="ניהול אתר ראשי"
        subtitle="ניהול תוכן האתר הראשי של ארגון מתחברים"
        actions={overviewActions}
      >
        <div className="sc-overview-grid">
          {SECTION_CARDS.map((card) => (
            <button
              key={card.id}
              type="button"
              className={`sc-overview-card${card.primary ? " is-primary" : ""}`}
              onClick={() => setActiveCard(card.id)}
            >
              <div className="sc-overview-card-icon">{card.icon}</div>
              <div className="sc-overview-card-title">{card.title}</div>
              <div className="sc-overview-card-desc">{card.description}</div>
            </button>
          ))}
        </div>
      </AdminPageLayout>
    );
  }

  const c = content;

  return (
    <AdminPageLayout
      heroImage="/admin-heroes/main_website_hero.webp"
      title={activeMeta?.title || "עריכת סקציה"}
      subtitle={activeMeta?.description}
      actions={editorActions}
    >
      {/* -------------------------------- HOME -------------------------------- */}
      {activeCard === "home" && (
        <>
          <SiteSectionCard order={1} name="סקציית פתיחה" publicName="ראש העמוד"
            description="האזור הראשון שהמבקר רואה — טקסטים בצד ימין, אוסף תמונות בצד שמאל, ושלוש סטטיסטיקות מתחת לכפתור."
            layoutPreview={<HeroPreview />} onSave={saveOne("hero")}>
            <TextField label="כיתוב עליון (Eyebrow)" helper="מופיע מעל הכותרת הראשית"
              value={c.hero.eyebrow} onChange={onField("hero", ["eyebrow"])} />
            <TextareaField label="טקסט תיאור" helper="טקסט קצר מתחת לכותרת"
              value={c.hero.lead} onChange={onField("hero", ["lead"])} />
            <TextField label="טקסט הכפתור הראשי"
              value={c.hero.ctaText} onChange={onField("hero", ["ctaText"])} />

            <div className="sc-subsection">📊 סטטיסטיקות</div>
            {c.hero.stats.map((s, i) => (
              <div key={i} className="sc-inline-group">
                <TextField label={`סטטיסטיקה ${i + 1} — מספר/ערך`}
                  value={s.num} onChange={onField("hero", ["stats", i, "num"])} />
                <TextField label={`סטטיסטיקה ${i + 1} — תווית`}
                  value={s.label} onChange={onField("hero", ["stats", i, "label"])} />
              </div>
            ))}

            <div className="sc-subsection">🖼️ תמונות — קולאז' בצד שמאל</div>
            <ImageField label="תמונה ראשית (העיגול הגדול)" value={c.hero.imageMain} onChange={onField("hero", ["imageMain"])} />
            <ImageField label="תמונה קטנה — שמאל למעלה" value={c.hero.imageTopLeft} onChange={onField("hero", ["imageTopLeft"])} />
            <ImageField label="תמונה תחתונה" value={c.hero.imageBottom} onChange={onField("hero", ["imageBottom"])} />
          </SiteSectionCard>

          <SiteSectionCard order={2} name="מי אנחנו" publicName="מי אנחנו"
            description="תמונה גדולה בצד ימין עם תג מספרי, וטקסט אודות הארגון בצד שמאל."
            layoutPreview={<AboutPreview />} onSave={saveOne("about")}>
            <TextField label="כיתוב עליון" value={c.about.eyebrow} onChange={onField("about", ["eyebrow"])} />
            <TextField label="כותרת — שורה 1" value={c.about.headlineLine1} onChange={onField("about", ["headlineLine1"])} />
            <TextField label="כותרת — שורה 2" value={c.about.headlineLine2} onChange={onField("about", ["headlineLine2"])} />
            <TextField label="מילה מודגשת בכותרת" value={c.about.headlineAccent} onChange={onField("about", ["headlineAccent"])} />
            <TextareaField label="טקסט התוכן" rows={8} value={c.about.body} onChange={onField("about", ["body"])} />
            <TextField label="טקסט כפתור" value={c.about.ctaText} onChange={onField("about", ["ctaText"])} />

            <div className="sc-subsection">🖼️ תמונה ותג מספרי</div>
            <ImageField label="תמונה ראשית" value={c.about.image} onChange={onField("about", ["image"])} />
            <div className="sc-inline-group">
              <TextField label="תג — מספר" value={c.about.badgeNum} onChange={onField("about", ["badgeNum"])} />
              <TextField label="תג — תווית" value={c.about.badgeLabel} onChange={onField("about", ["badgeLabel"])} />
            </div>
          </SiteSectionCard>

          <SiteSectionCard order={3} name="דבר המייסדת" publicName="דבר המייסדת"
            description="כרטיס עם תמונת דיוקן וציטוט."
            layoutPreview={<QuotePreview />} onSave={saveOne("quote")}>
            <TextField label="כיתוב עליון" value={c.quote.eyebrow} onChange={onField("quote", ["eyebrow"])} />
            <TextareaField label="טקסט הציטוט" rows={5} value={c.quote.text} onChange={onField("quote", ["text"])} />
            <TextField label="חתימה" value={c.quote.author} onChange={onField("quote", ["author"])} />
            <ImageField label="תמונת דיוקן" value={c.quote.image} onChange={onField("quote", ["image"])} />
          </SiteSectionCard>
        </>
      )}

      {/* ---------------------------- ACTIVITIES ------------------------------ */}
      {activeCard === "activities" && (
        <>
          <SiteSectionCard order={1} name="סקציית 'העשייה שלנו' — עמוד הבית" publicName="העשייה שלנו"
            description="ארבע בועות סביב בועה מרכזית."
            layoutPreview={<ActivitiesPreview />} onSave={saveOne("activities")}>
            <TextField label="כותרת הסקציה" value={c.activities.title} onChange={onField("activities", ["title"])} />
            <TextField label="תיאור קצר" value={c.activities.subtitle} onChange={onField("activities", ["subtitle"])} />

            <div className="sc-subsection">🎯 בועה מרכזית (התנדבות אישית)</div>
            <TextField label="כותרת" value={c.activities.centerTitle} onChange={onField("activities", ["centerTitle"])} />
            <TextareaField label="תיאור" rows={3} value={c.activities.centerDesc} onChange={onField("activities", ["centerDesc"])} />

            <div className="sc-subsection">⚪ שלוש בועות מסביב</div>
            {c.activities.bubbles.map((b, i) => (
              <div key={i} className="sc-inline-group">
                <TextField label={`בועה ${i + 1} — כותרת`} value={b.title} onChange={onField("activities", ["bubbles", i, "title"])} />
                <TextareaField label={`בועה ${i + 1} — תיאור`} rows={2} value={b.desc} onChange={onField("activities", ["bubbles", i, "desc"])} />
              </div>
            ))}
          </SiteSectionCard>

          {ACTIVITY_SLUGS.map((slug, i) => {
            const d = c.activities.details?.[slug] || { title: "", longDescription: "", image: "" };
            return (
              <SiteSectionCard
                key={slug}
                order={i + 2}
                name={`עמוד פירוט: ${ACTIVITY_LABEL[slug]}`}
                publicName={`/our-work/${slug}`}
                description="התוכן שמופיע כשלוחצים על העיגול המתאים בעמוד הבית."
                onSave={saveOne("activities")}
              >
                <TextField
                  label="כותרת עמוד הפירוט"
                  helper="אם ריק — יוצג הכותרת הבסיסית של הפעילות."
                  value={d.title}
                  onChange={onField("activities", ["details", slug, "title"])}
                />
                <TextareaField
                  label="טקסט העמוד"
                  helper="אם ריק — יוצג טקסט ברירת המחדל."
                  rows={8}
                  value={d.longDescription}
                  onChange={onField("activities", ["details", slug, "longDescription"])}
                />
                <ImageField
                  label="תמונה ראשית"
                  helper="אם ריק — תוצג התמונה הבסיסית."
                  value={d.image}
                  onChange={onField("activities", ["details", slug, "image"])}
                />
              </SiteSectionCard>
            );
          })}
        </>
      )}

      {/* ----------------------------- PARTNERS ------------------------------- */}
      {activeCard === "partners" && (
        <>
          <SiteSectionCard order={1} name="כותרת סקציית השותפים" publicName="השותפים שלנו"
            description="כותרת מעל גל של עיגולי שותפים."
            layoutPreview={<PartnersPreview />} onSave={saveOne("partners")}>
            <TextField label="כיתוב עליון" value={c.partners.eyebrow} onChange={onField("partners", ["eyebrow"])} />
            <TextField label="כותרת הסקציה" value={c.partners.title} onChange={onField("partners", ["title"])} />
            <TextField label="תיאור קצר" value={c.partners.subtitle} onChange={onField("partners", ["subtitle"])} />
          </SiteSectionCard>

          <SiteSectionCard order={2} name="רשימת השותפים" publicName="השותפים שלנו"
            description="ניהול השותפים המוצגים באתר. כאשר הרשימה ריקה — יוצגו שותפי ברירת המחדל."
            onSave={saveOne("partners")}>
            {(c.partners.items || []).length === 0 && (
              <div className="sc-hint">
                אין כרגע שותפים מותאמים אישית. לחצו על "הוספת שותף" כדי להתחיל.
                (עד להוספת שותף ראשון, האתר יציג את השותפים הקיימים כברירת מחדל.)
              </div>
            )}
            {(c.partners.items || []).map((item, i) => (
              <div key={i} className="sc-slide-block">
                <div className="sc-slide-num-row">
                  <div className="sc-slide-num">שותף {i + 1}</div>
                  <button type="button" className="btn sc-btn-danger" onClick={() => removeItem("partners", ["items"], i)}>
                    מחיקת שותף
                  </button>
                </div>
                <TextField label="שם השותף" value={item.name} onChange={onField("partners", ["items", i, "name"])} />
                <ImageField label="לוגו" value={item.logo || ""} onChange={onField("partners", ["items", i, "logo"])} />
              </div>
            ))}
            <div className="sc-list-actions">
              <button type="button" className="btn" onClick={() => addItem("partners", ["items"], { name: "", logo: "" })}>
                + הוספת שותף
              </button>
            </div>
          </SiteSectionCard>
        </>
      )}

      {/* ------------------------------ GALLERY ------------------------------- */}
      {activeCard === "gallery" && (
        <>
          <SectionNote>
            את תמונות הגלריה ניתן לנהל דרך <b>מאגר תמונות</b>.
          </SectionNote>
          <SiteSectionCard order={1} name="כותרת סקציית הגלריה" publicName="רגעים מהקהילה"
            description="הטקסטים המופיעים מעל הגלריה."
            layoutPreview={<GalleryPreview />} onSave={saveOne("gallery")}>
            <TextField label="כיתוב עליון" value={c.gallery.eyebrow} onChange={onField("gallery", ["eyebrow"])} />
            <TextField label="כותרת הסקציה" value={c.gallery.title} onChange={onField("gallery", ["title"])} />
            <TextField label="תיאור קצר" value={c.gallery.subtitle} onChange={onField("gallery", ["subtitle"])} />
          </SiteSectionCard>
        </>
      )}

      {/* -------------------------------- TEAM -------------------------------- */}
      {activeCard === "team" && (
        <SiteSectionCard order={1} name="הצוות שלנו" publicName="הצוות שלנו"
          description="כותרת במרכז וכרטיסי חברי צוות מתחתיה."
          layoutPreview={<TeamPreview />} onSave={saveOne("team")}>
          <TextField label="כיתוב עליון" value={c.team.eyebrow} onChange={onField("team", ["eyebrow"])} />
          <TextField label="כותרת הסקציה" value={c.team.title} onChange={onField("team", ["title"])} />

          <div className="sc-subsection">👥 חברי הצוות</div>
          {(c.team.members || []).map((m, i) => (
            <div key={i} className="sc-slide-block">
              <div className="sc-slide-num-row">
                <div className="sc-slide-num">חבר/ת צוות {i + 1}</div>
                <button type="button" className="btn sc-btn-danger" onClick={() => removeItem("team", ["members"], i)}>
                  מחיקה
                </button>
              </div>
              <TextField label="שם מלא" value={m.name} onChange={onField("team", ["members", i, "name"])} />
              <TextField label="תפקיד" value={m.role} onChange={onField("team", ["members", i, "role"])} />
              <ImageField label="תמונת פרופיל" value={m.img} onChange={onField("team", ["members", i, "img"])} />
            </div>
          ))}
          <div className="sc-list-actions">
            <button type="button" className="btn" onClick={() => addItem("team", ["members"], { name: "", role: "", img: "" })}>
              + הוספת חבר/ת צוות
            </button>
          </div>
        </SiteSectionCard>
      )}

      {/* -------------------------------- PRESS ------------------------------- */}
      {activeCard === "press" && (
        <SiteSectionCard order={1} name="כתבו עלינו" publicName="כתבו עלינו"
          description="כרטיס פייסבוק וכרטיס Ynet."
          layoutPreview={<PressPreview />} onSave={saveOne("press")}>
          <TextField label="כותרת הסקציה" value={c.press.title} onChange={onField("press", ["title"])} />
          <TextField label="תיאור קצר" value={c.press.subtitle} onChange={onField("press", ["subtitle"])} />

          <div className="sc-subsection">📘 כרטיס פייסבוק</div>
          <TextField label="כותרת הכרטיס" value={c.press.facebook.title} onChange={onField("press", ["facebook", "title"])} />
          <TextareaField label="טקסט הכרטיס" rows={3} value={c.press.facebook.text} onChange={onField("press", ["facebook", "text"])} />
          <TextField label="טקסט הכפתור" value={c.press.facebook.buttonText} onChange={onField("press", ["facebook", "buttonText"])} />
          <TextField label="קישור (URL)" value={c.press.facebook.url} onChange={onField("press", ["facebook", "url"])} />
          <ImageField label="תמונת רקע" value={c.press.facebook.image} onChange={onField("press", ["facebook", "image"])} />

          <div className="sc-subsection">📰 כרטיס Ynet</div>
          <TextField label="כותרת — שורה 1" value={c.press.ynet.titleLine1} onChange={onField("press", ["ynet", "titleLine1"])} />
          <TextField label="כותרת — שורה 2" value={c.press.ynet.titleLine2} onChange={onField("press", ["ynet", "titleLine2"])} />
          <TextareaField label="טקסט הכרטיס" rows={3} value={c.press.ynet.text} onChange={onField("press", ["ynet", "text"])} />
          <TextField label="טקסט הכפתור" value={c.press.ynet.buttonText} onChange={onField("press", ["ynet", "buttonText"])} />
          <TextField label="קישור (URL)" value={c.press.ynet.url} onChange={onField("press", ["ynet", "url"])} />
          <ImageField label="תמונת הכתבה" value={c.press.ynet.image} onChange={onField("press", ["ynet", "image"])} />
        </SiteSectionCard>
      )}

      {/* -------------------------------- JOIN -------------------------------- */}
      {activeCard === "join" && (
        <SiteSectionCard order={1} name="יצירת קשר / הצטרפות" publicName="רוצים להצטרף או לקבל פרטים?"
          description="טקסטים, נקודות מפתח והודעות הטופס."
          layoutPreview={<JoinPreview />} onSave={saveOne("join")}>
          <TextField label="כיתוב עליון" value={c.join.eyebrow} onChange={onField("join", ["eyebrow"])} />
          <TextField label="כותרת הסקציה" value={c.join.title} onChange={onField("join", ["title"])} />
          <TextField label="תיאור קצר" value={c.join.subtitle} onChange={onField("join", ["subtitle"])} />
          <TextField label="טקסט הכפתור" value={c.join.buttonText} onChange={onField("join", ["buttonText"])} />
          <TextField label="הודעת הצלחה" value={c.join.successText} onChange={onField("join", ["successText"])} />
          <TextField label="הערה תחת הכפתור" value={c.join.note} onChange={onField("join", ["note"])} />

          <div className="sc-subsection">✅ נקודות מפתח (מוצגות ליד הטופס)</div>
          {(c.join.points || []).length === 0 && (
            <div className="sc-hint">אין נקודות מותאמות. לחצו "הוספת נקודה" כדי להתחיל. עד אז יוצגו נקודות ברירת המחדל.</div>
          )}
          {(c.join.points || []).map((pt, i) => (
            <div key={i} className="sc-slide-block">
              <div className="sc-slide-num-row">
                <div className="sc-slide-num">נקודה {i + 1}</div>
                <button type="button" className="btn sc-btn-danger" onClick={() => removeItem("join", ["points"], i)}>
                  מחיקה
                </button>
              </div>
              <TextField label="כותרת" value={pt.title} onChange={onField("join", ["points", i, "title"])} />
              <TextField label="תיאור" value={pt.desc} onChange={onField("join", ["points", i, "desc"])} />
            </div>
          ))}
          <div className="sc-list-actions">
            <button type="button" className="btn" onClick={() => addItem("join", ["points"], { title: "", desc: "" })}>
              + הוספת נקודה
            </button>
          </div>
        </SiteSectionCard>
      )}

      {/* -------------------------------- FOOTER ------------------------------ */}
      {activeCard === "footer" && (
        <SiteSectionCard order={1} name="פוטר" publicName="תחתית האתר"
          description="פרטי הפוטר וקישורי הרשתות החברתיות."
          layoutPreview={<FooterPreview />} onSave={saveOne("footer")}>
          <TextField label="שם הארגון" value={c.footer.orgName} onChange={onField("footer", ["orgName"])} />
          <TextField label="טקסט משנה" value={c.footer.tagline} onChange={onField("footer", ["tagline"])} />
          <TextareaField label="תיאור הארגון" rows={3} value={c.footer.description} onChange={onField("footer", ["description"])} />
          <TextField label="טלפון" value={c.footer.phone} onChange={onField("footer", ["phone"])} />
          <TextField label="אימייל" value={c.footer.email} onChange={onField("footer", ["email"])} />
          <TextField label="כתובת" value={c.footer.address} onChange={onField("footer", ["address"])} />

          <div className="sc-subsection">🌐 עקבו אחרינו</div>
          {(c.footer.socials || []).length === 0 && (
            <div className="sc-hint">אין רשתות מותאמות. לחצו "הוספת קישור" כדי להתחיל. עד אז יוצג קישור פייסבוק ברירת המחדל.</div>
          )}
          {(c.footer.socials || []).map((s, i) => (
            <div key={i} className="sc-slide-block">
              <div className="sc-slide-num-row">
                <div className="sc-slide-num">קישור {i + 1}</div>
                <button type="button" className="btn sc-btn-danger" onClick={() => removeItem("footer", ["socials"], i)}>
                  מחיקה
                </button>
              </div>
              <TextField label="תווית מוצגת (למשל FB, IG)" value={s.label} onChange={onField("footer", ["socials", i, "label"])} />
              <TextField label="שם הרשת (לנגישות)" value={s.aria || ""} onChange={onField("footer", ["socials", i, "aria"])} />
              <TextField label="כתובת (URL)" value={s.url} onChange={onField("footer", ["socials", i, "url"])} />
            </div>
          ))}
          <div className="sc-list-actions">
            <button type="button" className="btn" onClick={() => addItem("footer", ["socials"], { label: "", aria: "", url: "" })}>
              + הוספת קישור
            </button>
          </div>
        </SiteSectionCard>
      )}

      <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 24 }}>
        <button className="btn" onClick={() => setActiveCard(null)}>
          ← חזרה לניהול האתר הראשי
        </button>
      </div>
    </AdminPageLayout>
  );
}

function SectionNote({ children }) {
  return <div className="sc-intro">{children}</div>;
}



