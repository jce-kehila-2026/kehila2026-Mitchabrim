import { useState } from "react";
import { db } from "../../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { sanitizeText } from "../../utils/sanitize";
import { validatePhone, validateName, filterDigits, filterName } from "../../utils/validation";
import useSiteContent from "@/hooks/useSiteContent";

export default function JoinRequestSection() {
  const { content } = useSiteContent();
  const j = content.join;
  // إنشاء ذاكرة حية (State) لحفظ القيم التي يكتبها المستخدم في الفورم
  const [form, setForm] = useState({ fullName: "", phone: "", type: "", message: "" });
  const [errors, setErrors] = useState({});
  // حالة لمعرفة هل تم إرסال הטופס בהצלחה
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (k) => (e) => {
    let v = e.target.value;
    if (k === "fullName") v = filterName(v, 100);
    if (k === "phone") v = filterDigits(v, 10);
    setForm({ ...form, [k]: v });
    if (errors[k]) setErrors({ ...errors, [k]: "" });
  };

  const validateAll = () => {
    const errs = {};
    const nm = validateName(form.fullName); if (nm) errs.fullName = nm;
    const ph = validatePhone(form.phone); if (ph) errs.phone = ph;
    if (!form.type) errs.type = "יש לבחור סוג פנייה";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validateAll()) return;
    setIsSubmitting(true);

    try {
      const safeName = sanitizeText(form.fullName, 200);
      const safePhone = sanitizeText(form.phone, 40);
      const safeType = sanitizeText(form.type, 100);
      const safeMessage = sanitizeText(form.message, 2000);

      const reqRef = await addDoc(collection(db, "joinRequests"), {
        fullName: safeName,
        phone: safePhone,
        note: `${safeType} - ${safeMessage}`.trim(),
        type: safeType,
        status: "new",
        createdAt: serverTimestamp(),
      });

      try {
        await addDoc(collection(db, "notifications"), {
          audience: "admin",
          type: "join_request",
          title: "בקשת הצטרפות חדשה התקבלה",
          message: `${safeName} שלח/ה בקשת הצטרפות (${safeType})`,
          requestId: reqRef.id,
          read: false,
          createdAt: serverTimestamp(),
        });
      } catch (notifErr) {
        console.warn("create admin notification failed:", notifErr?.message);
      }

      // إذا نجحت العملية، نغير حالة sent إلى true لتظهر الكبسولة الخضراء للمستخدم
      setSent(true);
      // تفريغ الحقول بالكامل وإعادتها لنصوص فارغة لتهيئتها لطلب جديد
      setForm({ fullName: "", phone: "", type: "", message: "" });

      // مؤقت زمني (Timer) يقوم بإخفاء الرسالة الخضراء تلقائياً بعد 5 ثوانٍ
      setTimeout(() => setSent(false), 5000);
    } catch (error) {
      console.error("שגיאה בשליחת הפנייה:", error);
      alert("אירעה שגיאה בשליחת הפנייה. אנא נסו שוב.");
    } finally {
      setIsSubmitting(false); // إلغاء وضع التحميل وإعادة تفعيل زر الإرسال
    }
  };

  return (
    <section id="join" className="pub-section join-section">
      <div className="container join-grid">
        <div className="join-info">
          <span className="section-eyebrow">{j.eyebrow}</span>
          <h2 className="section-title">{j.title}</h2>
          <p className="section-sub">{j.subtitle}</p>

          <ul className="join-points-clean">
            <li>
              <span className="jp-ico" aria-hidden>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </span>
              <div>
                <h5>ליווי אישי ויחס חם</h5>
                <p>צוות שמקשיב, מלווה ועונה בזמן לכל פנייה.</p>
              </div>
            </li>
            <li>
              <span className="jp-ico" aria-hidden>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
                  <circle cx="10" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M17 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </span>
              <div>
                <h5>שילוב במגוון פעילויות</h5>
                <p>התנדבות אישית, פרלמנטים, פרויקטי חגים ועוד.</p>
              </div>
            </li>
            <li>
              <span className="jp-ico" aria-hidden>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </span>
              <div>
                <h5>תגובה תוך ימים ספורים</h5>
                <p>נחזור אליכם בתוך מספר ימי עבודה לעדכון הבא.</p>
              </div>
            </li>
          </ul>
        </div>

        <form className="join-card" onSubmit={submit}>
          {sent && <div className="join-success">{j.successText}</div>}
          <div className="field">
            <label>שם מלא</label>
            <input
              className="input"
              value={form.fullName}
              onChange={update("fullName")}
              required
              disabled={isSubmitting}
              maxLength={100}
            />
            {errors.fullName && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{errors.fullName}</div>}
          </div>
          <div className="field">
            <label>טלפון</label>
            <input
              className="input"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={form.phone}
              onChange={update("phone")}
              required
              disabled={isSubmitting}
            />
            {errors.phone && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{errors.phone}</div>}
          </div>
          <div className="field">
            <label>סוג פנייה</label>
            <select className="select" value={form.type} onChange={update("type")} required disabled={isSubmitting}>
              <option value="">בחר/י סוג פנייה...</option>
              <option>אזרח ותיק</option>
              <option>פונה עבור אזרח ותיק אחר</option>
              <option>מתעניין בהתנדבות</option>
              <option>איש מקצוע</option>
              <option>אחר</option>
            </select>
            {errors.type && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{errors.type}</div>}
          </div>
          <div className="field">
            <label>הודעה קצרה</label>
            <textarea
              className="textarea"
              rows={4}
              value={form.message}
              onChange={update("message")}
              disabled={isSubmitting}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={isSubmitting}>
            {isSubmitting ? "שולח..." : j.buttonText || "שליחת פנייה"}
          </button>
          <p className="join-note">{j.note}</p>
        </form>
      </div>
    </section>
  );
}
