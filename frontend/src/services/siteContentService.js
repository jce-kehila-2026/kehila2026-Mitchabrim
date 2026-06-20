import { db } from "../firebase";
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";

const SITE_DOC = doc(db, "siteContent", "home");

export const DEFAULT_SITE_CONTENT = {
  hero: {
    eyebrow: "פרויקט קהילתי בירושלים",
    titleLine1: "מתחברים בין אזרחים ותיקים,",
    titleLine2: "ותיקים ו",
    titleAccent: "קהילה",
    lead: "— חיבור אזרחים בודדים לקהילה בירושלים, דרך קשר אישי, פעילות חברתית וליווי מתמשך.",
    ctaText: "אני רוצה להצטרף",
    stats: [
      { num: "1,200+", label: "אזרחים ותיקים" },
      { num: "850+", label: "מתנדבים ושותפים" },
      { num: "ירושלים", label: "קהילה אחת" },
    ],
    imageMain: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=900&q=80",
    imageTopLeft: "https://images.unsplash.com/photo-1521146764736-56c929d59c83?auto=format&fit=crop&w=600&q=80",
    imageBottom: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=500&q=80",
  },
  about: {
    eyebrow: "הכירו את מתחברים",
    headlineLine1: "אנחנו מאמינים שאף אזרח ותיק",
    headlineLine2: "לא צריך להרגיש ",
    headlineAccent: "לבד",
    body:
      "מתחברים הוא מיזם קהילתי להפגת בדידות בקרב אזרחים ותיקים בירושלים. אנו מחברים בין מתנדבים לאזרחים ותיקים ויוצרים קשר אישי קבוע, המבוסס על חברות וליווי. באמצעות החיבורים הללו אנו בונים קהילה מחבקת שבה אף אדם לא נשאר לבד.\n\nכל חיבור הוא הזדמנות לשנות יום שלם – ולבנות יחד קהילה ירושלמית חזקה, חמה ותומכת.\n\nהפרויקט נוסד בשנת 2019, מונה כ-280 אזרחים ותיקים בודדים בירושלים ופועל בלמעלה מ-17 שכונות בעיר. הפרויקט הוקם על ידי יהודית זבדצקי, בת 75, תושבת מוצא עילית. יהודית היא יזמת חברתית, בעלת ותק במגוון תפקידים בכירים בעיריית ירושלים. ייסדה את הפרויקט ומנהלת את פעילותו.",
    ctaText: "הצטרפו אלינו",
    image: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=1100&q=80",
    badgeNum: "+150",
    badgeLabel: "מתנדבים פעילים",
  },
  activities: {
    title: "העשייה שלנו",
    subtitle: "ארבעה תחומי פעילות מרכזיים שהופכים את הקהילה לחמה יותר.",
    centerTitle: "התנדבות אישית",
    centerDesc: "חיבור בין מתנדבים לאזרחים\nותיקים למפגשים, שיחות\nוליווי אישי.",
    bubbles: [
      { title: "פרלמנטים", desc: "שיח בין דורי, השפעה\nוקבלת החלטות יחד." },
      { title: "קשר רציף", desc: "ליווי מתמשך לאורך זמן\nומענה לצרכים משתנים." },
      { title: "פרויקטי חגים", desc: "יוצרים שמחה, חוויה\nוקירוב לבבות." },
    ],
  },
  quote: {
    eyebrow: "דבר המייסדת",
    text: "עלינו להעניק לקהילת האזרחים הוותיקים בירושלים את הכבוד, האהבה ותשומת לב שמגיעים להם — כדי שירגישו עצמאות וערך בשנותיהם המאוחרות.",
    author: "— נעמה שרעבי, מייסדת עזרת אבות",
    image:
      "https://ynet-pic1.yit.co.il/cdn-cgi/image/f=auto,w=740,q=75/picserver6/crop_images/2026/06/16/HyE2fnRZMe/HyE2fnRZMe_0_0_1280_853_0_x-large.jpg",
  },
  gallery: {
    eyebrow: "גלריה",
    title: "רגעים מהקהילה",
    subtitle: "תמונות מפעילויות, מפגשים וחיבורים שנוצרים לאורך הדרך.",
    slides: [
      { img: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=1200&q=80", title: "ביקורי מתנדבים" },
      { img: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=80", title: "מפגשי פרלמנט" },
      { img: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1200&q=80", title: "פעילות קהילתית" },
      { img: "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=1200&q=80", title: "פרויקטים בחגים" },
      { img: "https://images.unsplash.com/photo-1521146764736-56c929d59c83?auto=format&fit=crop&w=1200&q=80", title: "קשר בין דורות" },
      { img: "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=1200&q=80", title: "רגעים חמים" },
    ],
  },
  partners: {
    eyebrow: "שותפים",
    title: "השותפים שלנו",
    subtitle: "ארגונים, מוסדות וקהילות שמלווים אותנו בדרך.",
  },
  team: {
    eyebrow: "הצוות",
    title: "הצוות שלנו",
    members: [
      { name: "יהודית זבדצקי", role: "מייסדת ומנהלת פרויקט מתחברים", img: "/__l5e/assets-v1/0c11cf82-e934-4770-b4d0-53afa7a44280/yehudit-zavadtsky.jpg" },
      { name: "פנינה זרגרי", role: "רכזת פרויקט", img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=700&q=80" },
      { name: "שירה ששון", role: "רכזת פרויקט", img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=700&q=80" },
    ],
  },
  press: {
    title: "כתבו עלינו",
    subtitle: "מהתקשורת ומהשטח — על העשייה שלנו יחד",
    facebook: {
      title: "רגעים מהקהילה",
      text: "צפו בסרטון קצר מהפעילות שלנו ומהרגעים שמחברים בינינו.",
      buttonText: "לצפייה בסרטון",
      url: "https://www.facebook.com/share/r/1BKc1zU5Dc/?mibextid=wwXIfr",
      image: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=700&q=80",
    },
    ynet: {
      titleLine1: "יחד ננצח",
      titleLine2: "את הבדידות",
      text: "300 אזרחים ותיקים חגגו יום הולדת במסגרת פרויקט ירושלמי שנועד לתת תחושה של בית, גם למי שאין משפחה.",
      buttonText: "לקריאת הכתבה",
      url: "https://www.ynet.co.il/activism/article/yokra14798707?utm_source=ynet.app.android&utm_medium=social&utm_campaign=general_share&utm_term=yokra14798707&utm_content=Header",
      image: "https://images.unsplash.com/photo-1573497019418-b400bb3ab074?auto=format&fit=crop&w=900&q=80",
    },
  },
  join: {
    eyebrow: "הצטרפות",
    title: "רוצים להצטרף או לקבל פרטים?",
    subtitle: "השאירו פרטים ונחזור אליכם בהקדם ונשמח לעזור.",
    buttonText: "שליחת פנייה",
    successText: "הבקשה נשלחה בהצלחה. ניצור איתך קשר בהקדם.",
    note: "נחזור אליך בהקדם ונשמח לעזור.",
  },
  footer: {
    orgName: "מתחברים",
    tagline: "חיבור אזרחים בודדים לקהילה",
    description: "מתחברים – חיבור אזרחים בודדים לקהילה דרך מתנדבים, פעילויות וליווי קהילתי בירושלים.",
    phone: "02 - 000 - 0000",
    email: "info@mitchabrim.org",
    address: "ירושלים",
  },
};

/** Deep-merge defaults so the public site never crashes if a section is missing. */
export function mergeWithDefaults(data) {
  const out = structuredClone(DEFAULT_SITE_CONTENT);
  if (!data) return out;
  for (const k of Object.keys(out)) {
    if (data[k] && typeof data[k] === "object" && !Array.isArray(data[k])) {
      out[k] = { ...out[k], ...data[k] };
    } else if (data[k] !== undefined) {
      out[k] = data[k];
    }
  }
  return out;
}

export function subscribeSiteContent(cb) {
  return onSnapshot(SITE_DOC, (snap) => {
    cb(mergeWithDefaults(snap.exists() ? snap.data() : null));
  });
}

export async function getSiteContent() {
  const snap = await getDoc(SITE_DOC);
  return mergeWithDefaults(snap.exists() ? snap.data() : null);
}

export async function saveSection(sectionKey, data) {
  await setDoc(
    SITE_DOC,
    { [sectionKey]: data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function saveAll(content) {
  await setDoc(SITE_DOC, { ...content, updatedAt: serverTimestamp() }, { merge: true });
}

export async function ensureSeeded() {
  const snap = await getDoc(SITE_DOC);
  if (!snap.exists()) {
    await setDoc(SITE_DOC, { ...DEFAULT_SITE_CONTENT, updatedAt: serverTimestamp() });
  }
}
