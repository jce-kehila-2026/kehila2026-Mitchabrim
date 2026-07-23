import { useState } from "react";
import { createJoinRequest } from "../../services/joinRequestsService";
import { validatePhone, validateName, filterDigits, filterName } from "../../utils/validation";
import useSiteContent from "@/hooks/useSiteContent";


export default function JoinRequestSection() {
  const { content } = useSiteContent();
  const j = content.join;
  // إنشاء ذاكرة حية (State) لحفظ القيم التي يكتبها المستخدم في الفورم
  const [form, setForm] = useState({ fullName: "", phone: "", type: "", message: "", email: "" });
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
      const { notificationError } = await createJoinRequest({
        fullName: form.fullName,
        phone: form.phone,
        type: form.type,
        message: form.message,
        email: form.email,
      });

      if (notificationError) {
        console.warn("create admin notification failed:", notificationError?.message);
      }

      // إذا نجحت العملية، نغير حالة sent إلى true لتظهر الكبسولة الخضراء للمستخدم
      setSent(true);
      // تفريغ الحقول بالكامل وإعادتها لنصوص فارغة لتهيئتها لطلب جديد
      setForm({ fullName: "", phone: "", type: "", message: "", email: "" });

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
            {(j.points && j.points.length > 0
              ? j.points
              : [
                  { title: "ליווי אישי ויחס חם", desc: "צוות שמקשיב, מלווה ועונה בזמן לכל פנייה." },
                  { title: "שילוב במגוון פעילויות", desc: "התנדבות אישית, פרלמנטים, פרויקטי חגים ועוד." },
                  { title: "תגובה תוך ימים ספורים", desc: "נחזור אליכם בתוך מספר ימי עבודה לעדכון הבא." },
                ]
            ).map((pt, i) => (
              <li key={i}>
                <span className="jp-ico" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </span>
                <div>
                  <h5>{pt.title}</h5>
                  <p>{pt.desc}</p>
                </div>
              </li>
            ))}
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
            <label>אימייל (אופציונלי)</label>
            <input
              className="input"
              type="email"
              value={form.email || ""}
              onChange={update("email")}
              disabled={isSubmitting}
            />
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
